import { formatKg, WEIGHT_MAX_G, WEIGHT_STEP_G, type WorkoutExercise, type WorkoutTemplate } from "../../shared/workout";

/** 1 = segunda … 7 = domingo. */
export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
export const WEEKDAY_LONG = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;

/** 90 → "1:30"; 45 → "0:45". */
export function restLabel(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 82500 → "82,5" (para o campo de texto, sem "kg"). */
export function kgText(weightG: number): string {
  return formatKg(weightG).replace(/ kg$/, "");
}

/**
 * "82,5" / "82.5" / "80" → gramas inteiros (82500). null se inválido ou fora de 0,5 kg.
 * Sem ponto flutuante: separa inteiro e decimal na mão.
 */
export function parseKg(text: string): number | null {
  const m = /^\s*(\d{1,4})(?:[.,](\d{1,2}))?\s*(?:kg)?\s*$/i.exec(text);
  if (!m) return null;
  const dec = (m[2] ?? "").padEnd(3, "0"); // "5" → "500" g
  const g = Number(m[1]) * 1000 + Number(dec);
  if (g % WEIGHT_STEP_G !== 0 || g > WEIGHT_MAX_G) return null;
  return g;
}

/** "4 × 8 · 80 kg" (peso 0 = só o corpo). */
export function exerciseLine(e: Pick<WorkoutExercise, "sets" | "reps" | "weightG">): string {
  return `${e.sets} × ${e.reps} · ${e.weightG ? formatKg(e.weightG) : "peso do corpo"}`;
}

/** Duração estimada: cada série ~45 s + o descanso, arredondada para 5 min. */
export function estimateMinutes(exercises: Pick<WorkoutExercise, "sets" | "restS">[]): number {
  const s = exercises.reduce((n, e) => n + e.sets * (45 + e.restS), 0);
  return Math.max(5, Math.round(s / 300) * 5);
}

/** Rótulo principal de um treino no plano: o foco ("Perna") ou, sem foco, o nome. */
export const templateTitle = (t: Pick<WorkoutTemplate, "name" | "focus">): string => t.focus || t.name;

/** "Perna · Treino C" (ou só o nome). */
export const templateHeading = (t: Pick<WorkoutTemplate, "name" | "focus">): string =>
  t.focus ? `${t.focus} · ${t.name}` : t.name;

/** Próximo nome livre: "Treino A", "Treino B"… (depois do Z, "Treino 27"…). */
export function nextTemplateName(templates: Pick<WorkoutTemplate, "name">[]): string {
  const used = new Set(templates.map((t) => t.name.trim().toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const name = `Treino ${String.fromCharCode(65 + i)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  let n = 27;
  while (used.has(`treino ${n}`)) n++;
  return `Treino ${n}`;
}
