import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  MEDALS,
  XP_BY_DIFFICULTY,
  levelFromXp,
  medalFor,
  nextMedal,
  taskXp,
  xpToNext,
} from "../../shared/xp";

describe("dificuldade e XP da tarefa", () => {
  it("valores fixos", () => {
    expect(DIFFICULTIES).toEqual(["low", "medium", "high"]);
    expect(XP_BY_DIFFICULTY).toEqual({ low: 10, medium: 25, high: 50 });
  });

  it("taskXp: só conta tarefa feita", () => {
    expect(taskXp({ difficulty: "low", doneAt: "2026-11-05T10:00:00Z" })).toBe(10);
    expect(taskXp({ difficulty: "medium", doneAt: "2026-11-05T10:00:00Z" })).toBe(25);
    expect(taskXp({ difficulty: "high", doneAt: "2026-11-05T10:00:00Z" })).toBe(50);
    expect(taskXp({ difficulty: "high", doneAt: null })).toBe(0);
  });
});

describe("medalha da semana", () => {
  it("MEDALS em ordem, com limites e rótulos", () => {
    expect(MEDALS.map((m) => [m.tier, m.label, m.min])).toEqual([
      ["bronze", "Bronze", 1],
      ["prata", "Prata", 150],
      ["ouro", "Ouro", 300],
      ["diamante", "Diamante", 500],
      ["supremo", "Supremo", 750],
    ]);
  });

  it("limites exatos", () => {
    expect(medalFor(0)).toBeNull();
    expect(medalFor(1)).toBe("bronze");
    expect(medalFor(149)).toBe("bronze");
    expect(medalFor(150)).toBe("prata");
    expect(medalFor(299)).toBe("prata");
    expect(medalFor(300)).toBe("ouro");
    expect(medalFor(499)).toBe("ouro");
    expect(medalFor(500)).toBe("diamante");
    expect(medalFor(749)).toBe("diamante");
    expect(medalFor(750)).toBe("supremo");
    expect(medalFor(5000)).toBe("supremo");
  });

  it("nextMedal: quanto falta para a próxima", () => {
    expect(nextMedal(0)).toEqual({ medal: "bronze", missing: 1 });
    expect(nextMedal(149)).toEqual({ medal: "prata", missing: 1 });
    expect(nextMedal(215)).toEqual({ medal: "ouro", missing: 85 });
    expect(nextMedal(749)).toEqual({ medal: "supremo", missing: 1 });
    expect(nextMedal(750)).toBeNull();
    expect(nextMedal(900)).toBeNull();
  });
});

describe("nível", () => {
  it("xpToNext cresce 20% por nível", () => {
    expect(xpToNext(1)).toBe(300);
    expect(xpToNext(2)).toBe(360);
    expect(xpToNext(3)).toBe(432);
    expect(xpToNext(4)).toBe(518);
  });

  it("levelFromXp: limites exatos", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, needed: 300 });
    expect(levelFromXp(299)).toEqual({ level: 1, into: 299, needed: 300 });
    expect(levelFromXp(300)).toEqual({ level: 2, into: 0, needed: 360 });
    expect(levelFromXp(659)).toEqual({ level: 2, into: 359, needed: 360 });
    expect(levelFromXp(660)).toEqual({ level: 3, into: 0, needed: 432 });
    expect(levelFromXp(1092)).toEqual({ level: 4, into: 0, needed: 518 });
  });
});
