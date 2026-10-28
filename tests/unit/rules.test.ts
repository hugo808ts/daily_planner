import { describe, expect, it } from "vitest";
import { parseCapture } from "../../shared/rules";

const TODAY = "2026-10-28"; // Wednesday
const folders = [{ id: "f1", name: "Estudos" }];
const parse = (t: string) => parseCapture(t, TODAY, folders);

describe("parseCapture", () => {
  it("parses the full work example", () => {
    expect(parse("amanhã no trabalho tenho que apresentar o relatório pro gerente às 10")).toEqual({
      kind: "task",
      title: "Apresentar o relatório pro gerente",
      date: "2026-10-29",
      time: "10:00",
      area: "work",
      folderId: null,
      source: "rules",
    });
  });
  it("parses weekday, 14h30 and school area", () => {
    const r = parse("sexta estudar cálculo 14h30");
    expect(r).toMatchObject({ date: "2026-10-30", time: "14:30", area: "school", title: "Estudar cálculo" });
  });
  it("parses period 'à noite' and personal area", () => {
    expect(parse("hoje à noite jantar com a namorada")).toMatchObject({
      date: "2026-10-28",
      time: "20:00",
      area: "personal",
      title: "Jantar com a namorada",
    });
  });
  it("maps periods", () => {
    expect(parse("amanhã de manhã correr").time).toBe("09:00");
    expect(parse("amanha a tarde correr").time).toBe("15:00");
  });
  it("explicit time beats period", () => {
    expect(parse("hoje à tarde reunião às 16h").time).toBe("16:00");
  });
  it("parses 10h, 14:30 and meio-dia, zero-padded", () => {
    expect(parse("ligar 9h").time).toBe("09:00");
    expect(parse("ligar 14:30").time).toBe("14:30");
    expect(parse("almoço meio-dia")).toMatchObject({ time: "12:00", title: "Almoço" });
  });
  it("weekday is never today", () => {
    expect(parse("quarta reunião").date).toBe("2026-11-04");
    expect(parse("segunda reunião").date).toBe("2026-11-02");
    expect(parse("na próxima segunda-feira reunião").date).toBe("2026-11-02");
    expect(parse("sabado academia").date).toBe("2026-10-31");
  });
  it("parses dia N", () => {
    expect(parse("dia 5 entregar trabalho")).toMatchObject({ date: "2026-11-05", title: "Entregar trabalho" });
    expect(parse("dia 30 pagar conta").date).toBe("2026-10-30");
  });
  it("parses depois de amanhã", () => {
    expect(parse("depois de amanhã dentista")).toMatchObject({ date: "2026-10-30", area: "personal", title: "Dentista" });
  });
  it("defaults to today with no area/time", () => {
    expect(parse("comprar pão")).toEqual({
      kind: "task",
      title: "Comprar pão",
      date: "2026-10-28",
      time: null,
      area: null,
      folderId: null,
      source: "rules",
    });
  });
  it("first area keyword wins", () => {
    expect(parse("academia depois da reunião").area).toBe("personal");
  });
  it("strips leading filler", () => {
    expect(parse("preciso de ligar pro banco").title).toBe("Ligar pro banco");
    expect(parse("não esquecer de pagar a luz").title).toBe("Pagar a luz");
  });
  it("falls back to original text when cleanup is empty", () => {
    expect(parse("amanhã às 10")).toMatchObject({ title: "amanhã às 10", date: "2026-10-29", time: "10:00" });
  });
  it("parses an idea without folder match", () => {
    expect(parse("ideia: revisão espaçada")).toEqual({
      kind: "idea",
      title: "Revisão espaçada",
      date: null,
      time: null,
      area: null,
      folderId: null,
      source: "rules",
    });
  });
  it("matches idea folder by whole word, accent-insensitively", () => {
    expect(parse("ideia: estudos de revisão espaçada")).toMatchObject({ kind: "idea", folderId: "f1" });
    expect(parseCapture("ideia: livro", TODAY, [{ id: "f2", name: "Séries" }]).folderId).toBeNull();
    expect(parseCapture("ideia: ver series novas", TODAY, [{ id: "f2", name: "Séries" }]).folderId).toBe("f2");
  });
});
