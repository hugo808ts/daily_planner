import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatDayTitle, todayISO } from "../../shared/dates";
import { FOLDER_NAME_MAX, IDEA_TITLE_MAX, TASK_TITLE_MAX } from "../../shared/limits";
import type { Area, CaptureResult, Folder, Idea, Task } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { shortDay } from "../lib/format";
import { FolderGlyph } from "./FolderGrid";
import { FolderIconPicker } from "./FolderIconPicker";
import { XP_BY_DIFFICULTY, type Difficulty } from "../../shared/xp";
import { AREA_ORDER, AreaTag, areaMeta } from "./ui/AreaTag";
import { Button } from "./ui/Button";
import { DIFFICULTY_ORDER, DifficultyTag, difficultyMeta } from "./ui/DifficultyTag";
import { CalendarIcon, CheckIcon, ClockIcon, FolderIcon, LightbulbIcon, PencilIcon, PlusIcon } from "./ui/Icon";

export type SavedItem = { kind: "task"; task: Task } | { kind: "idea"; idea: Idea };

interface Props {
  initial: CaptureResult;
  /** Texto original (digitado ou transcrito), mostrado entre aspas. */
  said?: string;
  onClose: () => void;
  onSaved: (item: SavedItem) => void;
}

type Field = "title" | "date" | "time" | "area" | "difficulty" | "folder";

const FIELD =
  "block w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink focus-visible:border-accent aria-invalid:border-danger";
const LABEL = "mb-1 block text-sm font-medium";
const ERROR = "mt-1 text-sm text-danger-ink";
const OPTION = (on: boolean) =>
  `no-select inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors duration-150 motion-reduce:transition-none ${
    on
      ? "border-accent bg-accent-soft font-semibold text-accent-ink"
      : "border-line bg-surface text-ink hover:border-dot active:bg-ink/5"
  }`;

/** Toque (sem mouse) abriria o teclado e cobriria a folha: autoFocus só com ponteiro fino. */
const canAutoFocus = () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;

/** "Amanhã" + "qui 29", ou "Sexta" + "30 out". */
function dayParts(date: string, today: string): [string, string] {
  const title = formatDayTitle(date, today);
  if (!title.includes(",")) return [title, shortDay(date)];
  const [day, rest] = title.split(", ");
  return [day, rest];
}

function Chip({ label, open, onClick, children }: { label: string; open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      className={`no-select inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors duration-150 hover:border-dot active:bg-ink/5 motion-reduce:transition-none ${
        open ? "border-accent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      {children}
      <PencilIcon size={12} className="ml-0.5 opacity-50" />
    </button>
  );
}

/** Grupo de opções com seta ←/→/↑/↓ movendo a escolha (padrão WAI-ARIA de radiogroup). */
function RadioGroup({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const at = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = radios[(at + dir + radios.length) % radios.length];
    next.focus();
    next.click();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={className}>
      {children}
    </div>
  );
}

/** Folha que mostra o que a captura entendeu; cada pedaço é tocável para corrigir antes de salvar. */
export function ConfirmSheet({ initial, said, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const today = todayISO();

  const [kind, setKind] = useState(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date ?? today);
  const [time, setTime] = useState(initial.time ?? "");
  const [area, setArea] = useState<Area | null>(initial.area);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty ?? "medium");
  const [folderId, setFolderId] = useState(initial.folderId);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [foldersError, setFoldersError] = useState(false);
  const [foldersTry, setFoldersTry] = useState(0);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderIcon, setFolderIcon] = useState<string | null>(null);
  const [open, setOpen] = useState<Field | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const isTask = kind === "task";
  const noFolders = folders !== null && folders.length === 0;
  const creatingFolder = !isTask && (newFolder || noFolders);
  const show = (f: Field) => open === "all" || open === f;
  const toggle = (f: Field) => setOpen((o) => (o === f ? null : f));

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Falha ao carregar não é "sem pastas": mostra o erro com "Tentar de novo".
  useEffect(() => {
    let alive = true;
    setFoldersError(false);
    api
      .folders()
      .then((list) => alive && setFolders(list))
      .catch(() => alive && setFoldersError(true));
    return () => {
      alive = false;
    };
  }, [foldersTry]);

  /** Enquanto salva, Esc e toque fora não fecham (o pedido já foi enviado). */
  const close = () => {
    if (!busy) onClose();
  };

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      setError(e.message);
      setFields(e.fields ?? {});
      if (e.fields?.title) setOpen("title");
    } else {
      setError("Algo deu errado. Tente de novo.");
    }
  };

  const saveTask = async () => {
    const task = await api.createTask({ title, date, time: time || null, area, difficulty });
    onSaved({ kind: "task", task });
  };

  const saveIdea = async () => {
    let target = folderId;
    if (creatingFolder) {
      if (!folderName.trim()) {
        setFields({ name: "Dê um nome à pasta." });
        return;
      }
      const folder = await api.createFolder({ name: folderName, emoji: folderIcon });
      // Se a ideia falhar depois, a pasta já existe e fica escolhida (sem duplicar ao tentar de novo).
      setFolders((list) => [...(list ?? []), folder]);
      setFolderId(folder.id);
      setNewFolder(false);
      setFolderName("");
      setFolderIcon(null);
      target = folder.id;
    }
    if (!target) {
      setFields({ folder: "Escolha uma pasta." });
      setOpen("folder");
      return;
    }
    const idea = await api.createIdea({ folderId: target, title });
    onSaved({ kind: "idea", idea });
  };

  const save = async () => {
    if (!title.trim()) {
      setFields({ title: "Escreva um título." });
      setOpen("title");
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await (isTask ? saveTask() : saveIdea());
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const chooseKind = (k: typeof kind) => {
    if (k === kind) return;
    setKind(k);
    setOpen(null);
    setFields({});
    setError(null);
  };

  const folder = folders?.find((f) => f.id === folderId) ?? null;
  const [dayStrong, dayRest] = dayParts(date, today);
  const titleMax = isTask ? TASK_TITLE_MAX : IDEA_TITLE_MAX;
  const focusOk = canAutoFocus();

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="confirm-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="px-5 pt-2.5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <h2 id="confirm-sheet-title" className="sr-only">
          Confirmar captura
        </h2>
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />

        {said && <p className="mb-3 text-sm break-words text-pretty text-muted italic">“{said}”</p>}

        <RadioGroup label="Tipo" className="mb-3 inline-flex rounded-xl bg-ink/[0.06] p-0.5">
          {(
            [
              ["task", "Tarefa", CheckIcon],
              ["idea", "Ideia", LightbulbIcon],
            ] as const
          ).map(([k, text, Icon]) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => chooseKind(k)}
                className={`no-select inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                  on ? "bg-surface text-accent-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {text}
              </button>
            );
          })}
        </RadioGroup>

        {show("title") ? (
          <div className="mb-3">
            <label htmlFor="confirm-title" className={LABEL}>
              Título
            </label>
            <input
              id="confirm-title"
              name="title"
              autoComplete="off"
              value={title}
              maxLength={titleMax}
              enterKeyHint="done"
              autoFocus={focusOk && open === "title"}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={fields.title ? true : undefined}
              aria-describedby={fields.title ? "confirm-title-error" : undefined}
              className={FIELD}
            />
            {fields.title && (
              <p id="confirm-title-error" role="alert" className={ERROR}>
                {fields.title}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Título: ${title}. Tocar para editar`}
            onClick={() => toggle("title")}
            className="mb-3 block w-full text-left text-lg leading-snug font-semibold break-words text-pretty hover:text-accent-ink active:opacity-70"
          >
            {title}
          </button>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {isTask ? (
            <>
              <Chip label={`Dia: ${dayStrong}, ${dayRest}`} open={show("date")} onClick={() => toggle("date")}>
                <CalendarIcon size={16} />
                <span>
                  <b className="font-semibold">{dayStrong}</b>, {dayRest}
                </span>
              </Chip>
              <Chip label={`Horário: ${time || "sem horário"}`} open={show("time")} onClick={() => toggle("time")}>
                <ClockIcon size={16} />
                {time ? <b className="font-semibold">{time}</b> : <span className="text-muted">Sem horário</span>}
              </Chip>
              <Chip
                label={`Área: ${area ? areaMeta(area).label : "sem área"}`}
                open={show("area")}
                onClick={() => toggle("area")}
              >
                {area ? <AreaTag area={area} className="font-semibold" /> : <span className="text-muted">Sem área</span>}
              </Chip>
              <Chip
                label={`Dificuldade: ${difficultyMeta(difficulty).label}, ${XP_BY_DIFFICULTY[difficulty]} XP`}
                open={show("difficulty")}
                onClick={() => toggle("difficulty")}
              >
                <DifficultyTag difficulty={difficulty} xp={XP_BY_DIFFICULTY[difficulty]} />
              </Chip>
            </>
          ) : foldersError ? (
            <div role="alert" className="flex w-full items-center justify-between gap-2 rounded-xl bg-danger-soft py-1 pr-1 pl-3 text-sm text-danger-ink">
              <span>Não foi possível carregar as pastas.</span>
              <Button variant="danger" size="sm" onClick={() => setFoldersTry((n) => n + 1)}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            !noFolders && (
              <Chip
                label={`Pasta: ${folder ? folder.name : "escolher"}`}
                open={show("folder")}
                onClick={() => toggle("folder")}
              >
                <FolderGlyph folder={folder ?? { id: "", emoji: null }} size={20} plain />
                {folder ? (
                  <span className="min-w-0 break-words">
                    Pasta: <b className="font-semibold">{folder.name}</b>
                  </span>
                ) : (
                  <span className="text-muted">{folders === null ? "Carregando pastas…" : "Escolher pasta"}</span>
                )}
              </Chip>
            )
          )}
        </div>

        {isTask && show("date") && (
          <div className="mb-4">
            <label htmlFor="confirm-date" className={LABEL}>
              Dia
            </label>
            <input
              id="confirm-date"
              name="date"
              autoComplete="off"
              type="date"
              value={date}
              min={today}
              required
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-invalid={fields.date ? true : undefined}
              aria-describedby={fields.date ? "confirm-date-error" : undefined}
              className={FIELD}
            />
            {fields.date && (
              <p id="confirm-date-error" role="alert" className={ERROR}>
                {fields.date}
              </p>
            )}
          </div>
        )}

        {isTask && show("time") && (
          <div className="mb-4">
            <label htmlFor="confirm-time" className={LABEL}>
              Horário <span className="font-normal text-muted">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="confirm-time"
                name="time"
                autoComplete="off"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={fields.time ? true : undefined}
                aria-describedby={fields.time ? "confirm-time-error" : undefined}
                className={`${FIELD} min-w-0 flex-1`}
              />
              {time && (
                <button type="button" onClick={() => setTime("")} className={OPTION(false)}>
                  Sem horário
                </button>
              )}
            </div>
            {fields.time && (
              <p id="confirm-time-error" role="alert" className={ERROR}>
                {fields.time}
              </p>
            )}
          </div>
        )}

        {isTask && show("area") && (
          <RadioGroup label="Área" className="mb-4 flex flex-wrap gap-2">
            {[...AREA_ORDER.map((a) => areaMeta(a)), null].map((m) => {
              const value = m ? m.area : null;
              const on = area === value;
              return (
                <button
                  key={value ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setArea(value)}
                  className={OPTION(on)}
                >
                  {m && <m.Icon size={16} />}
                  {m ? m.label : "Sem área"}
                </button>
              );
            })}
          </RadioGroup>
        )}

        {isTask && show("difficulty") && (
          <RadioGroup label="Dificuldade" className="mb-4 grid grid-cols-3 gap-2">
            {DIFFICULTY_ORDER.map((d) => {
              const m = difficultyMeta(d);
              const on = difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setDifficulty(d)}
                  className={`no-select flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                    on ? `border-2 font-semibold ${m.className}` : "border-line bg-surface text-ink hover:border-dot active:bg-ink/5"
                  }`}
                >
                  <m.Icon size={16} strokeWidth={2.5} />
                  <span>{m.label}</span>
                  <span className="text-meta font-normal opacity-80">{XP_BY_DIFFICULTY[d]} XP</span>
                </button>
              );
            })}
          </RadioGroup>
        )}

        {!isTask && !creatingFolder && show("folder") && folders && (
          <RadioGroup label="Pasta" className="mb-4 flex flex-wrap gap-2">
              {folders.map((f, i) => {
                const on = folderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on || (!folders.some((x) => x.id === folderId) && i === 0) ? 0 : -1}
                    aria-describedby={fields.folder ? "confirm-folder-pick-error" : undefined}
                    onClick={() => {
                      setFolderId(f.id);
                      setFields({});
                    }}
                    className={`${OPTION(on)} max-w-full break-words`}
                  >
                    <FolderGlyph folder={f} size={20} plain />
                    {f.name}
                  </button>
                );
              })}
            <Button variant="ghost" size="sm" icon={<PlusIcon size={16} />} onClick={() => setNewFolder(true)}>
              Nova pasta
            </Button>
          </RadioGroup>
        )}
        {fields.folder && !creatingFolder && (
          <p id="confirm-folder-pick-error" role="alert" className={`-mt-2 mb-4 ${ERROR}`}>
            {fields.folder}
          </p>
        )}

        {creatingFolder && (
          <fieldset className="mb-4 rounded-2xl bg-bg p-3">
            <legend className="float-left mb-2 w-full text-sm font-semibold">
              {noFolders ? "Crie sua primeira pasta" : "Nova pasta"}
            </legend>
            {noFolders && <p className="mb-3 text-sm text-muted">Toda ideia mora numa pasta. Dê um nome para guardar esta.</p>}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="confirm-folder-name" className="sr-only">
                  Nome da pasta
                </label>
                <input
                  id="confirm-folder-name"
                  name="folder-name"
                  autoComplete="off"
                  value={folderName}
                  maxLength={FOLDER_NAME_MAX}
                  placeholder="Nome da pasta, ex.: Estudos…"
                  enterKeyHint="done"
                  autoFocus={focusOk && !noFolders}
                  aria-invalid={fields.name ? true : undefined}
                  aria-describedby={fields.name ? "confirm-folder-error" : undefined}
                  onChange={(e) => setFolderName(e.target.value)}
                  className={FIELD}
                />
              </div>
            </div>
            <FolderIconPicker value={folderIcon} onChange={setFolderIcon} className="mt-3" />
            {(fields.name || fields.emoji) && (
              <p id="confirm-folder-error" role="alert" className={ERROR}>
                {fields.name ?? fields.emoji}
              </p>
            )}
            {!noFolders && (
              <button
                type="button"
                onClick={() => {
                  setNewFolder(false);
                  setFields({});
                }}
                className="mt-1 -mb-1 rounded-xl px-1 text-sm text-muted hover:text-ink active:text-ink"
              >
                Escolher uma pasta existente
              </button>
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => setOpen((o) => (o === "all" ? null : "all"))}
          >
            {open === "all" ? "Ocultar" : "Editar tudo"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            busy={busy}
            busyLabel="Salvando…"
            disabled={!isTask && folders === null}
          >
            {isTask ? `Salvar · ${XP_BY_DIFFICULTY[difficulty]} XP` : "Guardar"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
