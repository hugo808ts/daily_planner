export type Preview = { title: string | null; thumb: string | null };

const NONE: Preview = { title: null, thumb: null };
const TIKTOK = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"]);
const YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const TIMEOUT_MS = 3000;

function oembedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (TIKTOK.has(host)) return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (YOUTUBE.has(host)) return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  return null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export const THUMB_MAX = 2048;

/** Only https URLs up to THUMB_MAX chars are kept as thumbnails. */
export function safeThumb(v: unknown): string | null {
  if (typeof v !== "string" || v.length > THUMB_MAX) return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/** Best effort: never throws; any failure yields nulls. */
export async function fetchPreview(url: string, fetcher: typeof fetch = fetch): Promise<Preview> {
  const target = oembedUrl(url);
  if (!target) return NONE;
  try {
    const res = await fetcher(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return NONE;
    const data = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
    return { title: str(data.title), thumb: safeThumb(data.thumbnail_url) };
  } catch {
    return NONE;
  }
}
