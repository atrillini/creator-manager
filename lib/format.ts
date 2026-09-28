const eurFormatters = new Map<string, Intl.NumberFormat>();

/** Importo in euro, formato italiano. `decimals: 0` per i totali delle card. */
export function formatEur(n: number, opts: { decimals?: 0 | 2; signed?: boolean } = {}) {
  const decimals = opts.decimals ?? 2;
  const key = `${decimals}:${opts.signed ? 1 : 0}`;
  let f = eurFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: opts.signed ? "exceptZero" : "auto",
    });
    eurFormatters.set(key, f);
  }
  return f.format(n);
}

/** Valore numerico da Postgres (`numeric` arriva spesso come stringa); null se vuoto o non valido. */
export function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = v.trim();
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Importo formattato o null (per campi opzionali come compenso o valore giveaway). */
export function formatEurOrNull(v: number | string | null | undefined): string | null {
  const n = toNumberOrNull(v);
  return n == null ? null : formatEur(n);
}

/** YYYY-MM-DD nel fuso locale. */
export function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
