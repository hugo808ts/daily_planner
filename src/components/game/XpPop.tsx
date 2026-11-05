import { useEffect, useRef } from "react";

export interface XpPopProps {
  amount: number;
  onDone: () => void;
}

/** "+25 XP" que sobe e some (~900 ms). Posicione com um pai `relative`. */
export function XpPop({ amount, onDone }: XpPopProps) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = window.setTimeout(() => done.current(), 900);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span
      role="status"
      aria-live="polite"
      className="xp-pop no-select pointer-events-none absolute right-3.5 top-1 rounded-full px-[9px] py-[3px] font-display text-[13px] font-extrabold"
    >
      +{amount} XP
    </span>
  );
}
