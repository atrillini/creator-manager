/** Categoria = che tipo di email è (una sola per thread). */
export const INBOX_CATEGORIES = [
  "proposta",
  "gifting",
  "trattativa",
  "produzione",
  "amministrazione",
  "eventi",
  "non_pertinente",
] as const;
export type InboxCategory = (typeof INBOX_CATEGORIES)[number];

export const INBOX_CATEGORY_META: Record<
  InboxCategory,
  { label: string; hint: string; className: string; dotClassName: string }
> = {
  proposta: {
    label: "Proposta sponsorizzata",
    hint: "Primo contatto con offerta a pagamento o richiesta tariffe",
    className: "bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-400",
  },
  gifting: {
    label: "Gifting / PR",
    hint: "Invio prodotti senza compenso (seeding, PR box)",
    className: "bg-pink-50 text-pink-700",
    dotClassName: "bg-pink-400",
  },
  trattativa: {
    label: "Trattativa",
    hint: "Deal avviato non ancora chiuso: controproposte, conferme, media kit",
    className: "bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-400",
  },
  produzione: {
    label: "Produzione",
    hint: "Deal chiuso: brief, contratti, script, approvazioni, date di uscita",
    className: "bg-violet-50 text-violet-700",
    dotClassName: "bg-violet-400",
  },
  amministrazione: {
    label: "Amministrazione",
    hint: "Pagamenti, dati di fatturazione, ricevute, solleciti",
    className: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-400",
  },
  eventi: {
    label: "Eventi e inviti",
    hint: "Lanci, press day, viaggi, inviti",
    className: "bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-400",
  },
  non_pertinente: {
    label: "Non pertinente",
    hint: "Spam, newsletter, notifiche automatiche, richieste fuori target",
    className: "bg-gray-100 text-gray-600",
    dotClassName: "bg-gray-400",
  },
};

/** Stato = cosa devo fare. */
export const INBOX_STATUSES = ["nuova", "da_rispondere", "in_attesa", "gestita", "archiviata"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const INBOX_STATUS_META: Record<InboxStatus, { label: string; className: string }> = {
  nuova: { label: "Nuova", className: "bg-blue-500 text-white" },
  da_rispondere: { label: "Da rispondere", className: "bg-amber-100 text-amber-800" },
  in_attesa: { label: "In attesa del brand", className: "bg-gray-100 text-gray-700" },
  gestita: { label: "Gestita", className: "bg-emerald-50 text-emerald-700" },
  archiviata: { label: "Archiviata", className: "bg-gray-50 text-gray-400" },
};

export const INBOX_QUALITY_LABELS = { alta: "Qualità alta", media: "Qualità media", bassa: "Qualità bassa" } as const;
export type InboxQuality = keyof typeof INBOX_QUALITY_LABELS;

export function isInboxCategory(v: string | null | undefined): v is InboxCategory {
  return !!v && (INBOX_CATEGORIES as readonly string[]).includes(v);
}

export function isInboxStatus(v: string | null | undefined): v is InboxStatus {
  return !!v && (INBOX_STATUSES as readonly string[]).includes(v);
}

/** Domini di posta generica: non identificano un brand. */
export const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "outlook.com",
  "outlook.it",
  "hotmail.com",
  "hotmail.it",
  "live.com",
  "live.it",
  "yahoo.com",
  "yahoo.it",
  "libero.it",
  "virgilio.it",
  "tiscali.it",
  "alice.it",
  "tim.it",
  "fastwebnet.it",
  "email.it",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
]);

export function emailDomain(email: string | null | undefined): string | null {
  const at = (email ?? "").lastIndexOf("@");
  if (at < 0) return null;
  return email!.slice(at + 1).trim().toLowerCase() || null;
}
