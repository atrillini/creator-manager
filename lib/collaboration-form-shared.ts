export const DELIV_TYPES = ["Video YouTube", "Reel IG", "Story"] as const;

export function isDeliverableType(
  v: string
): v is (typeof DELIV_TYPES)[number] {
  return (DELIV_TYPES as readonly string[]).includes(v);
}

export function parseFee(
  input: string
): { ok: true; value: number } | { ok: false } {
  const feeRaw = (input ?? "").trim();
  if (!feeRaw) {
    return { ok: true, value: 0 };
  }
  const n = Number(feeRaw.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(n) || n < 0) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(s: string) {
  if (!DATE_RE.test(s)) return false;
  const t = new Date(s + "T12:00:00").getTime();
  return !Number.isNaN(t);
}

/** Per input testo € in stile italiano (virgola decimale). */
export function numberToItalianInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toString().replace(".", ",");
}

/** Parse importo da stringa input (virgola o punto). Senza testo → 0. */
export function parseMoneyLocal(s: string) {
  const t = (s ?? "").trim();
  if (!t) return 0;
  return Number(t.replace(/\s/g, "").replace(",", "."));
}
