import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ATTRIBUTE_LABEL, MISSION_XP, type AttributeId, type MissionXp, type MissionDay, type MissionsDayView } from "../../../shared/hero";
import { MISSION_TITLE_MAX, MISSIONS_ACTIVE_MAX } from "../../../shared/limits";
import { api, ApiError } from "../../lib/api";
import { plural } from "../../lib/format";
import { ATTRIBUTE_ICON, ATTRIBUTE_OPTIONS } from "../hero/attributes";
import { showToast } from "../Toast";
import { Button, IconButton } from "../ui/Button";
import { ArchiveIcon, ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon, PlusIcon } from "../ui/Icon";

interface Props {
  view: MissionsDayView;
  reload: () => Promise<void>;
  onClose: () => void;
}

const LOCKED_HINT = "Arquive e crie outra para mudar o XP.";
const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

/** Formulário de missão nova ou existente. XP e atributo travam depois da primeira marcação. */
function MissionForm({
  mission,
  onDone,
  onCancel,
}: {
  mission: MissionDay | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const [title, setTitle] = useState(mission?.title ?? "");
  const [attribute, setAttribute] = useState<AttributeId>(mission?.attribute ?? "mental");
  const [xp, setXp] = useState<MissionXp>((mission?.xp ?? 10) as MissionXp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!mission?.hasChecks;
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError("Informe um título.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mission) {
        await api.updateMission(mission.id, locked ? { title: t } : { title: t, attribute, xp });
        showToast("Hábito salvo");
      } else {
        await api.createMission({ title: t, attribute, xp });
        showToast("Hábito criado");
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-4" noValidate>
      <div>
        <label htmlFor={`${ids}-t`} className="eyebrow mb-1.5 block">
          Título
        </label>
        <input
          ref={titleRef}
          id={`${ids}-t`}
          value={title}
          maxLength={MISSION_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Alongar 5 min"
          className="glass-quiet h-12 w-full rounded-xl px-3.5 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids}-e` : undefined}
        />
      </div>

      <fieldset disabled={locked} aria-describedby={locked ? `${ids}-l` : undefined}>
        <legend className="eyebrow mb-1.5">Atributo</legend>
        <div role="radiogroup" aria-label="Atributo" className="flex flex-wrap gap-1.5">
          {ATTRIBUTE_OPTIONS.map(({ id, label }) => {
            const Icon = ATTRIBUTE_ICON[id];
            const on = attribute === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAttribute(id)}
                className={`flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold disabled:opacity-50 ${
                  on ? "fill-neon" : "glass-quiet text-ink"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={locked} aria-describedby={locked ? `${ids}-l` : undefined}>
        <legend className="eyebrow mb-1.5">XP por dia</legend>
        <div role="radiogroup" aria-label="XP por dia" className="grid grid-cols-5 gap-1.5">
          {MISSION_XP.map((v) => {
            const on = xp === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`+${v} XP`}
                onClick={() => setXp(v)}
                className={`h-11 rounded-xl font-mono text-[14px] font-bold disabled:opacity-50 ${on ? "fill-neon" : "glass-quiet text-ink"}`}
              >
                +{v}
              </button>
            );
          })}
        </div>
        {locked && (
          <p id={`${ids}-l`} className="mt-1.5 text-[12.5px] text-muted">
            {LOCKED_HINT}
          </p>
        )}
      </fieldset>

      {error && (
        <p id={`${ids}-e`} role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" busy={busy} busyLabel="Salvando…">
          {mission ? "Salvar" : "Criar hábito"}
        </Button>
      </div>
    </form>
  );
}

/** "Editar missões" (folha): renomear, reordenar, arquivar e criar. */
export function MissionsSheet({ view, reload, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  /** null = lista; "new" = missão nova; senão a missão em edição. */
  const [form, setForm] = useState<"new" | MissionDay | null>(null);
  const [order, setOrder] = useState<MissionDay[]>(view.missions);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => setOrder(view.missions), [view.missions]);

  const move = async (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= order.length || busy) return;
    const before = order;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setBusy(true);
    try {
      await api.reorderMissions(next.map((m) => m.id));
      await reload();
    } catch (e) {
      setOrder(before);
      showToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (m: MissionDay) => {
    setBusy(true);
    try {
      const { deleted } = await api.archiveMission(m.id);
      await reload();
      showToast(deleted ? `Hábito "${m.title}" apagado` : `Hábito "${m.title}" arquivado`, {
        label: "Desfazer",
        onClick: () =>
          void (async () => {
            try {
              if (deleted) await api.createMission({ title: m.title, attribute: m.attribute, xp: m.xp as MissionXp });
              else await api.restoreMission(m.id);
              await reload();
            } catch (e) {
              showToast(errorMessage(e));
            }
          })(),
      });
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const full = order.length >= MISSIONS_ACTIVE_MAX;
  const heading = form === "new" ? "Novo hábito" : form ? "Editar hábito" : "Rotina do dia";

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="missions-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (form) setForm(null);
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="px-4 pt-2.5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex min-h-11 items-center gap-2">
          {form && (
            <IconButton
              label="Voltar para a rotina"
              variant="secondary"
              icon={<ChevronLeftIcon size={20} strokeWidth={2.2} />}
              onClick={() => setForm(null)}
            />
          )}
          <h2 id="missions-sheet-title" className="eyebrow flex-1 !text-ink">
            {heading}
          </h2>
          <Button variant="ghost" size="sm" className="!text-lime" onClick={onClose}>
            Pronto
          </Button>
        </div>

        {form ? (
          <MissionForm
            key={form === "new" ? "new" : form.id}
            mission={form === "new" ? null : form}
            onCancel={() => setForm(null)}
            onDone={() => {
              setForm(null);
              void reload();
            }}
          />
        ) : (
          <>
            <p className="mt-1 text-[13px] text-muted">
              Hábitos de todo dia. Cada uma tem XP fixo e um atributo; fazer todas acende a janela do dia na torre.
            </p>
            {order.length > 0 ? (
              <ul aria-label="Hábitos da rotina" className="glass-quiet mt-3 overflow-hidden rounded-[20px]">
                {order.map((m, i) => {
                  const Icon = ATTRIBUTE_ICON[m.attribute];
                  return (
                    <li key={m.id} className="flex items-center gap-1 border-b border-line py-1 pr-1 pl-3 last:border-b-0">
                      <Icon size={18} className="text-lime" />
                      <button
                        type="button"
                        aria-haspopup="true"
                        onClick={() => setForm(m)}
                        className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span className="block text-[15px] font-medium break-words">{m.title}</span>
                        <span className="font-mono text-[11px] text-muted">
                          +{m.xp} XP · {ATTRIBUTE_LABEL[m.attribute]}
                          {m.streak > 0 && ` · ${plural(m.streak, "dia", "dias")}`}
                        </span>
                      </button>
                      <IconButton
                        label={`Subir ${m.title}`}
                        size="sm"
                        icon={<ChevronUpIcon size={18} />}
                        disabled={i === 0 || busy}
                        onClick={() => void move(i, -1)}
                      />
                      <IconButton
                        label={`Descer ${m.title}`}
                        size="sm"
                        icon={<ChevronDownIcon size={18} />}
                        disabled={i === order.length - 1 || busy}
                        onClick={() => void move(i, 1)}
                      />
                      <IconButton
                        label={`Arquivar ${m.title}`}
                        size="sm"
                        icon={<ArchiveIcon size={18} />}
                        disabled={busy}
                        onClick={() => void archive(m)}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="glass-quiet mt-3 rounded-[20px] px-4 py-5 text-center text-sm text-muted">Nenhum hábito na rotina.</p>
            )}
            <Button
              className="mt-3 w-full"
              icon={<PlusIcon size={18} />}
              disabled={full}
              onClick={() => setForm("new")}
            >
              Novo hábito
            </Button>
            <p className="mt-2 text-center text-[12px] text-muted">
              {full
                ? `No máximo ${MISSIONS_ACTIVE_MAX} hábitos na rotina. Arquive um para criar outro.`
                : "Arquivar guarda o histórico e o XP já ganho."}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
