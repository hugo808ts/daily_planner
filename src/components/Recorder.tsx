import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AUDIO_MAX_SECONDS } from "../../shared/limits";
import { api, ApiError } from "../lib/api";
import { showToast } from "./Toast";
import { IconButton } from "./ui/Button";
import { MicIcon, SquareIcon } from "./ui/Icon";

interface Props {
  disabled?: boolean;
  /** Texto transcrito (já sem espaços nas pontas, nunca vazio). */
  onText: (text: string) => void;
  /** Avisa quando o indicador de gravação/transcrição ocupa o lugar do campo de texto. */
  onActiveChange?: (active: boolean) => void;
}

type Phase = "idle" | "starting" | "recording" | "transcribing";

const MIN_MS = 500;
/** Toque mais curto que isso liga/desliga a gravação; mais longo é "segurar para falar". */
const HOLD_MS = 400;
const BARS = 16;
// iOS Safari grava em mp4/AAC; Chrome e Firefox em webm/Opus.
const TYPES = ["audio/mp4", "audio/webm"];

interface Session {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  /** Quando o dedo/tecla desceu (para distinguir toque de segurar). */
  pressedAt: number;
  /** Já soltou o botão. */
  released: boolean;
  /** Toque curto: segue gravando até o próximo toque. */
  toggle: boolean;
  /** Parada pedida; ignora eventos seguintes. */
  stopped: boolean;
  timer?: ReturnType<typeof setInterval>;
  raf?: number;
  audio?: AudioContext;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const DENIED = () =>
  isIOS() ? "Permita o microfone nos Ajustes do Safari." : "Permita o acesso ao microfone nas configurações do navegador.";

/**
 * Microfone: segure para falar (solta e envia) ou toque uma vez para começar e outra para enviar.
 * Grava, transcreve e entrega o texto a `onText`.
 */
export function Recorder({ disabled, onText, onActiveChange }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [toggleMode, setToggleMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.15));
  const session = useRef<Session | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  const active = phase === "recording" || phase === "transcribing";
  useEffect(() => {
    onActiveRef.current?.(active);
  }, [active]);

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
        s.stopped = true;
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
    setToggleMode(false);
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
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // sem barras animadas
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

  const stop = () => {
    const s = session.current;
    if (!s || s.stopped) return;
    s.stopped = true;
    if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
  };

  /** Soltou: depois de um toque curto a gravação continua; depois de segurar, envia. */
  const settle = (s: Session) => {
    if (performance.now() - s.pressedAt >= HOLD_MS) stop();
    else {
      s.toggle = true;
      setToggleMode(true);
    }
  };

  const start = async () => {
    if (disabled || session.current || phase !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast("Este navegador não grava áudio. Escreva a mensagem.");
      return;
    }
    const s: Session = {
      chunks: [],
      startedAt: performance.now(),
      pressedAt: performance.now(),
      released: false,
      toggle: false,
      stopped: false,
    };
    session.current = s;
    setPhase("starting");
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      session.current = null;
      setPhase("idle");
      const name = e instanceof DOMException ? e.name : "";
      showToast(name === "NotAllowedError" || name === "SecurityError" ? DENIED() : "Não consegui acessar o microfone.");
      return;
    }
    // Desmontou ou cancelou antes de o microfone abrir: descarta.
    if (s.stopped || session.current !== s) {
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
    // Soltou enquanto o microfone abria (ex.: pedido de permissão): trata como toque.
    if (s.released) settle(s);
  };

  const press = () => {
    const s = session.current;
    if (s) {
      // Segundo toque de uma gravação por toque: envia.
      if (s.toggle) stop();
      return;
    }
    void start();
  };

  const release = (cancelled = false) => {
    const s = session.current;
    if (!s || s.stopped || s.released) return;
    s.released = true;
    if (cancelled) s.pressedAt = -Infinity; // gesto cancelado conta como "segurou": para
    if (s.recorder?.state === "recording" || cancelled) {
      if (cancelled && !s.recorder) stop();
      else if (s.recorder) settle(s);
    }
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // não tira o foco nem seleciona texto
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // o dedo pode escorregar sem parar a gravação
    } catch {
      // Ponteiro sintético ou já solto: segue sem captura.
    }
    press();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (down && !e.repeat) press();
    if (!down) release();
  };

  const label = phase === "recording" ? "Parar e enviar" : "Segure para falar";

  return (
    <>
      {/* Região viva sempre presente: leitores de tela anunciam a mudança de estado. */}
      <div aria-live="polite" className="sr-only">
        {phase === "recording" ? "Gravando…" : phase === "transcribing" ? "Transcrevendo…" : ""}
      </div>
      {active && (
        <div data-testid="recorder" className="no-select flex min-w-0 flex-1 items-center gap-3 self-center py-2 pl-0.5">
          {phase === "recording" ? (
            <>
              <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-danger motion-safe:animate-pulse" />
              <div aria-hidden className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
                {levels.map((l, i) => (
                  <span
                    key={i}
                    className="w-[3px] shrink-0 rounded-full bg-accent transition-[height] duration-100 motion-reduce:transition-none"
                    style={{ height: `${Math.round(4 + l * 20)}px` }}
                  />
                ))}
              </div>
              <span className="text-sm text-muted tabular-nums">{fmt(elapsed)}</span>
              <span className="sr-only">{toggleMode ? "Toque no microfone para enviar." : "Solte para enviar."}</span>
            </>
          ) : (
            <span className="text-sm text-muted">Transcrevendo…</span>
          )}
        </div>
      )}
      <span id="recorder-hint" className="sr-only">
        Segure para falar e solte para enviar, ou toque para começar e toque de novo para enviar.
      </span>
      <IconButton
        label={label}
        aria-describedby="recorder-hint"
        aria-pressed={phase === "recording"}
        icon={phase === "recording" && toggleMode ? <SquareIcon size={18} fill="currentColor" /> : <MicIcon />}
        disabled={disabled || phase === "transcribing"}
        busy={false}
        tooltip
        onPointerDown={onDown}
        onPointerUp={() => release()}
        onPointerCancel={() => release(true)}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        className={
          phase === "recording"
            ? "scale-110 bg-danger-fill! text-on-accent! motion-reduce:scale-100"
            : "text-accent!"
        }
      />
    </>
  );
}
