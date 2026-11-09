import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { addDays } from "../../shared/dates";
import type { MedalTier } from "../../shared/xp";
import { Medal, MedalPlaceholder, MEDAL_GLOW } from "../components/game/Medal";
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

/** Fundo da revelação (tema Neon): preto com halo limão no centro e aurora verde embaixo. */
const BG_WON =
  "radial-gradient(60% 40% at 50% 38%, rgb(136 239 27 / 0.26), transparent 70%), radial-gradient(100% 60% at 50% 110%, rgb(0 176 0 / 0.5), transparent 70%), #030403";
/** Semana sem medalha (e carregando): mesmo fundo, sem o halo. */
const BG_CALM = "radial-gradient(100% 50% at 50% 115%, rgb(0 176 0 / 0.28), transparent 70%), #030403";

const LEVEL_FILL = "linear-gradient(90deg, var(--green-deep), var(--green), var(--lime))";

/** Faíscas que sobem pela tela (posições fixas, em % da tela). */
const SPARKS = [
  { left: 12, top: 62, delay: 0 },
  { left: 86, top: 70, delay: 1.4 },
  { left: 24, top: 82, delay: 2.6 },
  { left: 70, top: 58, delay: 0.8 },
  { left: 48, top: 88, delay: 3.2 },
  { left: 92, top: 84, delay: 2.1 },
  { left: 8, top: 76, delay: 3.7 },
  { left: 60, top: 74, delay: 1.9 },
  { left: 34, top: 66, delay: 0.4 },
  { left: 78, top: 90, delay: 2.9 },
  { left: 18, top: 92, delay: 1.1 },
  { left: 54, top: 60, delay: 3.5 },
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

  return (
    <dialog
      ref={dialog}
      aria-label="Medalha da semana"
      data-toast-host
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-x-hidden overflow-y-auto overscroll-contain border-0 p-0 text-ink"
      style={{ background: tier ? BG_WON : BG_CALM, colorScheme: "dark" }}
    >
      {tier && <Sparks />}
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
          className="absolute top-[calc(env(safe-area-inset-top,0px)+0.5rem)] right-2 z-10 grid size-11 place-items-center rounded-full text-ink/80 transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CloseIcon size={22} />
        </button>

        {/* Conteúdo centrado na altura que sobra; o botão principal fica no pé da tela. */}
        <div className="flex w-full flex-1 flex-col items-center justify-center pb-4">
          <p className="eyebrow relative mt-6 text-neon">Domingo · semana encerrada</p>
          <p className="relative mt-1.5 font-mono text-[12px] tracking-[0.06em] text-muted">
            Semana de {range(start, addDays(start, 5))}
          </p>

          {error ? (
            <div role="alert" className="my-auto flex flex-col items-center gap-3 py-10">
              <p className="text-danger-ink">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="glass-quiet min-h-11 rounded-xl px-4 font-semibold hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Tentar de novo
              </button>
            </div>
          ) : !data ? (
            <div role="status" aria-busy="true" className="my-auto py-10">
              <div
                className="mx-auto h-[180px] w-[154px] bg-white/[0.06] motion-safe:animate-pulse"
                style={{ clipPath: "path('M77 0 L154 22 V96 C154 140 120 166 77 180 C34 166 0 140 0 96 V22 Z')" }}
              />
              <span className="sr-only">Carregando…</span>
            </div>
          ) : tier ? (
            <Won data={data} tier={tier} />
          ) : (
            <NoMedal data={data} />
          )}
        </div>

        <button
          ref={cta}
          type="button"
          onClick={() => onDetails(start)}
          className="fill-brand relative flex min-h-[52px] w-full shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
        >
          Ver detalhes da semana
        </button>
      </div>
    </dialog>
  );
}

/** Faíscas limão subindo (Web Animations; nenhuma com movimento reduzido). */
function Sparks() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || reducedMotion() || typeof el.animate !== "function") return;
    const anims = Array.from(el.children).map((c, i) =>
      (c as HTMLElement).animate(
        [
          { transform: "translateY(0)", opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { transform: "translateY(-260px)", opacity: 0 },
        ],
        { duration: 4000, delay: SPARKS[i].delay * 1000, iterations: Infinity, easing: "linear" },
      ),
    );
    return () => anims.forEach((a) => a.cancel());
  }, []);
  return (
    <div ref={box} aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden">
      {SPARKS.map((s, i) => (
        <i
          key={i}
          className="absolute size-1 rounded-full bg-lime opacity-0 shadow-[0_0_10px_var(--lime)]"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
        />
      ))}
    </div>
  );
}

function LevelProgress({ data }: { data: ReportData }) {
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
      className="relative mt-5 w-full px-1.5 text-left"
    >
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-ink">Nível {level}</span>
        <span className="font-mono text-[12px] text-muted tabular-nums">
          <b className="text-neon font-semibold">{intFmt.format(into)}</b> / {intFmt.format(needed)} XP
        </span>
      </div>
      <div className="level-track mt-2 h-2 overflow-hidden rounded-md">
        <div
          className="h-full rounded-md transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            width: `${width}%`,
            background: LEVEL_FILL,
            boxShadow: "0 0 12px rgb(136 239 27 / 0.7)",
          }}
        />
      </div>
    </div>
  );
}

function Stat({ value, label, hl = false }: { value: ReactNode; label: string; hl?: boolean }) {
  return (
    <div className="glass-quiet rounded-[18px] px-1 pt-3 pb-2.5">
      <b
        className={`font-display flex items-center justify-center gap-0.5 text-[24px] leading-[1.05] font-extrabold tracking-[-0.04em] tabular-nums ${hl ? "text-neon" : ""}`}
      >
        {value}
      </b>
      <small className="mt-1 block font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
        {label}
      </small>
    </div>
  );
}

function Stats({ data }: { data: ReportData }) {
  const { report, previousXp } = data;
  const high = report.byDifficulty.high;
  return (
    <div className="relative mt-4 grid w-full grid-cols-3 gap-2" data-testid="reveal-stats">
      <Stat value={report.done} label="feitas" hl />
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

const PILL = "glass-quiet inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-[12px] font-semibold";

function Won({ data, tier }: { data: ReportData; tier: MedalTier }) {
  const xp = data.report.xp;
  const shown = useCountUp(xp);
  const levelUp = data.level.level > data.levelBefore;
  const best = xp > 0 && xp >= data.bestWeekXp;
  const supremo = tier === "supremo";
  const glow = MEDAL_GLOW[tier];
  const tierStyle: CSSProperties = {
    backgroundImage: "linear-gradient(180deg, #fff, var(--lime))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    filter: "drop-shadow(0 0 12px rgb(136 239 27 / 0.6))",
  };

  return (
    <>
      <p className="font-display relative mt-3 text-[30px] leading-[1.1] font-extrabold tracking-[-0.04em]">
        Nova medalha!
      </p>

      {/* Palco do brasão: raios girando atrás, halo na cor do nível e o brasão entrando. */}
      <div className="relative mt-2 grid h-[250px] w-full place-items-center">
        <div
          aria-hidden
          className="rays-spin pointer-events-none absolute top-1/2 left-1/2 -mt-[340px] -ml-[340px] size-[680px] rounded-full"
          style={{
            background: `repeating-conic-gradient(from 0deg, rgb(136 239 27 / ${supremo ? 0.18 : 0.14}) 0 6deg, transparent 6deg 18deg)`,
            mask: "radial-gradient(circle, #000 0 18%, transparent 55%)",
            WebkitMask: "radial-gradient(circle, #000 0 18%, transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${glow}4d, transparent 70%)` }}
        />
        <div className="medal-in relative" style={{ filter: `drop-shadow(0 0 ${supremo ? 26 : 20}px ${glow}80)` }}>
          <Medal tier={tier} size={230} />
        </div>
      </div>

      <h1 className="font-display relative mt-1 text-[38px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance" style={tierStyle}>
        {WEEK_TITLE[tier]}
      </h1>

      <div className="relative mt-3 flex flex-wrap justify-center gap-2">
        <span className={`${PILL} text-neon`}>
          <span aria-hidden>+{intFmt.format(shown)} XP</span>
          <span className="sr-only">{intFmt.format(xp)} XP nesta semana</span>
        </span>
        {levelUp ? (
          <span className={`${PILL} text-lime`}>
            <ChevronsUpIcon size={15} strokeWidth={2.75} aria-hidden />
            Subiu para o nível {data.level.level}!
          </span>
        ) : (
          <span className={PILL}>Nível {data.level.level}</span>
        )}
        {best && (
          <span className={`${PILL} text-mint`}>
            <StarIcon size={14} strokeWidth={2.5} aria-hidden />
            Melhor semana até agora
          </span>
        )}
      </div>

      <LevelProgress data={data} />
      <Stats data={data} />
    </>
  );
}

/** Semana sem XP: tela calma, sem raios, sem cobrança. */
function NoMedal({ data }: { data: ReportData }) {
  return (
    <>
      <div className="mt-8 grid h-[190px] place-items-center opacity-80">
        <MedalPlaceholder size={180} />
      </div>
      <h1 className="font-display mt-3 text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-balance">
        Semana sem medalha
      </h1>
      <p className="mt-2 max-w-[30ch] text-[15px] text-muted text-pretty">
        Nenhuma tarefa feita de segunda a sábado. Tudo bem: amanhã começa uma semana nova, e cada tarefa feita já conta
        para a próxima medalha.
      </p>
      <LevelProgress data={data} />
    </>
  );
}
