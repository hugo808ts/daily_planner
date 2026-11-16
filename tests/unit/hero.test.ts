import { describe, expect, it } from "vitest";
import {
  attributeXp,
  buildTower,
  completeDates,
  currentTitle,
  dayComplete,
  daysStreak,
  financeDaysFrom,
  gearFrom,
  heroStage,
  MissionCreate,
  missionActiveOn,
  missionStreak,
  missionXpByWeek,
  radarPoints,
  sourcesPct,
  trailProgress,
  allTrails,
  type HeroFacts,
  type MissionBase,
} from "../../shared/hero";
import { addDays } from "../../shared/dates";

const mission = (id: string, startDate: string, archivedDate: string | null = null, xp = 10): MissionBase => ({
  id,
  title: id,
  attribute: "mental",
  xp,
  position: 0,
  startDate,
  archivedDate,
  createdAt: "",
  updatedAt: "",
});

const emptyFacts = (over: Partial<HeroFacts> = {}): HeroFacts => ({
  taskRows: [],
  missionChecks: [],
  workoutSessions: [],
  financeDays: [],
  weeklyGoal: 3,
  ...over,
});

describe("missões", () => {
  it("vale só entre start_date e archived_date", () => {
    const m = mission("a", "2026-11-10", "2026-11-13");
    expect(missionActiveOn(m, "2026-11-09")).toBe(false);
    expect(missionActiveOn(m, "2026-11-10")).toBe(true);
    expect(missionActiveOn(m, "2026-11-12")).toBe(true);
    expect(missionActiveOn(m, "2026-11-13")).toBe(false);
    expect(missionActiveOn(mission("b", "2026-11-10"), "2030-01-01")).toBe(true);
  });

  it("dayComplete falso sem missões e com 1 de 2 feita", () => {
    const ms = [mission("a", "2026-11-01"), mission("b", "2026-11-01")];
    expect(dayComplete([], [], "2026-11-10")).toBe(false);
    expect(dayComplete(ms, [{ missionId: "a", date: "2026-11-10" }], "2026-11-10")).toBe(false);
    const both = [
      { missionId: "a", date: "2026-11-10" },
      { missionId: "b", date: "2026-11-10" },
    ];
    expect(dayComplete(ms, both, "2026-11-10")).toBe(true);
    expect([...completeDates(ms, both)]).toEqual(["2026-11-10"]);
  });

  it("missão arquivada não conta no dia seguinte", () => {
    const ms = [mission("a", "2026-11-01"), mission("b", "2026-11-01", "2026-11-11")];
    expect(dayComplete(ms, [{ missionId: "a", date: "2026-11-11" }], "2026-11-11")).toBe(true);
  });

  it("sequência com hoje incompleto não zera", () => {
    const dates = ["2026-11-08", "2026-11-09"];
    expect(missionStreak(dates, "2026-11-10")).toBe(2);
    expect(missionStreak([...dates, "2026-11-10"], "2026-11-10")).toBe(3);
    expect(daysStreak(new Set(["2026-11-07"]), "2026-11-10")).toBe(0);
    expect(daysStreak([], "2026-11-10")).toBe(0);
  });

  it("XP de missões por semana", () => {
    const ms = [mission("a", "2026-11-01", null, 20), mission("b", "2026-11-01", null, 5)];
    expect(
      missionXpByWeek(ms, [
        { missionId: "a", date: "2026-11-10" },
        { missionId: "b", date: "2026-11-15" },
        { missionId: "a", date: "2026-11-16" },
      ]),
    ).toEqual({ "2026-11-09": 25, "2026-11-16": 20 });
  });

  it("schema aceita só os XP permitidos", () => {
    expect(MissionCreate.safeParse({ title: "Ler", attribute: "mental", xp: 20 }).success).toBe(true);
    expect(MissionCreate.safeParse({ title: "Ler", attribute: "mental", xp: 15 }).success).toBe(false);
    expect(MissionCreate.safeParse({ title: " ", attribute: "mental", xp: 20 }).success).toBe(false);
    expect(MissionCreate.safeParse({ title: "x".repeat(61), attribute: "mental", xp: 20 }).success).toBe(false);
    expect(MissionCreate.safeParse({ title: "Ler", attribute: "pessoal", xp: 20 }).success).toBe(false);
  });
});

describe("estágio e atributos", () => {
  it("limites de estágio", () => {
    expect(heroStage(1)).toBe("andarilho");
    expect(heroStage(9)).toBe("andarilho");
    expect(heroStage(10)).toBe("patrulheiro");
    expect(heroStage(24)).toBe("patrulheiro");
    expect(heroStage(25)).toBe("guardiao");
  });

  it("área Pessoal fica fora dos atributos", () => {
    const a = attributeXp({
      taskRows: [
        { area: "school", difficulty: "high", n: 2 },
        { area: "work", difficulty: "low", n: 1 },
        { area: "personal", difficulty: "high", n: 5 },
        { area: null, difficulty: "high", n: 5 },
      ],
      missionRows: [
        { attribute: "mental", xp: 20 },
        { attribute: "espiritual", xp: 10 },
      ],
      workoutXp: 70,
      financeDays: 3,
    });
    expect(a.mental).toMatchObject({ xp: 120, level: 1, sources: { tasks: 100, missions: 20, workout: 0, finance: 0 } });
    expect(a.profissional.xp).toBe(10);
    expect(a.espiritual.xp).toBe(10);
    expect(a.fisica.xp).toBe(70);
    expect(a.financeira.xp).toBe(30);
    expect(sourcesPct(a.mental.sources)).toEqual({ tasks: 84, missions: 16, workout: 0, finance: 0 });
    expect(sourcesPct(a.fisica.sources).workout).toBe(100);
  });

  it("financeDaysFrom ignora transferencia/ajuste", () => {
    const mov = (data: string, tipo: string) => ({ data, tipo }) as any;
    expect(
      financeDaysFrom({
        movimentacoes: [
          mov("2026-11-03", "gasto"),
          mov("2026-11-03", "receita"),
          mov("2026-11-01", "aporte"),
          mov("2026-11-04", "transferencia"),
          mov("2026-11-05", "ajuste"),
        ],
      }),
    ).toEqual(["2026-11-01", "2026-11-03"]);
  });

  it("radarPoints com tudo zero (sem NaN)", () => {
    const pts = radarPoints({ fisica: 0, mental: 0, profissional: 0, espiritual: 0, financeira: 0 });
    expect(pts).toHaveLength(5);
    for (const p of pts) expect(p).toMatchObject({ x: 0, y: 0 });
    const top = radarPoints({ fisica: 10, mental: 5, profissional: 0, espiritual: 0, financeira: 0 });
    expect(top[0]).toEqual({ id: "fisica", x: 0, y: -88 });
    expect(Math.hypot(top[1].x, top[1].y)).toBeCloseTo(44, 1);
  });
});

describe("trilhas e peças", () => {
  it("unlockedOn de contagem é o n-ésimo evento", () => {
    const facts = emptyFacts({
      taskRows: [
        { date: "2026-11-02", area: "work", difficulty: "high", n: 6 },
        { date: "2026-11-05", area: "work", difficulty: "high", n: 4 },
        { date: "2026-11-06", area: "work", difficulty: "high", n: 3 },
      ],
    });
    const nodes = trailProgress("profissional", facts, "2026-11-10");
    expect(nodes[0]).toMatchObject({ n: 1, done: true, unlockedOn: "2026-11-02" });
    expect(nodes[1]).toMatchObject({ reward: { kind: "gear", gear: "arco" }, current: 10, target: 10, unlockedOn: "2026-11-05" });
    expect(nodes[2]).toMatchObject({ current: 13, target: 50, done: false, unlockedOn: null });
  });

  it("unlockedOn de sequência é o dia em que chegou ao alvo", () => {
    const days = Array.from({ length: 8 }, (_, i) => addDays("2026-11-01", i)); // 01..08
    const facts = emptyFacts({
      missionChecks: [
        { date: "2026-10-20", attribute: "espiritual", xp: 10 },
        ...days.map((date) => ({ date, attribute: "espiritual" as const, xp: 10 })),
      ],
    });
    const nodes = trailProgress("espiritual", facts, "2026-11-10");
    expect(nodes[0].unlockedOn).toBe("2026-10-20");
    expect(nodes[1]).toMatchObject({ current: 7, done: true, unlockedOn: "2026-11-07" });
    expect(nodes[3]).toMatchObject({ current: 8, target: 30, done: false });
    // Fatos depois de hoje não contam.
    expect(trailProgress("espiritual", facts, "2026-11-05")[1].done).toBe(false);
  });

  it("semanas seguidas de treino com a meta destravam o Elmo", () => {
    const weeks = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
    const sessions = weeks.flatMap((w) =>
      [0, 2, 4].map((d) => ({ date: addDays(w, d), finished: true, xp: 50, prs: 0, volumeG: 0 })),
    );
    const nodes = trailProgress("fisica", emptyFacts({ workoutSessions: sessions }), "2026-11-10");
    expect(nodes[0].unlockedOn).toBe("2026-10-05");
    expect(nodes[1]).toMatchObject({ current: 4, done: true, unlockedOn: "2026-10-30" });
    const trails = allTrails(emptyFacts({ workoutSessions: sessions }), "2026-11-10");
    const gear = gearFrom(trails);
    expect(gear.find((g) => g.id === "elmo")).toMatchObject({ stage: "patrulheiro", unlockedOn: "2026-10-30" });
    expect(gear.find((g) => g.id === "capa")).toMatchObject({ stage: "guardiao", unlockedOn: null });
    expect(currentTitle(trails)).toBe("Iniciante");
  });

  it("peça de estágio maior que o atual continua ganha", () => {
    const facts = emptyFacts({ workoutSessions: [{ date: "2026-11-03", finished: true, xp: 100, prs: 0, volumeG: 10_000_000 }] });
    const gear = gearFrom(allTrails(facts, "2026-11-10"));
    expect(gear.find((g) => g.id === "capa")).toMatchObject({ stage: "guardiao", unlockedOn: "2026-11-03" });
    expect(heroStage(1)).toBe("andarilho");
  });

  it("nó de nível destrava no dia em que o XP chegou", () => {
    const facts = emptyFacts({ financeDays: Array.from({ length: 40 }, (_, i) => addDays("2026-01-01", i)) });
    // nível 2 a partir de 300 XP = 30 dias.
    const nodes = trailProgress("financeira", facts, "2026-12-31");
    expect(nodes[4]).toMatchObject({ current: 2, target: 10, done: false });
    expect(nodes[2].unlockedOn).toBe(addDays("2026-01-01", 29));
    expect(currentTitle(allTrails(facts, "2026-12-31"))).toBe("Tesoureiro");
  });
});

describe("torre", () => {
  it("semana atual em obra, hoje, futuros e bandeira", () => {
    const today = "2026-11-12"; // quinta
    const complete = new Set(["2026-11-03", "2026-11-10", "2026-11-12"]);
    const tower = buildTower({
      weeks: { "2026-11-02": 320 },
      completeDates: complete,
      trainDoneByWeek: { "2026-11-02": 4, "2026-11-09": 1 },
      goal: 4,
      today,
      firstWeek: "2026-10-28",
    });
    expect(tower.map((f) => f.week)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(tower[0]).toMatchObject({ medal: null, trainFlag: false, current: false, litDays: 0 });
    expect(tower[1]).toMatchObject({ medal: "ouro", trainFlag: true, current: false, litDays: 1, weekNumber: 45 });
    expect(tower[1].windows).toEqual(["dark", "lit", "dark", "dark", "dark", "dark", "dark"]);
    expect(tower[2]).toMatchObject({ current: true, trainFlag: false });
    expect(tower[2].windows).toEqual(["dark", "lit", "dark", "lit", "future", "future", "future"]);
    const notYet = buildTower({ weeks: {}, completeDates: new Set(), trainDoneByWeek: {}, goal: 4, today, firstWeek: null });
    expect(notYet).toHaveLength(1);
    expect(notYet[0].windows[3]).toBe("today");
  });
});
