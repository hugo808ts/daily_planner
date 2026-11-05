import { describe, expect, it } from "vitest";
import { computeWeekReport } from "../../shared/report";
import type { Task } from "../../shared/types";

const SUNDAY = new Date("2026-11-01T09:00:00-03:00");
const START = "2026-10-26";
let n = 0;
const mk = (p: Partial<Task>): Task => ({
  id: `t${n++}`, title: "t", date: START, time: null, area: null, difficulty: "medium", doneAt: null,
  movedFromId: null, createdAt: "", updatedAt: "", ...p,
});
const done = "2026-10-27T10:00:00-03:00";

describe("computeWeekReport", () => {
  it("counts Mon-Sat only; Sunday tasks ignored", () => {
    const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"];
    const tasks = [
      ...Array.from({ length: 10 }, (_, i) => mk({ date: days[i % 6], doneAt: done })),
      ...Array.from({ length: 5 }, (_, i) => mk({ date: days[i] })),
      mk({ date: "2026-11-01" }),
      mk({ date: "2026-11-01" }),
    ];
    const r = computeWeekReport(tasks, START, SUNDAY);
    expect(r.done).toBe(10);
    expect(r.notDone).toBe(5);
    expect(r.percent).toBe(67);
    expect(r.perDay).toHaveLength(6);
    expect(r.start).toBe("2026-10-26");
    expect(r.end).toBe("2026-10-31");
    expect(r.notDoneTasks).toHaveLength(5);
    expect(r.perDay.reduce((s, d) => s + d.done, 0)).toBe(10);
  });

  it("task done late counts as done", () => {
    const r = computeWeekReport([mk({ doneAt: "2026-11-02T08:00:00-03:00" })], START, SUNDAY);
    expect(r.done).toBe(1);
    expect(r.notDone).toBe(0);
  });

  it("pending future tasks are excluded mid-week", () => {
    const wed = new Date("2026-10-28T12:00:00-03:00");
    const tasks = [
      mk({ date: "2026-10-26", doneAt: done }),
      mk({ date: "2026-10-27" }),
      mk({ date: "2026-10-29" }),
      mk({ date: "2026-10-31" }),
    ];
    const r = computeWeekReport(tasks, START, wed);
    expect(r.done).toBe(1);
    expect(r.notDone).toBe(1);
    expect(r.percent).toBe(50);
  });

  it("moved copy and not-done original count in their own weeks", () => {
    const original = mk({ id: "a", date: "2026-10-27" });
    const copy = mk({ id: "b", date: "2026-11-02", movedFromId: "a", doneAt: "2026-11-02T10:00:00-03:00" });
    const later = new Date("2026-11-08T09:00:00-03:00");
    const w1 = computeWeekReport([original, copy], START, later);
    const w2 = computeWeekReport([original, copy], "2026-11-02", later);
    expect([w1.done, w1.notDone]).toEqual([0, 1]);
    expect([w2.done, w2.notDone]).toEqual([1, 0]);
  });

  it("zero tasks gives 0%", () => {
    const r = computeWeekReport([], START, SUNDAY);
    expect(r.percent).toBeNull();
    expect(r.perDay).toHaveLength(6);
    expect(r).toMatchObject({ xp: 0, medal: null, bestDay: null, byDifficulty: { low: 0, medium: 0, high: 0 } });
  });

  it("XP, medalha, feitas por dificuldade e melhor dia (domingo e não feitas fora)", () => {
    const tasks = [
      mk({ date: "2026-10-26", difficulty: "high", doneAt: done }), // 50
      mk({ date: "2026-10-26", difficulty: "low", doneAt: done }), // 10
      mk({ date: "2026-10-28", difficulty: "high", doneAt: done }), // 50
      mk({ date: "2026-10-28", difficulty: "medium", doneAt: done }), // 25
      mk({ date: "2026-10-30", difficulty: "medium", doneAt: done }), // 25
      mk({ date: "2026-10-30", difficulty: "high" }), // não feita
      mk({ date: "2026-11-01", difficulty: "high", doneAt: done }), // domingo
    ];
    const r = computeWeekReport(tasks, START, SUNDAY);
    expect(r.xp).toBe(160);
    expect(r.medal).toBe("prata");
    expect(r.byDifficulty).toEqual({ low: 1, medium: 2, high: 2 });
    expect(r.bestDay).toBe("2026-10-28");
  });

  it("melhor dia: empate fica com o primeiro", () => {
    const r = computeWeekReport(
      [mk({ date: "2026-10-29", doneAt: done }), mk({ date: "2026-10-27", doneAt: done })],
      START,
      SUNDAY,
    );
    expect(r.bestDay).toBe("2026-10-27");
    expect(r.medal).toBe("bronze");
  });
});
