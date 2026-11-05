import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { addDays } from "../../shared/dates";
import type { MedalTier } from "../../shared/xp";
import { Medal, MedalPlaceholder } from "../components/game/Medal";
import { ArrowUpIcon, ChevronsUpIcon, CloseIcon, StarIcon } from "../components/ui/Icon";
import { api, ApiError, type ReportData } from "../lib/api";

const rangeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const range = (a: string, b: string) => rangeFmt.formatRange(new Date(`${a}T12:00:00Z`), new Date(`${b}T12:00:00Z`));
const intFmt = new Intl.NumberFormat("pt-BR");

/** "Semana Ouro", "Semana Suprema" (o Supremo concorda com "semana"). */
export const WEEK_TITLE: Record<MedalTier, string> = {
  bronze: "Semana Bronze",
  prata: "Semana Prata",
  ouro: "Semana Ouro",
  diamante: "Semana Diamante",
  supremo: "Semana Suprema",
};

/** "+90", "−30" ou "0" (sinal de menos tipográfico). */
export const signedXp = (n: number) => (n > 0 ? `+${intFmt.format(n)}` : n < 0 ? `−${intFmt.format(-n)}` : "0");

interface Theme {
  /** Fundo radial da tela. */
  bg: string;
  /** Gradiente do título. */
  title: string;
  /** Preenchimento da barra de nível. */
  fill: string;
  /** Cor do brilho em volta da medalha e da barra. */
  glow: string;
  /** Borda e texto do selo ("Subiu de nível"). */
  chip: string;
  chipInk: string;
  sparks: string[];
}

const THEMES: Record<MedalTier, Theme> = {
  bronze: {
    bg: "radial-gradient(circle at 50% 30%, #A2552B 0, #4A2414 40%, #140D10 78%)",
    title: "linear-gradient(180deg, #FFE1C7, #E0A27A 55%, #B8693A)",
    fill: "linear-gradient(90deg, #C9814F, #F3C29A)",
    glow: "#F3C29A",
    chip: "#F3C29A80",
    chipInk: "#FFD9BD",
    sparks: ["#F3C29A", "#fff", "#FFD9BD", "#E0A27A"],
  },
  prata: {
    bg: "radial-gradient(circle at 50% 30%, #6B7894 0, #2C3247 40%, #0F1018 78%)",
    title: "linear-gradient(180deg, #FFFFFF, #D5DCE7 55%, #8691A3)",
    fill: "linear-gradient(90deg, #9AA6C2, #F2F5FA)",
    glow: "#D5DCE7",
    chip: "#D5DCE780",
    chipInk: "#E9EEF5",
    sparks: ["#fff", "#CFE6FF", "#D5DCE7", "#fff"],
  },
  ouro: {
    bg: "radial-gradient(circle at 50% 30%, #5B3FD9 0, #2A1F66 38%, #120F26 75%)",
    title: "linear-gradient(180deg, #FFF1B8, #F5B400 60%, #C47F00)",
    fill: "linear-gradient(90deg, #F5B400, #FFE27A)",
    glow: "#FFD34A",
    chip: "#FFD34A80",
    chipInk: "#FFE27A",
    sparks: ["#FFE27A", "#9FD8FF", "#FF8AD0", "#fff"],
  },
  diamante: {
    bg: "radial-gradient(circle at 50% 30%, #2F6BEA 0, #15306E 40%, #0A1024 78%)",
    title: "linear-gradient(180deg, #E8F3FF, #7FB4FF 55%, #3D8BFF)",
    fill: "linear-gradient(90deg, #3D8BFF, #CFE6FF)",
    glow: "#7FB4FF",
    chip: "#7FB4FF80",
    chipInk: "#CFE6FF",
    sparks: ["#CFE6FF", "#fff", "#7FB4FF", "#9FD8FF"],
  },
  supremo: {
    bg: "radial-gradient(circle at 50% 30%, #C14BFF 0, #4A1F8C 40%, #120F26 78%)",
    title: "linear-gradient(90deg, #FFE27A, #FF8AD0, #9FD8FF)",
    fill: "linear-gradient(90deg, #FF8AD0, #9FD8FF)",
    glow: "#FF8AD0",
    chip: "#FF8AD0",
    chipInk: "#FFC6E6",
    sparks: ["#FFE27A", "#9FD8FF", "#FF8AD0", "#fff", "#FFE27A"],
  },
};

/** Posição dos brilhos em volta da medalha (em % da área da medalha). */
const SPARKS = [
  { left: "8%", top: "22%", delay: "0s" },
  { left: "88%", top: "10%", delay: ".6s" },
  { left: "84%", top: "78%", delay: "1.2s" },
  { left: "12%", top: "84%", delay: ".3s" },
  { left: "50%", top: "-6%", delay: ".9s" },
];

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Conta de 0 até `to` com requestAnimationFrame (instantâneo com movimento reduzido). */
function useCountUp(to: number, delay = 450, duration = 1300): number {
  const [n, setN] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion() || to === 0) {
      setN(to);
      return;
    }
    setN(0);
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0 - delay) / duration));
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, duration]);
  return n;
}

interface Props {
  /** Segunda-feira da semana revelada. */
  start: string;
  onClose: () => void;
  /** "Ver detalhes da semana": abre o resumo dessa semana. */
  onDetails: (start: string) => void;
}

/** Domingo: revelação da medalha da semana em tela cheia, no estilo de jogo. */
export function MedalReveal({ start, onClose, onDetails }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // O foco começa no botão principal (o showModal iria para o "Fechar", o primeiro da ordem).
    cta.current?.focus();
  }, []);

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      setData(await api.reportData(start));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a semana.");
    }
  }, [start]);

  useEffect(() => {
    void load();
  }, [load]);

  const tier = data?.report.medal ?? null;
  const theme = tier ? THEMES[tier] : null;

  return (
    <dialog
      ref={dialog}
      aria-label="Medalha da semana"
      data-toast-host
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-x-hidden overflow-y-auto overscroll-contain border-0 p-0 text-white"
      style={{
        background: theme?.bg ?? "radial-gradient(circle at 50% 30%, #2E2A52 0, #1A1730 45%, #100E1C 80%)",
        colorScheme: "dark",
      }}
    >
      <div
        className="relative mx-auto flex min-h-full w-full max-w-[26rem] flex-col items-center px-4 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
        }}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute top-[calc(env(safe-area-inset-top,0px)+0.5rem)] right-2 z-10 grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <CloseIcon size={22} />
        </button>

        {/* Conteúdo centrado na altura que sobra; o botão principal fica no pé da tela. */}
        <div className="flex w-full flex-1 flex-col items-center justify-center pb-4">
          <p className="mt-5 text-[12px] font-semibold tracking-[0.14em] text-[#CFC6FF] uppercase">
            Semana de {range(start, addDays(start, 5))}
          </p>

          {error ? (
            <div role="alert" className="my-auto flex flex-col items-center gap-3 py-10">
              <p className="text-[#FFC6C8]">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-11 rounded-xl border border-white/25 px-4 font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Tentar de novo
              </button>
            </div>
          ) : !data ? (
            <div role="status" aria-busy="true" className="my-auto py-10">
              <div className="mx-auto size-[150px] rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
              <span className="sr-only">Carregando…</span>
            </div>
          ) : tier && theme ? (
            <Won data={data} tier={tier} theme={theme} />
          ) : (
            <NoMedal data={data} />
          )}
        </div>

        <button
          ref={cta}
          type="button"
          onClick={() => onDetails(start)}
          className="flex min-h-12 shrink-0 w-full items-center justify-center rounded-[14px] font-bold text-white shadow-[0_6px_18px_-6px_#6D4AFF] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
          style={{ background: "linear-gradient(180deg, #8A6CFF, #6D4AFF)" }}
        >
          Ver detalhes da semana
        </button>
      </div>
    </dialog>
  );
}

function LevelProgress({ data, fill, glow }: { data: ReportData; fill: string; glow: string }) {
  const { level, into, needed } = data.level;
  const pct = needed > 0 ? Math.min(100, Math.max(0, (into / needed) * 100)) : 0;
  // A barra parte do zero e cresce depois que a medalha entra (a transição some com movimento reduzido).
  const [width, setWidth] = useState(() => (reducedMotion() ? pct : 0));
  useEffect(() => {
    const t = window.setTimeout(() => setWidth(pct), reducedMotion() ? 0 : 900);
    return () => window.clearTimeout(t);
  }, [pct]);
  return (
    <div
      role="progressbar"
      aria-label={`Nível ${level}`}
      aria-valuemin={0}
      aria-valuemax={needed}
      aria-valuenow={Math.min(into, needed)}
      aria-valuetext={`Nível ${level}, ${into} de ${needed} XP`}
      className="mt-4 w-full px-1.5 text-left"
    >
      <div className="flex justify-between text-[12.5px] text-[#CFC6FF]">
        <span className="font-semibold text-white">Nível {level}</span>
        <span className="tabular-nums">
          {intFmt.format(into)} / {intFmt.format(needed)} XP
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.12]">
        <div
          className="h-full rounded-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            width: `${width}%`,
            background: fill,
            boxShadow: `0 0 12px ${glow}`,
          }}
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.12] bg-white/[0.07] px-1 py-2.5">
      <b className="font-display flex items-center justify-center gap-0.5 text-[19px] leading-tight font-extrabold tabular-nums">
        {value}
      </b>
      <small className="text-[12px] text-[#CFC6FF]">{label}</small>
    </div>
  );
}

function Stats({ data }: { data: ReportData }) {
  const { report, previousXp } = data;
  const high = report.byDifficulty.high;
  return (
    <div className="mt-4 grid w-full grid-cols-3 gap-2" data-testid="reveal-stats">
      <Stat value={report.done} label="feitas" />
      <Stat
        value={
          <>
            {high}
            <ArrowUpIcon size={16} strokeWidth={2.75} aria-hidden />
          </>
        }
        label={high === 1 ? "alta" : "altas"}
      />
      <Stat value={signedXp(report.xp - previousXp)} label="vs semana passada" />
    </div>
  );
}

function Won({ data, tier, theme }: { data: ReportData; tier: MedalTier; theme: Theme }) {
  const xp = data.report.xp;
  const shown = useCountUp(xp);
  const levelUp = data.level.level > data.levelBefore;
  const best = xp > 0 && xp >= data.bestWeekXp;
  const supremo = tier === "supremo";
  const titleStyle: CSSProperties = {
    backgroundImage: theme.title,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  return (
    <>
      {/* Palco da medalha: raios girando atrás, brilhos e a medalha entrando. */}
      <div className="relative mt-4 grid h-[200px] w-full place-items-center">
        <div
          aria-hidden
          className="rays-spin pointer-events-none absolute top-1/2 left-1/2 -mt-[260px] -ml-[260px] size-[520px] rounded-full"
          style={{
            background: `repeating-conic-gradient(from 0deg, #ffffff${supremo ? "1c" : "14"} 0 8deg, transparent 8deg 22deg)`,
            mask: "radial-gradient(circle, #000 20%, transparent 65%)",
            WebkitMask: "radial-gradient(circle, #000 20%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, ${theme.glow}55, transparent 70%)`,
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-[12%] inset-y-0">
          {SPARKS.slice(0, supremo ? 5 : 4).map((s, i) => (
            <span
              key={i}
              className="absolute size-1.5 rotate-45 rounded-[2px] motion-safe:animate-pulse"
              style={{
                left: s.left,
                top: s.top,
                background: theme.sparks[i % theme.sparks.length],
                animationDelay: s.delay,
              }}
            />
          ))}
        </div>
        <div
          className="medal-in relative"
          style={{
            filter: `drop-shadow(0 0 ${supremo ? 26 : 22}px ${theme.glow}aa)`,
          }}
        >
          <Medal tier={tier} size={supremo ? 150 : 170} />
        </div>
      </div>

      <h1 className="font-display mt-1 text-[36px] leading-[1.05] font-extrabold text-balance" style={titleStyle}>
        {WEEK_TITLE[tier]}
      </h1>
      <p className="font-display mt-0.5 text-[24px] font-extrabold tabular-nums">
        <span aria-hidden>+{intFmt.format(shown)} XP</span>
        <span className="sr-only">{intFmt.format(xp)} XP nesta semana</span>
      </p>

      {(levelUp || best) && (
        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
          {levelUp && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border bg-white/10 px-3 py-1 text-[13px] font-bold"
              style={{ borderColor: "#FFD34A80", color: "#FFE27A" }}
            >
              <ChevronsUpIcon size={15} strokeWidth={2.75} aria-hidden />
              Subiu para o nível {data.level.level}!
            </span>
          )}
          {best && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border bg-white/10 px-3 py-1 text-[13px] font-bold"
              style={{ borderColor: theme.chip, color: theme.chipInk }}
            >
              <StarIcon size={14} strokeWidth={2.5} aria-hidden />
              Melhor semana até agora
            </span>
          )}
        </div>
      )}

      <LevelProgress data={data} fill={theme.fill} glow={theme.glow} />
      <Stats data={data} />
    </>
  );
}

/** Semana sem XP: tela calma, sem raios, sem cobrança. */
function NoMedal({ data }: { data: ReportData }) {
  return (
    <>
      <div className="mt-8 grid h-[170px] place-items-center opacity-80">
        <MedalPlaceholder size={150} />
      </div>
      <h1 className="font-display mt-3 text-[30px] leading-tight font-extrabold text-balance">Semana sem medalha</h1>
      <p className="mt-2 max-w-[30ch] text-[15px] text-[#CFC6FF] text-pretty">
        Nenhuma tarefa feita de segunda a sábado. Tudo bem: amanhã começa uma semana nova, e cada tarefa feita já conta
        para a próxima medalha.
      </p>
      <LevelProgress data={data} fill="linear-gradient(90deg, #6D4AFF, #A58BFF)" glow="#8A6CFF" />
    </>
  );
}
