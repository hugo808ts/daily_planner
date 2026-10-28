import { describe, expect, it, vi } from "vitest";
import { fetchPreview } from "../../worker/preview";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("fetchPreview", () => {
  it("TikTok: usa oembed e mapeia title/thumbnail_url", async () => {
    const f = vi.fn(async (_u: string) => json({ title: "Vídeo legal", thumbnail_url: "https://p16.tiktokcdn.com/a.jpg" }));
    const url = "https://www.tiktok.com/@u/video/123";
    const r = await fetchPreview(url, f as unknown as typeof fetch);
    expect(r).toEqual({ title: "Vídeo legal", thumb: "https://p16.tiktokcdn.com/a.jpg" });
    expect(f.mock.calls[0][0]).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  });

  it("YouTube: usa oembed com format=json", async () => {
    const f = vi.fn(async (_u: string) => json({ title: "Aula", thumbnail_url: "https://i.ytimg.com/vi/x/hq.jpg" }));
    const url = "https://youtu.be/abc123";
    const r = await fetchPreview(url, f as unknown as typeof fetch);
    expect(r).toEqual({ title: "Aula", thumb: "https://i.ytimg.com/vi/x/hq.jpg" });
    expect(f.mock.calls[0][0]).toBe(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  });

  it("host fora da lista: nulos sem buscar", async () => {
    const f = vi.fn();
    expect(await fetchPreview("https://evil.example.com/x", f as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
    expect(await fetchPreview("https://tiktok.com.evil.com/x", f as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
    expect(await fetchPreview("not a url", f as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
    expect(f).not.toHaveBeenCalled();
  });

  it("erro de rede, status ruim ou JSON inválido: nulos", async () => {
    const url = "https://www.youtube.com/watch?v=1";
    expect(await fetchPreview(url, (async () => { throw new Error("boom"); }) as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
    expect(await fetchPreview(url, (async () => new Response("no", { status: 404 })) as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
    expect(await fetchPreview(url, (async () => new Response("<html>")) as unknown as typeof fetch)).toEqual({ title: null, thumb: null });
  });

  it("timeout de 3 s: aborta e devolve nulos", async () => {
    const f = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const t0 = Date.now();
    expect(await fetchPreview("https://vm.tiktok.com/abc", f)).toEqual({ title: null, thumb: null });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2900);
  }, 8000);
});
