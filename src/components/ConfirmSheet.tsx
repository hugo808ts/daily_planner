import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDayTitle, todayISO } from "../../shared/dates";
import { FOLDER_NAME_MAX, IDEA_TITLE_MAX, TASK_TITLE_MAX } from "../../shared/limits";
import type { Area, CaptureResult, Folder, Idea, Task } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { AREAS, areaInfo, shortDay } from "../lib/format";

export type SavedItem = { kind: "task"; task: Task } | { kind: "idea"; idea: Idea };

interface Props {
  initial: CaptureResult;
  /** Texto original (digitado ou transcrito), mostrado entre aspas. */
  said?: string;
  onClose: () => void;
  onSaved: (item: SavedItem) => void;
}

type Field = "title" | "date" | "time" | "area" | "folder";

const FIELD =
  "block w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink focus:border-accent focus:outline-none aria-invalid:border-danger";
const LABEL = "mb-1 block text-sm font-medium";
const OPTION = (on: boolean) =>
  `rounded-xl px-3 text-sm transition-colors duration-150 ${on ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink active:bg-ink/10"}`;

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
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors duration-150 active:bg-ink/5 ${
        open ? "border-accent bg-accent/5" : "border-line"
      }`}
    >
      {children}
      <span aria-hidden className="ml-0.5 text-xs opacity-40">
        ✎
      </span>
    </button>
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
  const [folderId, setFolderId] = useState(initial.folderId);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderEmoji, setFolderEmoji] = useState("");
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

  useEffect(() => {
    let alive = true;
    api
      .folders()
      .then((list) => alive && setFolders(list))
      .catch(() => alive && setFolders([]));
    return () => {
      alive = false;
    };
  }, []);

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
    const task = await api.createTask({ title, date, time: time || null, area });
    onSaved({ kind: "task", task });
  };

  const saveIdea = async () => {
    let target = folderId;
    if (creatingFolder) {
      if (!folderName.trim()) {
        setFields({ name: "Dê um nome à pasta." });
        return;
      }
      const folder = await api.createFolder({ name: folderName, emoji: folderEmoji.trim() || null });
      // Se a ideia falhar depois, a pasta já existe e fica escolhida (sem duplicar ao tentar de novo).
      setFolders((list) => [...(list ?? []), folder]);
      setFolderId(folder.id);
      setNewFolder(false);
      setFolderName("");
      setFolderEmoji("");
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

  const switchKind = () => {
    setKind((k) => (k === "task" ? "idea" : "task"));
    setOpen(null);
    setFields({});
    setError(null);
  };

  const folder = folders?.find((f) => f.id === folderId) ?? null;
  const [dayStrong, dayRest] = dayParts(date, today);
  const titleMax = isTask ? TASK_TITLE_MAX : IDEA_TITLE_MAX;

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="confirm-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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

        {said && <p className="mb-3 text-sm text-muted italic">“{said}”</p>}

        <button
          type="button"
          aria-label={`Tipo: ${isTask ? "Tarefa" : "Ideia"}. Tocar para trocar`}
          onClick={switchKind}
          className={`mb-2 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 ${
            isTask ? "bg-accent/12 text-accent" : "bg-note text-note-ink"
          }`}
        >
          <span>{isTask ? "✓ Tarefa" : "💡 Ideia"}</span>
          <span aria-hidden className="text-xs font-normal opacity-60">
            ⇄
          </span>
        </button>

        {show("title") ? (
          <div className="mb-3">
            <label htmlFor="confirm-title" className={LABEL}>
              Título
            </label>
            <input
              id="confirm-title"
              value={title}
              maxLength={titleMax}
              enterKeyHint="done"
              autoFocus={open === "title"}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={fields.title ? true : undefined}
              aria-describedby={fields.title ? "confirm-title-error" : undefined}
              className={FIELD}
            />
            {fields.title && (
              <p id="confirm-title-error" className="mt-1 text-sm text-danger-ink">
                {fields.title}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Título: ${title}. Tocar para editar`}
            onClick={() => toggle("title")}
            className="mb-3 block w-full text-left text-lg leading-snug font-semibold active:opacity-70"
          >
            {title}
          </button>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {isTask ? (
            <>
              <Chip label={`Dia: ${dayStrong}, ${dayRest}`} open={show("date")} onClick={() => toggle("date")}>
                <span aria-hidden>📅</span>
                <span>
                  <b className="font-semibold">{dayStrong}</b>, {dayRest}
                </span>
              </Chip>
              <Chip label={`Horário: ${time || "sem horário"}`} open={show("time")} onClick={() => toggle("time")}>
                <span aria-hidden>🕙</span>
                {time ? <b className="font-semibold">{time}</b> : <span className="text-muted">Sem horário</span>}
              </Chip>
              <Chip
                label={`Área: ${area ? areaInfo(area).label : "sem área"}`}
                open={show("area")}
                onClick={() => toggle("area")}
              >
                {area ? (
                  <>
                    <span aria-hidden>{areaInfo(area).emoji}</span>
                    <b className="font-semibold">{areaInfo(area).label}</b>
                  </>
                ) : (
                  <span className="text-muted">Sem área</span>
                )}
              </Chip>
            </>
          ) : (
            !noFolders && (
              <Chip
                label={`Pasta: ${folder ? folder.name : "escolher"}`}
                open={show("folder")}
                onClick={() => toggle("folder")}
              >
                <span aria-hidden>{folder?.emoji || "🗂"}</span>
                {folder ? (
                  <span>
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
              type="date"
              value={date}
              required
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-invalid={fields.date ? true : undefined}
              className={FIELD}
            />
            {fields.date && <p className="mt-1 text-sm text-danger-ink">{fields.date}</p>}
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
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={fields.time ? true : undefined}
                className={`${FIELD} min-w-0 flex-1`}
              />
              {time && (
                <button type="button" onClick={() => setTime("")} className={OPTION(false)}>
                  Sem horário
                </button>
              )}
            </div>
            {fields.time && <p className="mt-1 text-sm text-danger-ink">{fields.time}</p>}
          </div>
        )}

        {isTask && show("area") && (
          <div role="radiogroup" aria-label="Área" className="mb-4 flex flex-wrap gap-2">
            {[...AREAS, { value: null, label: "Sem área", emoji: "" }].map((a) => (
              <button
                key={a.label}
                type="button"
                role="radio"
                aria-checked={area === a.value}
                onClick={() => setArea(a.value)}
                className={OPTION(area === a.value)}
              >
                {a.emoji && <span aria-hidden>{a.emoji} </span>}
                {a.label}
              </button>
            ))}
          </div>
        )}

        {!isTask && !creatingFolder && show("folder") && folders && (
          <div role="radiogroup" aria-label="Pasta" className="mb-4 flex flex-wrap gap-2">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={folderId === f.id}
                onClick={() => {
                  setFolderId(f.id);
                  setFields({});
                }}
                className={OPTION(folderId === f.id)}
              >
                {f.emoji && <span aria-hidden>{f.emoji} </span>}
                {f.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNewFolder(true)}
              className="rounded-xl bg-accent/10 px-3 text-sm font-semibold text-accent active:bg-accent/20"
            >
              + Nova pasta
            </button>
          </div>
        )}
        {fields.folder && !creatingFolder && <p className="-mt-2 mb-4 text-sm text-danger-ink">{fields.folder}</p>}

        {creatingFolder && (
          <fieldset className="mb-4 rounded-2xl bg-bg p-3">
            <legend className="float-left mb-2 w-full text-sm font-semibold">
              {noFolders ? "Crie sua primeira pasta" : "Nova pasta"}
            </legend>
            {noFolders && <p className="mb-3 text-sm text-muted">Toda ideia mora numa pasta. Dê um nome para guardar esta.</p>}
            <div className="flex gap-2">
              <div className="w-20 shrink-0">
                <label htmlFor="confirm-folder-emoji" className="sr-only">
                  Emoji (opcional)
                </label>
                <input
                  id="confirm-folder-emoji"
                  value={folderEmoji}
                  maxLength={8}
                  placeholder="🗂"
                  aria-invalid={fields.emoji ? true : undefined}
                  onChange={(e) => setFolderEmoji(e.target.value)}
                  className={`${FIELD} text-center`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="confirm-folder-name" className="sr-only">
                  Nome da pasta
                </label>
                <input
                  id="confirm-folder-name"
                  value={folderName}
                  maxLength={FOLDER_NAME_MAX}
                  placeholder="Nome da pasta, ex.: Estudos"
                  enterKeyHint="done"
                  autoFocus={!noFolders}
                  aria-invalid={fields.name ? true : undefined}
                  aria-describedby={fields.name ? "confirm-folder-error" : undefined}
                  onChange={(e) => setFolderName(e.target.value)}
                  className={FIELD}
                />
              </div>
            </div>
            {(fields.name || fields.emoji) && (
              <p id="confirm-folder-error" className="mt-1 text-sm text-danger-ink">
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
                className="mt-1 -mb-1 rounded-xl px-1 text-sm text-muted active:text-ink"
              >
                Escolher uma pasta existente
              </button>
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen((o) => (o === "all" ? null : "all"))}
            className="flex-1 rounded-2xl bg-bg font-semibold text-ink active:bg-ink/10 disabled:opacity-60"
          >
            {open === "all" ? "Ocultar" : "Editar"}
          </button>
          <button
            type="submit"
            disabled={busy || (!isTask && folders === null)}
            className="flex-1 rounded-2xl bg-accent font-semibold text-white active:opacity-85 disabled:opacity-60"
          >
            {isTask ? "Salvar" : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
