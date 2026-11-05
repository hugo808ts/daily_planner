import { useId } from "react";

/** Mesmo union de shared/xp.ts (Fase 1A); manter idêntico. */
export type MedalTier = "bronze" | "prata" | "ouro" | "diamante" | "supremo";

export const MEDAL_LABEL: Record<MedalTier, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
  supremo: "Supremo",
};

export interface MedalProps {
  tier: MedalTier;
  /** Altura em px (a largura segue a proporção; Supremo é 160:120). */
  size?: number;
  glow?: boolean;
  className?: string;
}

/** Medalha em SVG. Os ids de gradiente/filtro são únicos por instância (useId). */
export function Medal({ tier, size = 96, glow = false, className = "" }: MedalProps) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${u}`;
  const ref = (n: string) => `url(#${id(n)})`;
  const vbW = tier === "supremo" ? 160 : 120;
  const width = Math.round((size * vbW) / 120);
  return (
    <svg
      role="img"
      aria-label={`Medalha ${MEDAL_LABEL[tier]}`}
      viewBox={`0 0 ${vbW} 120`}
      width={width}
      height={size}
      className={`shrink-0 ${className}`}
      style={glow ? { filter: "drop-shadow(0 0 14px rgb(255 211 74 / 0.55))" } : undefined}
    >
      <defs>
        <radialGradient id={id("bzRim")} cx="35%" cy="25%" r="80%"><stop offset="0" stopColor="#F3C29A" /><stop offset=".45" stopColor="#B8693A" /><stop offset="1" stopColor="#5E2E14" /></radialGradient>
        <radialGradient id={id("bzIn")} cx="40%" cy="30%" r="75%"><stop offset="0" stopColor="#D99366" /><stop offset="1" stopColor="#7A3E1E" /></radialGradient>
        <radialGradient id={id("agRim")} cx="35%" cy="25%" r="80%"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".45" stopColor="#B9C2D0" /><stop offset="1" stopColor="#5E6878" /></radialGradient>
        <radialGradient id={id("agIn")} cx="40%" cy="30%" r="75%"><stop offset="0" stopColor="#E9EEF5" /><stop offset="1" stopColor="#8691A3" /></radialGradient>
        <radialGradient id={id("auRim")} cx="35%" cy="25%" r="80%"><stop offset="0" stopColor="#FFF6C2" /><stop offset=".45" stopColor="#F2B21E" /><stop offset="1" stopColor="#8A5300" /></radialGradient>
        <radialGradient id={id("auIn")} cx="40%" cy="30%" r="75%"><stop offset="0" stopColor="#FFD966" /><stop offset="1" stopColor="#B87400" /></radialGradient>
        <linearGradient id={id("gemWarm")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF8E1" /><stop offset=".5" stopColor="#F7D9A8" /><stop offset="1" stopColor="#C98A4B" /></linearGradient>
        <linearGradient id={id("gemBlue")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#CFE6FF" /><stop offset=".45" stopColor="#3D8BFF" /><stop offset="1" stopColor="#1638A8" /></linearGradient>
        <linearGradient id={id("gemPrism")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".35" stopColor="#E6DDFF" /><stop offset=".65" stopColor="#B7E9FF" /><stop offset="1" stopColor="#C9A6FF" /></linearGradient>
        <linearGradient id={id("wing")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#C9D2E6" /></linearGradient>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <symbol id={id("facet")} viewBox="0 0 40 40"><path d="M20 2 38 20 20 38 2 20Z" fill={ref("gemWarm")} /><path d="M20 2 20 38M2 20H38" stroke="#ffffff70" strokeWidth="1" /><path d="M20 2 28 20 20 38 12 20Z" fill="#ffffff35" /></symbol>
      </defs>
      {tier === "bronze" && (
        <g>
          <circle cx="60" cy="62" r="46" fill="#00000040" />
          <circle cx="60" cy="58" r="46" fill={ref("bzRim")} />
          <circle cx="60" cy="58" r="36" fill={ref("bzIn")} stroke="#5E2E14" strokeOpacity=".5" />
          <use href={`#${id("facet")}`} x="44" y="42" width="32" height="32" />
          <path d="M30 40a36 36 0 0 1 40-18" stroke="#fff" strokeOpacity=".55" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}
      {tier === "prata" && (
        <g>
          <path d="M60 10 74 16 90 14 96 30 108 40 104 56 110 70 98 82 96 98 80 100 68 110 54 104 38 108 30 94 14 86 16 70 8 56 18 44 20 28 36 22 46 12Z" fill="#00000040" transform="translate(0 4)" />
          <path d="M60 10 74 16 90 14 96 30 108 40 104 56 110 70 98 82 96 98 80 100 68 110 54 104 38 108 30 94 14 86 16 70 8 56 18 44 20 28 36 22 46 12Z" fill={ref("agRim")} />
          <circle cx="60" cy="58" r="34" fill={ref("agIn")} stroke="#5E6878" strokeOpacity=".5" />
          <use href={`#${id("facet")}`} x="43" y="41" width="34" height="34" />
          <path d="M32 38a34 34 0 0 1 38-16" stroke="#fff" strokeOpacity=".7" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}
      {tier === "ouro" && (
        <g>
          <path d="M38 22 48 8 60 18 72 8 82 22Z" fill={ref("auRim")} stroke="#8A5300" strokeOpacity=".5" />
          <circle cx="60" cy="64" r="44" fill="#00000040" />
          <circle cx="60" cy="60" r="44" fill={ref("auRim")} />
          <circle cx="60" cy="60" r="34" fill={ref("auIn")} stroke="#8A5300" strokeOpacity=".5" />
          <path d="M60 36 80 60 60 84 40 60Z" fill="#FFF3B0" filter={ref("glow")} />
          <path d="M60 36 70 60 60 84 50 60Z" fill="#ffffff70" />
          <circle cx="60" cy="14" r="4" fill="#FFF8D6" />
          <path d="M30 44a34 34 0 0 1 38-18" stroke="#fff" strokeOpacity=".7" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}
      {tier === "diamante" && (
        <g>
          <path d="M34 26 30 8 46 20Z M86 26 90 8 74 20Z" fill={ref("agRim")} />
          <path d="M60 12 106 60 60 108 14 60Z" fill="#00000040" transform="translate(0 4)" />
          <path d="M60 12 106 60 60 108 14 60Z" fill={ref("agRim")} />
          <path d="M60 24 94 60 60 96 26 60Z" fill={ref("gemBlue")} filter={ref("glow")} />
          <path d="M60 24 72 60 60 96 48 60Z" fill="#ffffff40" />
          <path d="M26 60H94" stroke="#ffffff55" />
          <path d="M44 42 56 30" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeOpacity=".85" />
          <circle cx="60" cy="12" r="5" fill="#E9EEF5" /><circle cx="106" cy="60" r="5" fill="#E9EEF5" /><circle cx="60" cy="108" r="5" fill="#E9EEF5" /><circle cx="14" cy="60" r="5" fill="#E9EEF5" />
        </g>
      )}
      {tier === "supremo" && (
        <g>
          <path d="M44 52 6 36 14 50 2 52 16 62 6 68 24 72 18 80 42 76Z" fill={ref("wing")} stroke="#9AA6C2" strokeWidth="1" />
          <path d="M116 52 154 36 146 50 158 52 144 62 154 68 136 72 142 80 118 76Z" fill={ref("wing")} stroke="#9AA6C2" strokeWidth="1" />
          <path d="M80 6 92 16 80 22 68 16Z" fill={ref("auRim")} />
          <circle cx="80" cy="14" r="4" fill="#FF5FA8" />
          <path d="M80 16 118 38 118 82 80 104 42 82 42 38Z" fill="#00000040" transform="translate(0 4)" />
          <path d="M80 16 118 38 118 82 80 104 42 82 42 38Z" fill={ref("auRim")} />
          <path d="M80 26 108 42 108 78 80 94 52 78 52 42Z" fill={ref("gemPrism")} filter={ref("glow")} />
          <path d="M80 26 92 60 80 94 68 60Z" fill="#ffffff60" />
          <path d="M52 42 108 78M108 42 52 78" stroke="#ffffff50" />
          <circle cx="80" cy="104" r="4" fill="#FF5FA8" /><circle cx="42" cy="60" r="3.5" fill="#FF5FA8" /><circle cx="118" cy="60" r="3.5" fill="#FF5FA8" />
          <path d="M120 22 122 28 128 30 122 32 120 38 118 32 112 30 118 28Z" fill="#fff" />
          <path d="M36 92 37.5 96 41.5 97.5 37.5 99 36 103 34.5 99 30.5 97.5 34.5 96Z" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

/** Círculo tracejado vazio: semana sem medalha. */
export function MedalPlaceholder({ size = 96 }: { size?: number }) {
  return (
    <svg role="img" aria-label="Semana sem medalha" viewBox="0 0 120 120" width={size} height={size} className="shrink-0">
      <circle cx="60" cy="60" r="44" fill="none" stroke="var(--dot)" strokeWidth="3" strokeDasharray="7 7" />
    </svg>
  );
}
