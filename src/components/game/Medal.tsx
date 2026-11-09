import { useId, type ReactNode } from "react";

/** Mesmo union de shared/xp.ts (Fase 1A); manter idêntico. */
export type MedalTier = "bronze" | "prata" | "ouro" | "diamante" | "supremo";

export const MEDAL_LABEL: Record<MedalTier, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
  supremo: "Supremo",
};

interface TierColors {
  hi: string;
  mid: string;
  lo: string;
  edge: string;
  glow: string;
  gem: string | null;
}

/** Cores dos brasões (docs/superpowers/mockups/tema-neon-2026-11.html). */
const TIERS: Record<MedalTier, TierColors> = {
  bronze: { hi: "#ffd2a6", mid: "#c9773a", lo: "#5a2a0c", edge: "#2e1405", glow: "#e08a45", gem: null },
  prata: { hi: "#ffffff", mid: "#b8c2cc", lo: "#545d68", edge: "#22272d", glow: "#cfd8e2", gem: null },
  ouro: { hi: "#fff4b8", mid: "#e8b320", lo: "#7a4a03", edge: "#3a2300", glow: "#ffc93a", gem: "#ff4d5e" },
  diamante: { hi: "#eafcff", mid: "#55d3ff", lo: "#14508f", edge: "#06223f", glow: "#5fd6ff", gem: "#bff5ff" },
  supremo: { hi: "#f1ffd6", mid: "#88ef1b", lo: "#006b00", edge: "#022402", glow: "#88ef1b", gem: "#eaffc0" },
};

/** Cor do brilho de cada nível (para halos em volta do brasão). */
export const MEDAL_GLOW: Record<MedalTier, string> = {
  bronze: TIERS.bronze.glow,
  prata: TIERS.prata.glow,
  ouro: TIERS.ouro.glow,
  diamante: TIERS.diamante.glow,
  supremo: TIERS.supremo.glow,
};

const ORDER: MedalTier[] = ["bronze", "prata", "ouro", "diamante", "supremo"];
const SHIELD = "M60 22 L94 32 V66 C94 92 78 108 60 116 C42 108 26 92 26 66 V32 Z";
const SHIELD_IN = "M60 30 L87 38 V66 C87 87 74 100 60 107 C46 100 33 87 33 66 V38 Z";
const VB_W = 120;
const VB_H = 140;

/** Folhas dos louros: posição fixa, calculada uma vez. */
const LAUREL = [-1, 1].flatMap((side) =>
  Array.from({ length: 7 }, (_, i) => {
    const a = ((200 + i * 19) * Math.PI) / 180;
    const r = 46;
    const x = +(60 + side * Math.cos(a) * -r).toFixed(1);
    const y = +(74 - Math.sin(a) * -r * 0.98).toFixed(1);
    return { x, y, rot: Math.round(side * (i * 19 - 30)) };
  }),
);

type Ref = (n: string) => string;

function Sword({ rot, c, r }: { rot: number; c: TierColors; r: Ref }) {
  return (
    <g transform={`rotate(${rot} 60 70)`}>
      <path d="M57.5 0 L62.5 0 L63 84 L60 90 L57 84 Z" fill={r("bl")} stroke={c.edge} strokeWidth="1" />
      <rect x="48" y="84" width="24" height="5" rx="2" fill={r("m")} stroke={c.edge} strokeWidth="1" />
      <rect x="57.5" y="89" width="5" height="16" rx="2" fill={c.edge} />
      <circle cx="60" cy="108" r="4" fill={r("m")} stroke={c.edge} strokeWidth="1" />
    </g>
  );
}

const WING_FEATHERS = [
  "M30 44 C14 40 4 30 0 16 C10 24 20 26 30 28 Z",
  "M30 56 C12 54 0 46 -6 32 C6 40 18 42 30 42 Z",
  "M30 68 C14 70 2 64 -4 52 C8 58 20 58 30 56 Z",
];
const WING_BIG = "M30 80 C16 84 4 80 -2 70 C10 74 20 74 30 70 Z";

function Wings({ c, r, big }: { c: TierColors; r: Ref; big: boolean }) {
  const s = big ? 1.25 : 1;
  const feathers = (big ? [...WING_FEATHERS, WING_BIG] : WING_FEATHERS).map((d) => (
    <path key={d} d={d} fill={r("w")} stroke={c.edge} strokeWidth="1" strokeLinejoin="round" />
  ));
  return (
    <>
      <g transform={`translate(30 60) scale(${s}) translate(-30 -60)`}>{feathers}</g>
      <g transform={`translate(120 0) scale(-1 1) translate(30 60) scale(${s}) translate(-30 -60)`}>{feathers}</g>
    </>
  );
}

function Laurel() {
  return (
    <>
      {LAUREL.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx="3.4"
          ry="8"
          fill="#3fae2a"
          stroke="#123d0b"
          strokeWidth=".8"
          transform={`rotate(${l.rot} ${l.x} ${l.y})`}
        />
      ))}
    </>
  );
}

function Crown({ c, r, y = 6, s = 1 }: { c: TierColors; r: Ref; y?: number; s?: number }) {
  return (
    <g transform={`translate(60 ${y}) scale(${s}) translate(-60 0)`}>
      <path
        d="M42 26 L39 6 L50 15 L60 0 L70 15 L81 6 L78 26 Z"
        fill={r("m")}
        stroke={c.edge}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="18" r="3" fill={c.gem ?? "#ff4d5e"} />
      <circle cx="39" cy="6" r="2.2" fill={r("m")} />
      <circle cx="60" cy="0" r="2.4" fill={r("m")} />
      <circle cx="81" cy="6" r="2.2" fill={r("m")} />
    </g>
  );
}

function Emblem({ tier, c, r }: { tier: MedalTier; c: TierColors; r: Ref }) {
  if (tier === "bronze")
    return (
      <polygon
        points="60,46 65,60 80,60 68,69 72,84 60,75 48,84 52,69 40,60 55,60"
        fill={r("m")}
        stroke={c.edge}
        strokeWidth="1.4"
      />
    );
  if (tier === "prata")
    return (
      <g transform="translate(0 4)">
        <path d="M58 42 L62 42 L62.5 82 L60 86 L57.5 82 Z" fill={r("bl")} stroke={c.edge} />
        <rect x="50" y="78" width="20" height="4" rx="2" fill={r("m")} stroke={c.edge} />
        <path d="M44 62 L60 52 L76 62 L60 72 Z" fill="none" stroke={c.edge} strokeWidth="2" />
      </g>
    );
  if (tier === "ouro")
    return (
      <>
        <Crown c={c} r={r} y={52} s={0.9} />
        <path d="M46 86 H74" stroke={c.edge} strokeWidth="2" />
      </>
    );
  return (
    <g filter={r("gl")}>
      <path d="M60 46 L76 60 L60 90 L44 60 Z" fill={c.gem ?? "#fff"} stroke={c.edge} strokeWidth="1.4" />
      <path
        d="M44 60 H76 M52 60 L60 46 L68 60 L60 90 M52 60 L60 90"
        stroke={c.edge}
        strokeWidth=".8"
        fill="none"
        opacity=".6"
      />
      <path d="M60 46 L68 60 L60 60 Z" fill="#fff" opacity=".55" />
    </g>
  );
}

export interface MedalProps {
  tier: MedalTier;
  /** Altura em px (a largura segue a proporção 120:140). */
  size?: number;
  glow?: boolean;
  /** Faixa com o nome do nível embaixo (esconda em tamanhos pequenos, < 40 px). */
  ribbon?: boolean;
  className?: string;
}

/** Brasão de RPG em SVG. Os ids de gradiente/filtro são únicos por instância (useId). */
export function Medal({ tier, size = 96, glow = false, ribbon = true, className = "" }: MedalProps) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${u}`;
  const r: Ref = (n) => `url(#${id(n)})`;
  const c = TIERS[tier];
  const lvl = ORDER.indexOf(tier);
  const supremo = tier === "supremo";
  const width = Math.round((size * VB_W) / VB_H);

  const back: ReactNode[] = [];
  if (supremo)
    back.push(
      <path
        key="fl"
        d="M60 -4 C70 10 64 16 74 24 C80 12 78 4 88 0 C86 14 96 22 92 36 L28 36 C24 22 34 14 32 0 C42 4 40 12 46 24 C56 16 50 10 60 -4 Z"
        fill={r("fl")}
        opacity=".95"
      />,
    );
  if (lvl >= 3) back.push(<Wings key="wg" c={c} r={r} big={supremo} />);
  if (lvl >= 2) back.push(<Laurel key="la" />);
  if (lvl === 0 || lvl >= 2)
    back.push(<Sword key="s1" rot={-38} c={c} r={r} />, <Sword key="s2" rot={38} c={c} r={r} />);
  if (lvl === 1) back.push(<Wings key="wg" c={c} r={r} big={false} />);

  return (
    <svg
      role="img"
      aria-label={`Medalha ${MEDAL_LABEL[tier]}`}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={width}
      height={size}
      overflow="visible"
      className={`shrink-0 overflow-visible ${className}`}
      style={glow ? { filter: `drop-shadow(0 0 14px ${c.glow}8c)` } : undefined}
    >
      <defs>
        <linearGradient id={id("m")} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset=".45" stopColor={c.mid} />
          <stop offset="1" stopColor={c.lo} />
        </linearGradient>
        <linearGradient id={id("in")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.lo} />
          <stop offset="1" stopColor={c.edge} />
        </linearGradient>
        <linearGradient id={id("bl")} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".5" stopColor="#cfd6dc" />
          <stop offset="1" stopColor="#6b737b" />
        </linearGradient>
        <linearGradient id={id("w")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="1" stopColor={c.mid} />
        </linearGradient>
        <linearGradient id={id("fl")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#00b000" />
          <stop offset=".6" stopColor="#88ef1b" />
          <stop offset="1" stopColor="#eaffc0" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id={id("rb")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1c241c" />
          <stop offset="1" stopColor="#0a0d0a" />
        </linearGradient>
        <filter id={id("gl")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Brilho na cor do nível (equivale a drop-shadow(0 0 (4+2·nível)px glow/40%)). */}
        <filter id={id("sh")} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation={(4 + lvl * 2) / 2} floodColor={c.glow} floodOpacity=".4" />
        </filter>
      </defs>
      <g filter={r("sh")}>
        {back}
        <path d={SHIELD} fill={r("m")} stroke={c.edge} strokeWidth="2.4" strokeLinejoin="round" />
        <path d={SHIELD_IN} fill={r("in")} stroke={c.hi} strokeOpacity=".55" strokeWidth="1.2" />
        <path d="M36 40 L60 33 L60 70 C50 64 40 56 36 40 Z" fill="#fff" opacity=".08" />
        {[0, 1, 2, 3].slice(0, lvl + 1).map((i) => (
          <circle key={i} cx={60 - lvl * 4.5 + i * 9} cy="40" r="2" fill={c.hi} opacity=".9" />
        ))}
        <Emblem tier={tier} c={c} r={r} />
        {lvl >= 3 && <Crown c={c} r={r} y={supremo ? 2 : 6} s={supremo ? 1.05 : 0.8} />}
      </g>
      {ribbon && (
        <g>
          <path
            d="M24 112 H96 L90 121 L96 130 H24 L30 121 Z"
            fill={r("rb")}
            stroke={c.mid}
            strokeWidth="1.3"
          />
          <text
            x="60"
            y="124.5"
            textAnchor="middle"
            fontFamily="'Geist Mono Variable', ui-monospace, monospace"
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="1.6"
            fill={c.hi}
          >
            {tier.toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Contorno de escudo tracejado vazio: semana sem medalha. */
export function MedalPlaceholder({ size = 96 }: { size?: number }) {
  return (
    <svg
      role="img"
      aria-label="Semana sem medalha"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={Math.round((size * VB_W) / VB_H)}
      height={size}
      className="shrink-0"
    >
      <path
        d={SHIELD}
        fill="none"
        stroke="var(--dot)"
        strokeWidth="3"
        strokeDasharray="7 7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
