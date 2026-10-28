import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AUDIO_MAX_SECONDS } from "../../shared/limits";
import { api, ApiError } from "../lib/api";
import { showToast } from "./Toast";

interface Props {
  disabled?: boolean;
  /** Texto transcrito (já sem espaços nas pontas, nunca vazio). */
  onText: (text: string) => void;
}

type Phase = "idle" | "starting" | "recording" | "transcribing";

const MIN_MS = 500;
const BARS = 16;
// iOS Safari grava em mp4/AAC; Chrome e Firefox em webm/Opus.
const TYPES = ["audio/mp4", "audio/webm"];

interface Session {
  holding: boolean;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  timer?: ReturnType<typeof setInterval>;
  raf?: number;
  audio?: AudioContext;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Botão de segurar para falar: grava enquanto o dedo está no botão, transcreve ao soltar. */
export function Recorder({ disabled, onText }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.15));
  const session = useRef<Session | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const cleanup = (s: Session) => {
    if (s.timer) clearInterval(s.timer);
    if (s.raf) cancelAnimationFrame(s.raf);
    s.stream?.getTracks().forEach((t) => t.stop());
    void s.audio?.close().catch(() => {});
  };

  useEffect(
    () => () => {
      const s = session.current;
      if (s) {
        s.holding = false;
        if (s.recorder) s.recorder.onstop = null;
        if (s.recorder?.state === "recording") s.recorder.stop();
        cleanup(s);
      }
    },
    [],
  );

  const finish = async (s: Session, mimeType: string) => {
    cleanup(s);
    session.current = null;
    const duration = performance.now() - s.startedAt;
    if (duration < MIN_MS || s.chunks.length === 0) {
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      const text = (await api.transcribe(new Blob(s.chunks, { type: mimeType }))).trim();
      if (text) onTextRef.current(text);
      else showToast("Não entendi o áudio. Tente de novo.");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Não consegui transcrever agora. Tente escrever.");
    } finally {
      setPhase("idle");
    }
  };

  /** Medidor de nível: RMS do microfone num AnalyserNode. Opcional (sem ele, só o tempo). */
  const meter = (s: Session) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx || !s.stream) return;
      const audio = new Ctx();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(s.stream).connect(analyser);
      s.audio = audio;
      const buf = new Uint8Array(analyser.fftSize);
      let last = 0;
      const loop = (t: number) => {
        if (t - last > 90) {
          last = t;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          setLevels((l) => [...l.slice(1), Math.max(0.12, level)]);
        }
        s.raf = requestAnimationFrame(loop);
      };
      s.raf = requestAnimationFrame(loop);
    } catch {
      // Sem medidor: a gravação segue normalmente.
    }
  };

  const start = async () => {
    if (disabled || session.current || phase !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast("Este navegador não grava áudio. Escreva a mensagem.");
      return;
    }
    const s: Session = { holding: true, chunks: [], startedAt: performance.now() };
    session.current = s;
    setPhase("starting");
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      session.current = null;
      setPhase("idle");
      const name = e instanceof DOMException ? e.name : "";
      showToast(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Permita o microfone nos Ajustes do Safari."
          : "Não consegui acessar o microfone.",
      );
      return;
    }
    // Soltou antes de o microfone abrir (ex.: no pedido de permissão): descarta.
    if (!s.holding || session.current !== s) {
      cleanup(s);
      if (session.current === s) session.current = null;
      setPhase("idle");
      return;
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(s.stream, mimeType ? { mimeType } : undefined);
    } catch {
      cleanup(s);
      session.current = null;
      setPhase("idle");
      showToast("Não consegui gravar o áudio. Escreva a mensagem.");
      return;
    }
    s.recorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) s.chunks.push(e.data);
    };
    recorder.onstop = () => void finish(s, recorder.mimeType || mimeType || "audio/webm");
    recorder.start();
    s.startedAt = performance.now();
    setElapsed(0);
    setLevels(Array(BARS).fill(0.15));
    setPhase("recording");
    s.timer = setInterval(() => {
      const secs = (performance.now() - s.startedAt) / 1000;
      setElapsed(secs);
      if (secs >= AUDIO_MAX_SECONDS) stop(); // limite duro de 60 s
    }, 200);
    meter(s);
  };

  const stop = () => {
    const s = session.current;
    if (!s) return;
    s.holding = false;
    if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // não tira o foco nem seleciona texto
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // o dedo pode escorregar sem parar a gravação
    } catch {
      // Ponteiro sintético ou já solto: segue sem captura.
    }
    void start();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (down && !e.repeat) void start();
    if (!down) stop();
  };

  const active = phase === "recording" || phase === "transcribing";

  return (
    <>
      {active && (
        <div
          data-testid="recorder"
          aria-live="polite"
          className="absolute inset-y-0 left-0 right-[6.5rem] flex items-center gap-3 rounded-l-[22px] bg-surface pl-4"
        >
          {phase === "recording" ? (
            <>
              <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-danger motion-safe:animate-pulse" />
              <div aria-hidden className="flex h-6 flex-1 items-center gap-[3px]">
                {levels.map((l, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-accent transition-[height] duration-100"
                    style={{ height: `${Math.round(4 + l * 20)}px` }}
                  />
                ))}
              </div>
              <span className="text-sm tabular-nums text-muted">{fmt(elapsed)}</span>
              <span className="sr-only">Gravando. Solte para enviar.</span>
            </>
          ) : (
            <span className="text-sm text-muted">Transcrevendo…</span>
          )}
        </div>
      )}
      <button
        type="button"
        aria-label="Segure para falar"
        aria-pressed={phase === "recording"}
        disabled={disabled || phase === "transcribing"}
        onPointerDown={onDown}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        className={`grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 disabled:opacity-50 ${
          phase === "recording" ? "scale-110 bg-danger text-white" : "text-accent active:bg-accent/10"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path
            d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
