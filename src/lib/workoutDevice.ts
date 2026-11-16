import { useEffect, useState } from "react";

/*
 * Recursos do aparelho no treino ao vivo: bipe (WebAudio), vibração e tela acesa (Wake Lock).
 * Tudo opcional: sem suporte (ex.: iPhone não vibra), segue sem erro.
 */

let audio: AudioContext | null = null;

/** Cria/retoma o AudioContext. Chame num toque (ex.: Concluir série) para o bipe tocar depois. */
export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

/** Dois bipes curtos (fim do descanso). */
export function beep(): void {
  try {
    if (!audio) unlockAudio();
    const ctx = audio;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const at of [0, 0.22]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.18);
    }
  } catch {
    /* sem áudio */
  }
}

/** Vibra (só Android; o Safari do iPhone ignora). */
export function buzz(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* sem vibração */
  }
}

/** Mantém a tela acesa enquanto `active` (pede de novo ao voltar para o app; solta ao sair). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let alive = true;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (!alive) void next.release().catch(() => {});
        else lock = next;
      } catch {
        /* recusado (bateria fraca, aba oculta…) */
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible" && alive && (!lock || lock.released)) void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/**
 * Hora atual (ms) renovada a cada `stepMs` enquanto `active`, com setTimeout encadeado.
 * Só redesenha: quem conta o tempo é sempre `alvo - Date.now()`.
 */
export function useClock(active: boolean, stepMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      t = setTimeout(tick, stepMs);
    };
    tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, stepMs]);
  return now;
}

/** 65 s → "1:05"; negativo vira 0. */
export function clockLabel(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
