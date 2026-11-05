import { describe, expect, it } from "vitest";
import type { Task } from "../../shared/types";
import { sortTasks } from "../../src/lib/useWeek";

const t = (id: string, difficulty: Task["difficulty"], time: string | null, createdAt = "2026-01-01T00:00:00Z"): Task =>
  ({ id, date: "2026-11-05", difficulty, time, createdAt }) as Task;

describe("sortTasks", () => {
  it("ordena por dificuldade: Alta, Média, Baixa", () => {
    const out = sortTasks([t("baixa", "low", "08:00"), t("alta", "high", "18:00"), t("media", "medium", null)]);
    expect(out.map((x) => x.id)).toEqual(["alta", "media", "baixa"]);
  });

  it("na mesma dificuldade: horário, sem horário depois, depois criação", () => {
    const out = sortTasks([
      t("c", "medium", null, "2026-01-02T00:00:00Z"),
      t("b", "medium", "10:00"),
      t("a", "medium", "09:00"),
      t("d", "medium", null, "2026-01-01T00:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "d", "c"]);
  });
});
