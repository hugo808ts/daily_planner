import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CAPTURE_TEXT_MAX } from "../../shared/limits";
import type { CaptureResult, Idea, Task } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { ConfirmSheet, type SavedItem } from "./ConfirmSheet";
import { Recorder } from "./Recorder";
import { IconButton } from "./ui/Button";
import { SendIcon } from "./ui/Icon";
import { showToast } from "./Toast";

interface Props {
  /** Tarefa recém-criada, para a tela entrar com ela na semana visível. */
  onTaskSaved: (task: Task) => void;
  /** Ideia recém-guardada, para a tela de Ideias mostrá-la sem recarregar. */
  onIdeaSaved?: (idea: Idea) => void;
  /** Computador: fica no pé da coluna do Hoje (sticky), em vez de flutuar sobre a barra de abas. */
  inline?: boolean;
}

/**
 * Altura do teclado virtual. No iOS um elemento `fixed; bottom: 0` fica atrás do teclado,
 * porque o layout viewport não encolhe; o visualViewport diz quanto da tela sobrou.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setInset(hidden > 80 ? Math.round(hidden) : 0); // < 80 px é barra do navegador, não teclado
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** Barra de captura rápida: escreve ou segura o microfone; a folha de confirmação mostra o que foi entendido. */
export function CaptureBar({ onTaskSaved, onIdeaSaved, inline = false }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: CaptureResult; said: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const keyboard = useKeyboardInset();

  // Ctrl+K / Cmd+K foca a captura de qualquer lugar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cresce com o texto até 4 linhas.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 4 * 24 + 20)}px`;
  }, [text]);

  const submit = async (value = text) => {
    const said = value.trim();
    if (!said || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.capture(said);
      input.current?.blur(); // fecha o teclado antes da folha
      setPending({ result, said });
    } catch (e) {
      if (e instanceof ApiError && e.fields?.text) setError(e.fields.text);
      else showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const onSaved = (item: SavedItem) => {
    setPending(null);
    setText("");
    if (item.kind === "task") {
      onTaskSaved(item.task);
      showToast("Tarefa salva");
    } else {
      onIdeaSaved?.(item.idea);
      showToast("Ideia guardada");
    }
  };

  const empty = !text.trim();

  return (
    <>
      <div
        className={
          inline
            ? "sticky bottom-0 z-10 bg-linear-to-t from-bg from-70% to-transparent px-[18px] pt-4 pb-4"
            : "pointer-events-none fixed inset-x-0 z-30 px-3"
        }
        style={
          inline
            ? undefined
            : {
                bottom: keyboard
                  ? `${keyboard + 8}px`
                  : "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 0.5rem)",
              }
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className={`pointer-events-auto mx-auto flex items-end gap-1 rounded-[22px] border border-line bg-surface py-1 pr-1 pl-4 shadow-[0_10px_30px_-12px_rgb(36_32_58/0.35)] transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 motion-reduce:transition-none ${inline ? "" : "max-w-md"}`}
        >
          <label htmlFor="capture-input" className="sr-only">
            Captura rápida
          </label>
          <textarea
            id="capture-input"
            ref={input}
            rows={1}
            value={text}
            maxLength={CAPTURE_TEXT_MAX}
            name="capture"
            placeholder="Ex.: dentista amanhã às 15h…"
            enterKeyHint="send"
            autoComplete="off"
            aria-keyshortcuts="Control+K Meta+K"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "capture-error" : undefined}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            className={`max-h-[116px] min-w-0 flex-1 resize-none self-center bg-transparent py-2.5 leading-6 text-ink placeholder:text-muted focus:outline-none ${recording ? "hidden" : ""}`}
          />
          <Recorder
            disabled={busy}
            onActiveChange={setRecording}
            onText={(t) => {
              setText(t);
              void submit(t);
            }}
          />
          <IconButton
            type="submit"
            label="Enviar"
            variant="primary"
            icon={<SendIcon size={20} strokeWidth={2.4} />}
            busy={busy}
            disabled={empty}
            className={empty ? "bg-accent-soft! text-accent-ink! opacity-100! border border-accent/25" : ""}
          />
        </form>
        {error && (
          <p id="capture-error" role="alert" className={`pointer-events-auto mx-auto mt-1 px-4 text-sm text-danger-ink ${inline ? "" : "max-w-md"}`}>
            {error}
          </p>
        )}
      </div>

      {pending && (
        <ConfirmSheet initial={pending.result} said={pending.said} onClose={() => setPending(null)} onSaved={onSaved} />
      )}
    </>
  );
}
