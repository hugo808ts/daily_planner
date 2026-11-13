import { describe, expect, it } from "vitest";
import {
  achievements,
  bestStreak,
  buildSessionSummary,
  buildWeekReport,
  doneByWeek,
  exerciseKey,
  formatKg,
  formatTonnes,
  isoWeekday,
  isoWeekNumber,
  isPerfectWeek,
  isPersonalRecord,
  lastTimeByKey,
  prefill,
  priorMaxes,
  recordsBySession,
  sessionXp,
  setXp,
  startedEarly,
  streakWeeks,
  workoutMedal,
  workoutNextMedal,
  WorkoutExerciseCreate,
  WorkoutPlanPut,
  WorkoutSetCreate,
  type ReportRow,
  type WorkoutSet,
} from "../../shared/workout";

const sess = (id: string, date: string, finished = true) => ({
  id,
  date,
  startedAt: `${date}T12:00:00.000Z`,
  finishedAt: finished ? `${date}T13:00:00.000Z` : null,
});
const set = (sessionId: string, key: string, setIndex: number, weightG: number, reps: number): WorkoutSet => ({
  id: `${sessionId}-${key}-${setIndex}`,
  sessionId,
  exerciseKey: key,
  exerciseName: key,
  exercisePosition: 0,
  setIndex,
  weightG,
  reps,
  doneAt: "2026-11-13T12:00:00.000Z",
});

describe("formatação e chaves", () => {
  it("exerciseKey normaliza acento, caixa e espaços", () => {
    expect(exerciseKey("Elevação Lateral")).toBe("elevacao lateral");
    expect(exerciseKey("  SUPINO   Reto ")).toBe("supino reto");
  });

  it("formatKg e formatTonnes", () => {
    expect(formatKg(82500)).toBe("82,5 kg");
    expect(formatKg(80000)).toBe("80 kg");
    expect(formatKg(0)).toBe("0 kg");
    expect(formatTonnes(19_600_000)).toBe("19,6t");
    expect(formatTonnes(10_000_000)).toBe("10,0t");
    expect(formatTonnes(0)).toBe("0,0t");
  });

  it("isoWeekday e isoWeekNumber", () => {
    expect(isoWeekday("2026-11-09")).toBe(1);
    expect(isoWeekday("2026-11-13")).toBe(5);
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(isoWeekNumber("2026-11-13")).toBe(46);
    expect(isoWeekNumber("2027-01-01")).toBe(53); // sexta: pertence à semana 53 de 2026
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });
});

describe("schemas", () => {
  it("peso: inteiro, não negativo, múltiplo de 500 g", () => {
    const base = { exerciseId: "x", setIndex: 1, reps: 8 };
    expect(WorkoutSetCreate.safeParse({ ...base, weightG: 82500 }).success).toBe(true);
    expect(WorkoutSetCreate.safeParse({ ...base, weightG: 0 }).success).toBe(true);
    expect(WorkoutSetCreate.safeParse({ ...base, weightG: -500 }).success).toBe(false);
    expect(WorkoutSetCreate.safeParse({ ...base, weightG: 82250 }).success).toBe(false);
    expect(WorkoutSetCreate.safeParse({ ...base, weightG: 82.5 }).success).toBe(false);
  });

  it("exercício e plano", () => {
    expect(WorkoutExerciseCreate.safeParse({ name: " ", sets: 3, reps: 8, weightG: 0 }).success).toBe(false);
    expect(WorkoutExerciseCreate.safeParse({ name: "Supino", sets: 11, reps: 8, weightG: 0 }).success).toBe(false);
    expect(WorkoutPlanPut.safeParse({ days: [{ weekday: 8, templateId: null }] }).success).toBe(false);
    expect(
      WorkoutPlanPut.safeParse({
        days: [
          { weekday: 1, templateId: null },
          { weekday: 1, templateId: "a" },
        ],
      }).success,
    ).toBe(false);
    expect(WorkoutPlanPut.safeParse({ days: [], weeklyGoal: 7 }).success).toBe(false);
    expect(WorkoutPlanPut.safeParse({ days: [], weeklyGoal: 3 }).success).toBe(true);
  });
});

describe("XP e recordes", () => {
  it("setXp e sessionXp", () => {
    expect(setXp({ reps: 8 })).toBe(5);
    expect(setXp({ reps: 0 })).toBe(0);
    expect(sessionXp({ sets: [{ reps: 8 }, { reps: 8 }, { reps: 0 }], finished: true }, 1)).toBe(10 + 50 + 30);
    expect(sessionXp({ sets: [{ reps: 8 }], finished: false }, 0)).toBe(5);
  });

  it("isPersonalRecord: primeira vez não conta; exige reps ≥ 1", () => {
    expect(isPersonalRecord(80000, null)).toBe(false);
    expect(isPersonalRecord(80000, undefined)).toBe(false);
    expect(isPersonalRecord(82500, 80000)).toBe(true);
    expect(isPersonalRecord(80000, 80000)).toBe(false);
    expect(isPersonalRecord(82500, 80000, 0)).toBe(false);
  });

  it("recordsBySession: 1 por exercício por sessão; compara só com sessões anteriores", () => {
    const sessions = [sess("a", "2026-11-02"), sess("b", "2026-11-09"), sess("c", "2026-11-11")];
    const sets = [
      set("a", "supino", 1, 80000, 8),
      set("b", "supino", 1, 82500, 8),
      set("b", "supino", 2, 85000, 6),
      set("b", "agacha", 1, 100000, 5), // primeira vez
      set("c", "supino", 1, 85000, 8), // igual ao máximo: não é recorde
      set("c", "agacha", 1, 105000, 0), // 0 reps: não conta
    ];
    const prs = recordsBySession(sessions, sets);
    expect([...prs.get("a")!]).toEqual([]);
    expect([...prs.get("b")!]).toEqual(["supino"]);
    expect([...prs.get("c")!]).toEqual([]);
    expect(priorMaxes(sessions, sets, "c")).toEqual(
      new Map([
        ["supino", 85000],
        ["agacha", 100000],
      ]),
    );
  });

  it("lastTimeByKey: sessão mais recente de cada exercício", () => {
    const sessions = [sess("a", "2026-11-02"), sess("b", "2026-11-09")];
    const sets = [set("a", "supino", 1, 80000, 8), set("a", "remada", 1, 60000, 10), set("b", "supino", 2, 82500, 7), set("b", "supino", 1, 82500, 8)];
    const last = lastTimeByKey(sessions, sets);
    expect(last.get("supino")).toEqual({
      date: "2026-11-09",
      sets: [
        { setIndex: 1, weightG: 82500, reps: 8 },
        { setIndex: 2, weightG: 82500, reps: 7 },
      ],
    });
    expect(last.get("remada")?.date).toBe("2026-11-02");
  });
});

describe("prefill", () => {
  const ex = { sets: 3, reps: 8, weightG: 70000 };
  const last = [
    { setIndex: 1, weightG: 80000, reps: 8 },
    { setIndex: 2, weightG: 80000, reps: 8 },
    { setIndex: 3, weightG: 80000, reps: 8 },
  ];

  it("mesma série da última vez; senão o alvo", () => {
    expect(prefill(last, ex, 2)).toEqual({ weightG: 80000, reps: 8, suggestUp: true });
    expect(prefill(last.slice(0, 1), ex, 2)).toEqual({ weightG: 70000, reps: 8, suggestUp: false });
    expect(prefill(null, ex, 1)).toEqual({ weightG: 70000, reps: 8, suggestUp: false });
  });

  it("suggestUp só quando todas as séries bateram as reps", () => {
    expect(prefill([...last.slice(0, 2), { setIndex: 3, weightG: 80000, reps: 6 }], ex, 1).suggestUp).toBe(false);
  });
});

describe("brasão de treino", () => {
  it("faixas pela fração da meta (meta 4)", () => {
    expect(workoutMedal(0, 4, 0)).toBeNull();
    expect(workoutMedal(1, 4, 0)).toBe("bronze");
    expect(workoutMedal(2, 4, 0)).toBe("prata");
    expect(workoutMedal(3, 4, 0)).toBe("ouro");
    expect(workoutMedal(4, 4, 2)).toBe("diamante");
    expect(workoutMedal(4, 4, 3)).toBe("supremo");
    expect(workoutMedal(5, 4, 0)).toBe("diamante");
  });

  it("meta 3 e 5: arredonda para cima", () => {
    expect(workoutMedal(1, 3, 0)).toBe("bronze");
    expect(workoutMedal(2, 3, 0)).toBe("prata"); // 2 ≥ ceil(1,5)=2 e < ceil(2,25)=3
    expect(workoutMedal(3, 5, 0)).toBe("prata");
    expect(workoutMedal(4, 5, 0)).toBe("ouro");
  });

  it("próximo brasão", () => {
    expect(workoutNextMedal(0, 4, 0)).toEqual({ medal: "bronze", missingWorkouts: 1, missingPrs: 0 });
    expect(workoutNextMedal(3, 4, 0)).toEqual({ medal: "diamante", missingWorkouts: 1, missingPrs: 0 });
    expect(workoutNextMedal(4, 4, 1)).toEqual({ medal: "supremo", missingWorkouts: 0, missingPrs: 2 });
    expect(workoutNextMedal(4, 4, 3)).toBeNull();
  });
});

describe("sequência e conquistas", () => {
  const W = "2026-11-09";
  it("doneByWeek conta 1 por dia e só concluídas", () => {
    expect(
      doneByWeek([sess("a", "2026-11-09"), sess("b", "2026-11-09"), sess("c", "2026-11-10", false), sess("d", "2026-11-02")]),
    ).toEqual({ "2026-11-09": 1, "2026-11-02": 1 });
  });

  it("semana atual incompleta não zera a sequência", () => {
    const weeks = { "2026-10-26": 4, "2026-11-02": 4, [W]: 1 };
    expect(streakWeeks(weeks, 4, W)).toBe(2);
    expect(streakWeeks({ ...weeks, [W]: 4 }, 4, W)).toBe(3);
    expect(streakWeeks({ "2026-10-26": 4, [W]: 4 }, 4, W)).toBe(1); // semana passada falhou
    expect(streakWeeks({}, 4, W)).toBe(0);
  });

  it("bestStreak", () => {
    expect(bestStreak({ "2026-10-05": 4, "2026-10-12": 4, "2026-10-26": 4, "2026-11-02": 5, [W]: 4 }, 4)).toBe(3);
    expect(bestStreak({}, 4)).toBe(0);
  });

  it("semana perfeita e madrugador", () => {
    const done = new Set(["2026-11-09", "2026-11-11", "2026-11-13"]);
    expect(isPerfectWeek([1, 3, 5], done, W)).toBe(true);
    expect(isPerfectWeek([1, 3, 5, 6], done, W)).toBe(false);
    expect(isPerfectWeek([], done, W)).toBe(false);
    expect(startedEarly("2026-11-13T09:30:00.000Z")).toBe(true); // 06:30 em São Paulo
    expect(startedEarly("2026-11-13T10:00:00.000Z")).toBe(false); // 07:00
  });

  it("achievements: limites", () => {
    const base = { bestStreak: 3, totalPrs: 0, maxDayVolumeG: 9_999_999, perfectWeek: false, earlyStart: false };
    expect(achievements(base).filter((a) => a.unlocked)).toEqual([]);
    const all = achievements({ bestStreak: 12, totalPrs: 1, maxDayVolumeG: 10_000_000, perfectWeek: true, earlyStart: true });
    expect(all.map((a) => a.id)).toEqual(["constante", "inquebravel", "recordista", "tonelada", "semana_perfeita", "madrugador"]);
    expect(all.every((a) => a.unlocked)).toBe(true);
    expect(achievements({ ...base, bestStreak: 4 }).find((a) => a.id === "constante")?.unlocked).toBe(true);
  });
});

describe("resumo da sessão", () => {
  it("compara cada exercício com a última vez", () => {
    const mine = [
      { ...set("s", "supino", 1, 82500, 8), exerciseName: "Supino" },
      { ...set("s", "supino", 2, 82500, 8), exerciseName: "Supino" },
      { ...set("s", "remada", 1, 60000, 10), exercisePosition: 1, exerciseName: "Remada" },
      { ...set("s", "crucifixo", 1, 20000, 12), exercisePosition: 2, exerciseName: "Crucifixo" },
    ];
    const prev = [
      { exerciseKey: "supino", weightG: 80000, reps: 8 },
      { exerciseKey: "supino", weightG: 80000, reps: 8 },
      { exerciseKey: "remada", weightG: 62500, reps: 10 },
    ];
    const s = buildSessionSummary(
      { id: "s", date: "2026-11-13", startedAt: "2026-11-13T10:00:00.000Z", finishedAt: "2026-11-13T11:00:00.000Z", templateName: "Treino A" },
      mine,
      prev,
      new Set(["supino"]),
    );
    expect(s.durationS).toBe(3600);
    expect(s.xp).toBe(4 * 5 + 50 + 30);
    expect(s.prs).toBe(1);
    expect(s.volumeG).toBe(82500 * 16 + 600000 + 240000);
    expect(s.prevVolumeG).toBe(80000 * 16 + 625000);
    expect(s.exercises.map((e) => [e.name, e.trend, e.pr])).toEqual([
      ["Supino", "up", true],
      ["Remada", "down", false],
      ["Crucifixo", "new", false],
    ]);
  });
});

describe("relatório semanal", () => {
  const W = "2026-11-09";
  const row = (date: string, key: string, weightG: number, reps = 8): ReportRow => ({
    date,
    exerciseKey: key,
    exerciseName: key === "supino" ? "Supino" : "Remada",
    weightG,
    reps,
  });

  it("delta, N de M, volume e histórico de 6 semanas", () => {
    const rows = [
      row("2026-11-03", "supino", 80000),
      row("2026-11-03", "remada", 60000),
      row("2026-11-10", "supino", 82500),
      row("2026-11-10", "remada", 60000),
      row("2026-11-16", "supino", 999000), // semana seguinte: fora
    ];
    const r = buildWeekReport(rows, W);
    expect(r.previousWeek).toBe("2026-11-02");
    expect(r.exercises.map((e) => [e.exerciseKey, e.maxG, e.prevMaxG, e.deltaG])).toEqual([
      ["supino", 82500, 80000, 2500],
      ["remada", 60000, 60000, 0],
    ]);
    expect(r.improved).toBe(1);
    expect(r.compared).toBe(2);
    expect(r.volumeG).toBe((82500 + 60000) * 8);
    expect(r.prevVolumeG).toBe((80000 + 60000) * 8);
    expect(r.volumeChangePct).toBe(2);
    expect(r.exercises[0].history).toHaveLength(6);
    expect(r.exercises[0].history.at(-1)).toEqual({ week: W, maxG: 82500 });
    expect(r.exercises[0].history.at(-2)).toEqual({ week: "2026-11-02", maxG: 80000 });
    expect(r.exercises[0].history[0]).toEqual({ week: "2026-10-05", maxG: null });
    expect(r.tip).toBeNull();
  });

  it("dica para exercício parado há ≥ 3 semanas", () => {
    const rows = ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"].map((d) => row(d, "remada", 60000));
    const r = buildWeekReport(rows, W);
    expect(r.exercises[0].stagnantWeeks).toBe(3);
    expect(r.tip?.exerciseKey).toBe("remada");
    expect(r.tip?.text).toContain("parada há 3 semanas");
    expect(buildWeekReport(rows.slice(1), W).tip).toBeNull();
  });

  it("semana sem dados", () => {
    const r = buildWeekReport([], W);
    expect(r).toMatchObject({ exercises: [], volumeG: 0, prevVolumeG: 0, volumeChangePct: null, improved: 0, compared: 0 });
  });
});
