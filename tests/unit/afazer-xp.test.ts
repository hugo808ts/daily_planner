import { describe, expect, it } from "vitest";
import { computeWeekReport } from "../../shared/report";
import { taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { taskXpDay } from "../../shared/xp";

let n = 0;
const mk = (p: Partial<Task>): Task => ({
  id: `a${n++}`, title: "t", date: null, time: null, area: null, difficulty: "medium", doneAt: null,
  movedFromId: null, createdAt: "", updatedAt: "", ...p,
});

describe("taskXpDay", () => {
  it("antes da data de corte vale o dia da tarefa", () => {
    expect(taskXpDay(mk({ date: "2026-11-10", doneAt: "2026-11-12T13:00:00.000Z" }))).toBe("2026-11-10");
  });
  it("a partir da data de corte vale o dia local de done_at", () => {
    expect(taskXpDay(mk({ date: "2026-11-24", doneAt: "2026-11-26T13:00:00.000Z" }))).toBe("2026-11-26");
    // 02:30 UTC do dia 26 ainda é dia 25 em São Paulo.
    expect(taskXpDay(mk({ date: "2026-11-24", doneAt: "2026-11-26T02:30:00.000Z" }))).toBe("2026-11-25");
  });
  it("sem data vale sempre o dia de done_at; não feita = null", () => {
    expect(taskXpDay(mk({ doneAt: "2026-11-02T13:00:00.000Z" }))).toBe("2026-11-02");
    expect(taskXpDay(mk({}))).toBeNull();
  });
});

describe("status sem data", () => {
  it("nunca atrasada nem não feita", () => {
    expect(taskStatus(mk({ time: "08:00" }), new Date("2030-01-01T12:00:00-03:00"))).toBe("pending");
    expect(taskStatus(mk({ doneAt: "2026-11-24T12:00:00.000Z" }))).toBe("done");
  });
});

describe("computeWeekReport com a data de corte", () => {
  it("semana antiga não muda: feita depois conta no dia da tarefa", () => {
    const start = "2026-11-09";
    const tasks = [
      mk({ date: "2026-11-10", doneAt: "2026-11-13T13:00:00.000Z" }),
      mk({ date: "2026-11-11", difficulty: "high", doneAt: "2026-11-11T13:00:00.000Z" }),
    ];
    const r = computeWeekReport(tasks, start, new Date("2026-11-15T12:00:00-03:00"));
    expect(r.perDay.find((d) => d.date === "2026-11-10")?.done).toBe(1);
    expect(r.perDay.find((d) => d.date === "2026-11-13")?.done).toBe(0);
    expect(r.xp).toBe(75);
    expect(r.medal).toBe("bronze");
    expect(r.bestDay).toBe("2026-11-11");
  });

  it("semana nova: conta no dia do check; sem data pendente não vira não feita", () => {
    const start = "2026-11-23";
    const tasks = [
      mk({ date: "2026-11-24", doneAt: "2026-11-26T13:00:00.000Z" }),
      mk({ doneAt: "2026-11-27T13:00:00.000Z", difficulty: "high" }),
      mk({}),
      mk({ date: "2026-11-25" }),
    ];
    const r = computeWeekReport(tasks, start, new Date("2026-11-29T12:00:00-03:00"));
    expect(r.perDay.find((d) => d.date === "2026-11-24")).toMatchObject({ done: 0, notDone: 0 });
    expect(r.perDay.find((d) => d.date === "2026-11-26")?.done).toBe(1);
    expect(r.perDay.find((d) => d.date === "2026-11-27")?.done).toBe(1);
    expect(r.notDone).toBe(1);
    expect(r.notDoneTasks.map((t) => t.date)).toEqual(["2026-11-25"]);
    expect(r.xp).toBe(75);
    expect(r.bestDay).toBe("2026-11-27");
  });

  it("feita fora da semana não conta nela", () => {
    const r = computeWeekReport([mk({ date: "2026-11-28", doneAt: "2026-12-01T13:00:00.000Z" })], "2026-11-23", new Date("2026-12-02T12:00:00-03:00"));
    expect(r.done).toBe(0);
    expect(r.xp).toBe(0);
  });
});
