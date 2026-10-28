import { describe, expect, it } from "vitest";
import { dayScore, taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";

const now = new Date("2026-10-28T18:00:00-03:00");
const mk = (p: Partial<Task>): Task => ({
  id: "x", title: "t", date: "2026-10-28", time: null, area: null, doneAt: null,
  movedFromId: null, createdAt: "", updatedAt: "", ...p,
});
const tasks = [
  mk({ time: "14:00" }),
  mk({ time: "14:00", doneAt: "2026-10-28T19:00:00-03:00" }),
  mk({}),
  mk({ date: "2026-10-27" }),
  mk({ time: "20:00" }),
  mk({ date: "2026-10-27", doneAt: "2026-10-27T10:00:00-03:00" }),
];

describe("taskStatus", () => {
  it("covers cases", () => {
    expect(tasks.map((t) => taskStatus(t, now))).toEqual(["overdue", "done", "pending", "not_done", "pending", "done"]);
  });
  it("same minute is pending; future date pending", () => {
    expect(taskStatus(mk({ time: "18:00" }), now)).toBe("pending");
    expect(taskStatus(mk({ date: "2026-10-29", time: "01:00" }), now)).toBe("pending");
  });
});

describe("dayScore", () => {
  it("counts", () => {
    expect(dayScore(tasks, now)).toEqual({ done: 2, overdue: 1, notDone: 1, pending: 2, total: 6 });
  });
});
