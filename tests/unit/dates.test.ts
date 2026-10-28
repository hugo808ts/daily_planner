import { describe, expect, it } from "vitest";
import { addDays, formatDayTitle, isSunday, nowParts, todayISO, weekDays, weekStart, weekdayShort } from "../../shared/dates";

describe("dates", () => {
  it("handles year/month boundaries and São Paulo midnight", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(todayISO(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
    expect(nowParts(new Date("2026-10-28T03:00:00Z")).time).toBe("00:00");
  });
  it("todayISO handles UTC rollover", () => {
    expect(todayISO(new Date("2026-10-29T02:30:00Z"))).toBe("2026-10-28");
  });
  it("weekStart returns Monday", () => {
    expect(weekStart("2026-10-28")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });
  it("weekDays lists Mon-Sun", () => {
    const d = weekDays("2026-10-26");
    expect(d).toHaveLength(7);
    expect(d[0]).toBe("2026-10-26");
    expect(d[6]).toBe("2026-11-01");
  });
  it("addDays, weekdayShort, isSunday", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekdayShort("2026-10-28")).toBe("qua");
    expect(isSunday("2026-11-01")).toBe(true);
    expect(isSunday("2026-10-31")).toBe(false);
  });
  it("formatDayTitle", () => {
    expect(formatDayTitle("2026-10-28", "2026-10-28")).toBe("Hoje");
    expect(formatDayTitle("2026-10-29", "2026-10-28")).toBe("Amanhã");
    expect(formatDayTitle("2026-10-27", "2026-10-28")).toBe("Ontem");
    expect(formatDayTitle("2026-10-30", "2026-10-28")).toBe("Sexta, 30 out");
  });
});
