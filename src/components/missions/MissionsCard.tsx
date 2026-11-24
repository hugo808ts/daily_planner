import { useEffect, useRef, useState } from "react";
import { ATTRIBUTE_LABEL, type MissionDay, type WindowState } from "../../../shared/hero";
import { isoWeekday } from "../../../shared/workout";
import { api, ApiError } from "../../lib/api";
import { plural } from "../../lib/format";
import { useMissions } from "../../lib/useMissions";
import { notifyProgressChanged } from "../../lib/useProgress";
import { XpPop } from "../game/XpPop";
import { showToast } from "../Toast";
import { Button, IconButton } from "../ui/Button";
import { CheckIcon, MoreIcon, PlusIcon } from "../ui/Icon";
import { MissionsSheet } from "./MissionsSheet";

interface Props {
  /** Hoje (só hoje dá para marcar). */
  date: string;
  /** XP das missões feitas no dia, para o "+N XP hoje" do Hoje. */
  onXp?: (xp: number) => void;
}

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
const WEEKDAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const DOT_LABEL: Record<WindowState, string> = { lit: "cumprido", dark: "não cumprido", today: "hoje", future: "ainda não chegou" };

/** Os 7 pontinhos da semana (seg a dom): aceso = dia cumprido. */
function WeekDots({ week }: { week: WindowState[] }) {
  return (
    <span
      role="img"
      aria-label={`Semana: ${week.map((s, i) => `${WEEKDAYS[i]} ${DOT_LABEL[s]}`).join(", ")}`}
      className="flex gap-1"
    >
      {week.map((s, i) => (
        <i
          key={i}
          className={`h-1.5 w-3 rounded-[3px] ${
            s === "lit"
              ? "bg-lime shadow-[0_0_6px_var(--lime)]"
              : s === "today"
                ? "bg-lime/35 shadow-[inset_0_0_0_1px_var(--lime)]"
                : "bg-white/12"
          }`}
        />
      ))}
    </span>
  );
}

function MissionTile({ m, onToggle }: { m: MissionDay; onToggle: (m: MissionDay) => void }) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={m.done}
        aria-label={`${m.title}: +${m.xp} XP, ${ATTRIBUTE_LABEL[m.attribute]}${m.streak ? `, ${plural(m.streak, "dia seguido", "dias seguidos")}` : ""}`}
        onClick={() => onToggle(m)}
        className={`group flex h-full w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-left transition-[background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
          m.done
            ? "bg-linear-160 from-lime/20 to-[rgb(0_176_0/0.08)] shadow-[inset_0_0_0_1px_rgb(136_239_27/0.5)]"
            : "bg-white/[0.035] shadow-[inset_0_0_0_1px_var(--line)]"
        }`}
      >
        <span
          aria-hidden
          className={`grid size-[26px] shrink-0 place-items-center rounded-full transition-transform duration-150 group-active:scale-90 motion-reduce:transition-none ${
            m.done ? "fill-neon" : "border-2 border-white/30"
          }`}
        >
          {m.done && <CheckIcon size={15} strokeWidth={3.2} />}
        </span>
        <span className="min-w-0">
          <b className="block text-[13px] leading-snug font-semibold break-words">{m.title}</b>
          <small className="font-mono text-[10.5px] font-medium text-muted">
            <em className="text-lime not-italic">+{m.xp}</em> · {ATTRIBUTE_LABEL[m.attribute]}
            {m.streak > 0 && ` · ${plural(m.streak, "dia", "dias")}`}
          </small>
        </span>
      </button>
    </li>
  );
}

/** Missões do dia no topo do Hoje: um toque marca; todas feitas acendem a janela de hoje na torre. */
export function MissionsCard({ date, onXp }: Props) {
  const { data, error, reload, patch } = useMissions(date);
  const [pop, setPop] = useState<{ key: number; amount: number } | null>(null);
  const [editing, setEditing] = useState(false);
  /** Missões com PUT em andamento: toques repetidos são ignorados. */
  const toggling = useRef(new Set<string>());

  const missions = data?.missions ?? [];
  const doneCount = missions.filter((m) => m.done).length;
  const xp = missions.reduce((s, m) => s + (m.done ? m.xp : 0), 0);

  useEffect(() => {
    onXp?.(xp);
  }, [xp, onXp]);

  const setMission = (m: MissionDay) =>
    patch((d) => {
      const list = d.missions.map((x) => (x.id === m.id ? m : x));
      const complete = list.length > 0 && list.every((x) => x.done);
      const i = isoWeekday(date) - 1;
      const week = d.week.map((s, k) => (k === i ? (complete ? "lit" : "today") : s));
      return { ...d, missions: list, complete, week };
    });

  const toggle = async (m: MissionDay) => {
    if (toggling.current.has(m.id)) return;
    toggling.current.add(m.id);
    const done = !m.done;
    setMission({ ...m, done, streak: Math.max(0, m.streak + (done ? 1 : -1)) });
    try {
      const res = await api.checkMission(m.id, date, done);
      setMission(res.mission);
      if (done) setPop({ key: Date.now(), amount: m.xp });
      notifyProgressChanged();
      void reload();
    } catch (e) {
      setMission(m); // volta ao estado de antes do toque
      showToast(errorMessage(e));
    } finally {
      toggling.current.delete(m.id);
    }
  };

  const total = missions.length;
  const complete = !!data?.complete;

  return (
    <section aria-labelledby="missoes-titulo" className="glass relative mt-3 mb-4 rounded-[22px] px-3 pt-3 pb-2.5">
      {pop && <XpPop key={pop.key} amount={pop.amount} onDone={() => setPop(null)} />}
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id="missoes-titulo" className="eyebrow !tracking-[0.12em] whitespace-nowrap !text-lime">
          Rotina do dia{total > 0 && ` · ${doneCount}/${total}`}
        </h2>
        <div className="flex min-w-0 items-center gap-1">
          {data && <WeekDots week={data.week} />}
          <IconButton
            label="Editar rotina"
            size="sm"
            aria-haspopup="dialog"
            icon={<MoreIcon size={18} />}
            className="text-muted"
            onClick={() => setEditing(true)}
          />
        </div>
      </div>

      {error && !data ? (
        <div role="alert" className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-danger-ink">{error}</span>
          <Button size="sm" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        </div>
      ) : !data ? (
        <div aria-busy="true" className="mt-2.5 grid grid-cols-2 gap-2">
          <span className="sr-only">Carregando rotina…</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-[52px] rounded-2xl bg-ink/[0.04] motion-safe:animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted">Nada na rotina de hoje.</p>
          <Button size="sm" icon={<PlusIcon size={16} />} onClick={() => setEditing(true)}>
            Novo hábito
          </Button>
        </div>
      ) : (
        <ul className="mt-2.5 grid grid-cols-2 gap-2">
          {missions.map((m) => (
            <MissionTile key={m.id} m={m} onToggle={(x) => void toggle(x)} />
          ))}
        </ul>
      )}

      {total > 0 && (
        <p aria-live="polite" className={`mt-2.5 font-mono text-[11px] font-medium ${complete ? "text-lime" : "text-muted"}`}>
          {complete
            ? "Rotina completa"
            : total === 1
              ? "Falta 1 para completar a rotina."
              : `Faça as ${total} para completar a rotina.`}
        </p>
      )}

      {editing && data && (
        <MissionsSheet
          view={data}
          reload={reload}
          onClose={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
    </section>
  );
}
