import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import {
  formatKg,
  REPS_MAX,
  REST_MAX_S,
  REST_MIN_S,
  SET_XP,
  WEIGHT_ADJUST_G,
  WEIGHT_MAX_G,
  type SessionExercise,
  type SessionSummary,
  type SessionView,
  type SetPair,
} from "../../../shared/workout";
import { api, ApiError } from "../../lib/api";
import { beep, buzz, clockLabel, unlockAudio, useClock, useWakeLock } from "../../lib/workoutDevice";
import { kgText, restLabel } from "../../lib/workoutFormat";
import { Button, IconButton } from "../ui/Button";
import { CheckIcon, ChevronRightIcon, CloseIcon, StarIcon } from "../ui/Icon";
import { RestTimer } from "./RestTimer";
import { SessionSummaryView } from "./SessionSummary";

interface Props {
  /** Sessão já carregada (ao começar) ou só o id (ao continuar). */
  initial: SessionView | null;
  sessionId: string;
  sound: boolean;
  defaultRestS: number;
  /** Fecha a tela cheia (sessão aberta ou finalizada). */
  onClose: () => void;
}

/** Série apontada: índice do exercício e número da série (S1 = 1). */
type Cursor = { ex: number; set: number };
/** Descanso em curso: guardado como hora de término, nunca como contador. */
type Rest = { startedAt: number; endsAt: number; totalS: number; ex: number };
type Failed = { cursor: Cursor; values: SetPair; message: string };

const REST_KEY = (id: string) => `agenda.treino.descanso.${id}`;
/** Marca "a tela do treino estava aberta": ao reabrir o app, volta direto para ela. */
export const LIVE_KEY = "agenda.treino.aoVivo";

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* sem armazenamento (aba privada) */
    }
  },
};

const pairText = (p: SetPair) => `${kgText(p.weightG)} × ${p.reps}`;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Próxima série por fazer depois de `from` (dá a volta); null se tudo feito. */
function nextOpen(exercises: SessionExercise[], from: Cursor | null): Cursor | null {
  const all: Cursor[] = exercises.flatMap((e, ex) => (e.exerciseId ? e.sets.map((s) => ({ ex, set: s.setIndex })) : []));
  const open = (c: Cursor) => !exercises[c.ex].sets.find((s) => s.setIndex === c.set)?.done;
  const start = from ? all.findIndex((c) => c.ex === from.ex && c.set === from.set) + 1 : 0;
  for (let i = 0; i < all.length; i++) {
    const c = all[(start + i) % all.length];
    if (open(c)) return c;
  }
  return null;
}

function loadRest(id: string): Rest | null {
  const raw = storage.get(REST_KEY(id));
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Rest;
    return typeof r.endsAt === "number" && r.endsAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

/** Treino ao vivo em tela cheia (telas A, B e C do rascunho): série da vez, descanso e resumo. */
export function LiveSession({ initial, sessionId, sound: soundInitial, defaultRestS, onClose }: Props) {
  const [session, setSession] = useState<SessionView | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(() => (initial ? nextOpen(initial.exercises, null) : null));
  const [values, setValues] = useState<SetPair>({ weightG: 0, reps: 0 });
  const [rest, setRestState] = useState<Rest | null>(() => loadRest(sessionId));
  const [failed, setFailed] = useState<Failed | null>(null);
  const [saving, setSaving] = useState(false);
  const [sound, setSound] = useState(soundInitial);
  const [exitOpen, setExitOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [announce, setAnnounce] = useState("");
  /** Aviso de erro (o Toast do app fica atrás do modal). */
  const [notice, setNotice] = useState<string | null>(null);
  const now = useClock(!summary, 1000);
  const top = useRef<HTMLDivElement>(null);

  useWakeLock(!summary);

  // Marca a tela aberta para retomar ao reabrir o app.
  useEffect(() => {
    if (summary) return;
    storage.set(LIVE_KEY, sessionId);
  }, [sessionId, summary]);

  // Ao continuar, carrega a sessão do servidor.
  useEffect(() => {
    if (initial) return;
    let alive = true;
    api
      .workoutSession(sessionId)
      .then((s) => {
        if (!alive) return;
        setSession(s);
        setCursor(nextOpen(s.exercises, null));
      })
      .catch((e) => alive && setLoadError(e instanceof ApiError ? e.message : "Não foi possível abrir o treino."));
    return () => {
      alive = false;
    };
  }, [initial, sessionId]);

  const setRest = (r: Rest | null) => {
    setRestState(r);
    storage.set(REST_KEY(sessionId), r ? JSON.stringify(r) : null);
  };

  const exercise = session && cursor ? session.exercises[cursor.ex] : null;
  const slot = exercise && cursor ? exercise.sets.find((s) => s.setIndex === cursor.set) ?? null : null;

  // Valores dos steppers quando a série apontada muda.
  const slotKey = cursor ? `${cursor.ex}:${cursor.set}` : "";
  useEffect(() => {
    if (!slot) return;
    setValues(slot.done ? { weightG: slot.done.weightG, reps: slot.done.reps } : slot.prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, session?.id]);

  const totals = useMemo(() => {
    const list = session?.exercises.flatMap((e) => (e.exerciseId ? e.sets : [])) ?? [];
    return { all: list.length, done: list.filter((s) => s.done).length };
  }, [session]);

  if (summary) {
    return (
      <Shell>
        <SessionSummaryView
          summary={summary}
          onClose={() => {
            storage.set(LIVE_KEY, null);
            onClose();
          }}
        />
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="flex min-h-11 items-center">
          <IconButton label="Fechar treino" variant="secondary" icon={<CloseIcon size={20} strokeWidth={2.2} />} onClick={onClose} />
        </div>
        {loadError ? (
          <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {loadError}
          </p>
        ) : (
          <p role="status" className="mt-6 text-center text-sm text-muted">
            Abrindo o treino…
          </p>
        )}
      </Shell>
    );
  }

  const allDone = totals.all > 0 && totals.done === totals.all;
  const elapsed = clockLabel((now - Date.parse(session.startedAt)) / 1000);
  const restS = exercise ? (exercise.restS || defaultRestS) : defaultRestS;

  /** Atualiza a série na sessão local (otimista ou com a resposta). */
  const patchSlot = (c: Cursor, fn: (s: SessionExercise["sets"][number]) => SessionExercise["sets"][number]) =>
    setSession((prev) =>
      prev && {
        ...prev,
        exercises: prev.exercises.map((e, i) =>
          i === c.ex ? { ...e, sets: e.sets.map((s) => (s.setIndex === c.set ? fn(s) : s)) } : e,
        ),
      },
    );

  const save = async (c: Cursor, v: SetPair) => {
    const ex = session.exercises[c.ex];
    const before = ex.sets.find((s) => s.setIndex === c.set)!;
    const wasDone = !!before.done;
    unlockAudio();
    setFailed(null);
    setSaving(true);
    // Otimista: marca feita na hora e já segue para o descanso.
    const tmp = {
      id: before.done?.id ?? `tmp-${c.ex}-${c.set}`,
      sessionId: session.id,
      exerciseKey: ex.exerciseKey,
      exerciseName: ex.name,
      exercisePosition: ex.position,
      setIndex: c.set,
      weightG: v.weightG,
      reps: v.reps,
      doneAt: new Date().toISOString(),
    };
    const optimistic = session.exercises.map((e, i) =>
      i === c.ex ? { ...e, sets: e.sets.map((s) => (s.setIndex === c.set ? { ...s, done: tmp } : s)) } : e,
    );
    setSession({ ...session, exercises: optimistic });
    const next = nextOpen(optimistic, c);
    setCursor(next ?? c);
    if (!wasDone && next) {
      const t = Date.now();
      const total = clamp(ex.restS || defaultRestS, REST_MIN_S, REST_MAX_S);
      if (total > 0) setRest({ startedAt: t, endsAt: t + total * 1000, totalS: total, ex: c.ex });
    }
    top.current?.scrollIntoView({ block: "start" });
    try {
      const res = await api.logWorkoutSet(session.id, {
        exerciseId: ex.exerciseId!,
        setIndex: c.set,
        weightG: v.weightG,
        reps: v.reps,
      });
      patchSlot(c, (s) => ({ ...s, done: res.set, pr: res.pr }));
      setSession((prev) => prev && { ...prev, xp: res.sessionXp });
      setAnnounce(
        res.pr
          ? `Recorde em ${ex.name}! +${res.xp} XP`
          : `Série ${c.set} de ${ex.name} salva${res.xp ? `, +${res.xp} XP` : ""}.`,
      );
    } catch (e) {
      // Volta como estava e oferece tentar de novo.
      patchSlot(c, () => before);
      setRest(null);
      setCursor(c);
      setValues(v);
      setFailed({ cursor: c, values: v, message: e instanceof ApiError ? e.message : "Não foi possível salvar a série." });
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const s = await api.finishWorkoutSession(session.id);
      setRest(null);
      setExitOpen(false);
      setSummary(s);
      storage.set(LIVE_KEY, null);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Não foi possível finalizar o treino.");
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    setDiscarding(true);
    try {
      await api.discardWorkoutSession(session.id);
      setRest(null);
      storage.set(LIVE_KEY, null);
      onClose();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Não foi possível descartar o treino.");
      setDiscarding(false);
    }
  };

  const leave = () => {
    storage.set(LIVE_KEY, null);
    onClose();
  };

  const header = (
    <>
      <div className="flex min-h-11 items-center gap-2.5">
        <IconButton label="Sair do treino" variant="secondary" icon={<CloseIcon size={20} strokeWidth={2.2} />} onClick={() => setExitOpen(true)} />
        <p className="eyebrow min-w-0 flex-1 truncate !text-ink">
          {session.templateName} · <span className="tabular-nums" aria-label={`tempo de treino ${elapsed}`}>{elapsed}</span>
        </p>
        <span className="text-neon font-mono text-[14px] font-bold" aria-label={`${session.xp} XP ganhos`}>
          +{session.xp} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Séries feitas"
        aria-valuemin={0}
        aria-valuemax={totals.all}
        aria-valuenow={totals.done}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
      >
        <i
          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--green),var(--lime))] shadow-[0_0_10px_rgb(136_239_27/0.6)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${totals.all ? (totals.done / totals.all) * 100 : 0}%` }}
        />
      </div>
    </>
  );

  const exitSheet = exitOpen && (
    <div role="dialog" aria-modal="true" aria-labelledby="exit-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && setExitOpen(false)}>
      <div className="glass w-full max-w-md rounded-[22px] p-4" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <h2 id="exit-title" className="font-display text-lg font-bold">
          Sair do treino?
        </h2>
        <p className="mt-1 text-sm text-muted">As séries feitas já estão salvas. Você pode continuar depois.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="primary" className="!h-12" onClick={leave}>
            Continuar depois
          </Button>
          {totals.done > 0 && (
            <Button className="!h-12" busy={finishing} busyLabel="Finalizando…" onClick={() => void finish()}>
              Finalizar treino agora
            </Button>
          )}
          <Button variant="ghost" className="!h-12 !text-danger-ink" busy={discarding} busyLabel="Descartando…" onClick={() => void discard()}>
            Descartar treino
          </Button>
          <Button variant="ghost" className="!h-12" onClick={() => setExitOpen(false)}>
            Voltar ao treino
          </Button>
        </div>
      </div>
    </div>
  );

  const live = (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {notice && (
        <div role="alert" className="mt-3 flex items-center gap-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          <span className="flex-1">{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
            OK
          </Button>
        </div>
      )}
    </>
  );

  // ----- Descanso (tela B) -----
  if (rest && cursor) {
    const restEx = session.exercises[rest.ex];
    const nextEx = session.exercises[cursor.ex];
    const nextSlot = nextEx.sets.find((s) => s.setIndex === cursor.set);
    const nextValues = nextSlot ? (nextSlot.done ? nextSlot.done : nextSlot.prefill) : null;
    const lastDone = [...restEx.sets].reverse().find((s) => s.done);
    const adjustTo = (totalS: number) => {
      const t = clamp(totalS, REST_MIN_S, REST_MAX_S);
      setRest({ ...rest, totalS: t, endsAt: rest.startedAt + t * 1000 });
    };
    return (
      <Shell topRef={top} onCancel={() => setExitOpen(true)}>
        {live}
        <RestTimer
          endsAt={rest.endsAt}
          totalS={rest.totalS}
          exerciseName={restEx.name}
          savedRestS={restEx.restS}
          setLabel={`série ${lastDone?.setIndex ?? ""}`.trim()}
          next={nextValues ? { title: `${nextEx.name} · S${cursor.set}`, value: `${formatKg(nextValues.weightG)} × ${nextValues.reps}` } : null}
          sound={sound}
          onAdjust={(d) => adjustTo(rest.totalS + d)}
          onPreset={(s) => adjustTo(s)}
          onAlways={async () => {
            if (!session.templateId || !restEx.exerciseId) return;
            try {
              await api.updateWorkoutExercise(session.templateId, restEx.exerciseId, { restS: rest.totalS });
              setSession((prev) =>
                prev && { ...prev, exercises: prev.exercises.map((e, i) => (i === rest.ex ? { ...e, restS: rest.totalS } : e)) },
              );
            } catch (e) {
              setNotice(e instanceof ApiError ? e.message : "Não foi possível salvar o descanso.");
            }
          }}
          onSound={(on) => {
            setSound(on);
            api.updateWorkoutSettings({ sound: on }).catch(() => {
              setSound(!on);
              setNotice("Não foi possível salvar a preferência de som.");
            });
          }}
          onClose={() => setRest(null)}
          onEnd={() => {
            if (sound) {
              buzz();
              beep();
            }
            setRest(null);
          }}
        />
        {failed && <FailedAlert failed={failed} saving={saving} onRetry={() => void save(failed.cursor, failed.values)} />}
        {exitSheet}
      </Shell>
    );
  }

  // ----- Série da vez (tela A) -----
  const showEx = exercise ?? session.exercises[session.exercises.length - 1];
  const exIndex = session.exercises.indexOf(showEx);
  const lastSame = showEx.last?.sets.find((s) => s.setIndex === (cursor?.set ?? 1)) ?? showEx.last?.sets[0] ?? null;
  const upTarget = slot && !slot.done && showEx.suggestUp ? Math.min(WEIGHT_MAX_G, slot.prefill.weightG + WEIGHT_ADJUST_G) : null;
  const nextExercise = session.exercises.slice(exIndex + 1).find((e) => e.exerciseId);
  const editing = !!slot?.done;
  const lastOne = !editing && cursor !== null && nextOpen(session.exercises, cursor) === null;
  const ctaLabel = !cursor
    ? "Finalizar treino"
    : editing
      ? `Salvar série ${cursor.set}`
      : lastOne
        ? `Concluir série ${cursor.set}`
        : `Concluir série ${cursor.set} · descanso ${restLabel(restS)}`;

  return (
    <Shell topRef={top} onCancel={() => setExitOpen(true)}>
      {header}
      {live}
      <div className="mt-4 flex items-baseline gap-2">
        <h2 className="min-w-0 flex-1 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] break-words">{showEx.name}</h2>
        <span className="eyebrow">
          {exIndex + 1}/{session.exercises.length}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {lastSame ? (
          <>
            Última vez: <b className="font-mono text-ink">{formatKg(lastSame.weightG)} × {lastSame.reps}</b>
          </>
        ) : (
          <>Primeira vez: alvo {showEx.targetSets} × {showEx.targetReps}</>
        )}
        {upTarget !== null && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, weightG: upTarget }))}
              className="font-mono font-bold text-lime underline decoration-lime/40 underline-offset-2"
              aria-label={`Meta hoje: subir para ${formatKg(upTarget)}. Usar`}
            >
              meta hoje ↑ {formatKg(upTarget)}
            </button>
          </>
        )}
      </p>

      {cursor && slot && (
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <Stepper
            label="Peso"
            unit="kg"
            value={kgText(values.weightG)}
            hot
            minus={{ label: "Menos 2,5 kg", text: "−2,5", onClick: () => setValues((v) => ({ ...v, weightG: clamp(v.weightG - WEIGHT_ADJUST_G, 0, WEIGHT_MAX_G) })) }}
            plus={{ label: "Mais 2,5 kg", text: "+2,5", onClick: () => setValues((v) => ({ ...v, weightG: clamp(v.weightG + WEIGHT_ADJUST_G, 0, WEIGHT_MAX_G) })) }}
          />
          <Stepper
            label="Repetições"
            value={String(values.reps)}
            minus={{ label: "Menos 1 repetição", text: "−1", onClick: () => setValues((v) => ({ ...v, reps: clamp(v.reps - 1, 0, REPS_MAX) })) }}
            plus={{ label: "Mais 1 repetição", text: "+1", onClick: () => setValues((v) => ({ ...v, reps: clamp(v.reps + 1, 0, REPS_MAX) })) }}
          />
        </div>
      )}

      <ol aria-label={`Séries de ${showEx.name}`} className="glass-quiet mt-3 overflow-hidden rounded-[22px]">
        {showEx.sets.map((s) => {
          const now = cursor?.ex === exIndex && cursor.set === s.setIndex;
          const pair = s.done ?? (now ? values : null);
          return (
            <li key={s.setIndex} className="border-line [&+&]:border-t">
              <button
                type="button"
                disabled={!showEx.exerciseId}
                aria-current={now ? "step" : undefined}
                onClick={() => setCursor({ ex: exIndex, set: s.setIndex })}
                className={`grid min-h-12 w-full grid-cols-[2.25rem_1fr_auto_auto] items-center gap-2 px-3.5 py-2 text-left font-mono text-[13px] ${
                  now ? "bg-lime/[0.07]" : "hover:bg-white/[0.03]"
                }`}
              >
                <span className={`text-[11px] font-bold ${now ? "text-lime" : "text-muted"}`}>S{s.setIndex}</span>
                <span className={pair ? "font-bold" : "text-muted"}>{pair ? pairText(pair) : "— × —"}</span>
                <span className="text-[11px] text-muted">{s.previous ? `antes ${kgText(s.previous.weightG)}×${s.previous.reps}` : ""}</span>
                <span className="min-w-[5.5rem] text-right text-[11px] font-bold">
                  {s.done && s.pr ? (
                    <span className="inline-flex items-center gap-0.5 text-[#ffd34d] [text-shadow:0_0_8px_rgb(255_190_60/0.6)]">
                      <StarIcon size={11} fill="currentColor" aria-hidden /> RECORDE
                    </span>
                  ) : s.done ? (
                    <span className="inline-flex items-center gap-0.5 text-lime">
                      <CheckIcon size={12} strokeWidth={3} aria-label="feita" /> +{SET_XP}
                    </span>
                  ) : now ? (
                    <span className="text-lime">AGORA</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {failed && <FailedAlert failed={failed} saving={saving} onRetry={() => void save(failed.cursor, failed.values)} />}

      {allDone && !editing ? (
        <Button variant="primary" className="mt-3.5 !h-14 w-full !rounded-[18px] text-base font-extrabold" busy={finishing} busyLabel="Finalizando…" onClick={() => void finish()}>
          Finalizar treino
        </Button>
      ) : (
        cursor && (
          <Button
            variant="primary"
            className="mt-3.5 !h-14 w-full !rounded-[18px] text-base font-extrabold"
            disabled={saving && !failed}
            onClick={() => void save(cursor, values)}
          >
            {ctaLabel}
          </Button>
        )
      )}
      {allDone && editing && (
        <Button className="mt-2 !h-12 w-full" busy={finishing} busyLabel="Finalizando…" onClick={() => void finish()}>
          Finalizar treino
        </Button>
      )}

      {nextExercise && (
        <p className="glass-quiet mt-3 flex items-center gap-2 rounded-2xl px-3.5 py-3 text-[13px] text-muted">
          <ChevronRightIcon size={18} aria-hidden />
          <span className="min-w-0 flex-1">
            Depois: <b className="text-ink">{nextExercise.name}</b> · {nextExercise.sets[0] ? `${formatKg(nextExercise.sets[0].prefill.weightG)} × ${nextExercise.sets[0].prefill.reps}` : ""}
          </span>
        </p>
      )}
      {exitSheet}
    </Shell>
  );
}

/**
 * Tela cheia como <dialog> modal: fica por cima da barra de baixo e o resto do app fica inerte.
 * Esc pede a confirmação de saída (onCancel).
 */
function Shell({ children, topRef, onCancel }: { children: ReactNode; topRef?: Ref<HTMLDivElement>; onCancel?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-bg p-0 text-ink backdrop:bg-bg"
      style={{ overscrollBehavior: "contain" }}
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
    >
      <div
        ref={topRef}
        className="mx-auto w-full max-w-md px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        }}
        aria-label="Treino ao vivo"
        role="region"
      >
        {children}
      </div>
    </dialog>
  );
}

function Stepper({
  label,
  unit,
  value,
  hot = false,
  minus,
  plus,
}: {
  label: string;
  unit?: string;
  value: string;
  hot?: boolean;
  minus: { label: string; text: string; onClick: () => void };
  plus: { label: string; text: string; onClick: () => void };
}) {
  return (
    <div className={`${hot ? "glass ring-1 ring-lime/40" : "glass-quiet"} rounded-[22px] p-3 text-center`}>
      <p className="eyebrow">{label}</p>
      <output aria-label={label} className="mt-1 block font-display text-[40px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[14px] font-semibold text-muted">{unit}</span>}
      </output>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {[minus, plus].map((b) => (
          <button
            key={b.text}
            type="button"
            aria-label={b.label}
            onClick={b.onClick}
            className="no-select min-h-12 rounded-xl border border-line bg-white/5 font-mono text-[15px] font-bold active:bg-white/10"
          >
            {b.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function FailedAlert({ failed, saving, onRetry }: { failed: Failed; saving: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-3 flex items-center gap-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
      <span className="flex-1">
        {failed.message} (S{failed.cursor.set}: {pairText(failed.values)})
      </span>
      <Button size="sm" busy={saving} onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
