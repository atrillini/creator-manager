/** Normalizzazione dell'output AI (brief/email) verso i valori del form collaborazione. */

export function pickBrandIdByName(brands: { id: string; name: string }[], fromAi: string): string | undefined {
  const q = fromAi.trim().toLowerCase();
  if (!q) return undefined;
  const exact = brands.find((b) => b.name.trim().toLowerCase() === q);
  if (exact) return exact.id;
  const partial = brands.find((b) => b.name.trim().toLowerCase().includes(q));
  return partial?.id;
}

export function normalizeDeliverableType(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("story")) return "Story";
  if (t.includes("reel") || t.includes("ig")) return "Reel IG";
  if (t.includes("youtube") || t.includes("yt")) return "Video YouTube";
  return null;
}

export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?$/i);
  if (!m) return null;
  const day = Number(m[1]);
  const monthName = m[2];
  const year = Number(m[3] ?? new Date().getFullYear());
  const monthMap: Record<string, number> = {
    gen: 1, gennaio: 1,
    feb: 2, febbraio: 2,
    mar: 3, marzo: 3,
    apr: 4, aprile: 4,
    mag: 5, maggio: 5,
    giu: 6, giugno: 6,
    lug: 7, luglio: 7,
    ago: 8, agosto: 8,
    set: 9, settembre: 9,
    ott: 10, ottobre: 10,
    nov: 11, novembre: 11,
    dic: 12, dicembre: 12,
  };
  const month = monthMap[monthName];
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
