export type BrandContact = {
  firstName: string;
  lastName: string;
  email: string;
  /** Numero o link wa.me, senza vincolo di formato */
  whatsapp: string;
};

export function emptyBrandContact(): BrandContact {
  return { firstName: "", lastName: "", email: "", whatsapp: "" };
}

export function parseContactsJson(raw: unknown): BrandContact[] {
  let v: unknown = raw;
  if (typeof v === "string" && v.trim() !== "") {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return [];
    }
  }
  if (!v || !Array.isArray(v)) return [];
  const out: BrandContact[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({
      firstName: String(o.firstName ?? "").trim(),
      lastName: String(o.lastName ?? "").trim(),
      email: String(o.email ?? "").trim(),
      whatsapp: String(o.whatsapp ?? "").trim(),
    });
  }
  return out;
}

/** Una riga riassuntiva per tabella / campo legacy `contacts` */
export function formatContactsSummaryLine(people: BrandContact[]): string {
  if (people.length === 0) return "";
  return people
    .map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
      const extra = [p.email, p.whatsapp].filter(Boolean);
      if (name && extra.length) return [name, ...extra].join(" · ");
      if (name) return name;
      return extra.join(" · ");
    })
    .filter(Boolean)
    .join(" — ");
}
