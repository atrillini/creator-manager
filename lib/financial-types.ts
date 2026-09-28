/** Tipi di `financials`. "Entrata YouTube" arriva solo dalla sync; gli altri sono manuali. */
export const MANUAL_FINANCIAL_TYPES = [
  "Entrata Sponsor",
  "Altra entrata",
  "Spesa Materiale",
  "Altra spesa",
] as const;

export type ManualFinancialType = (typeof MANUAL_FINANCIAL_TYPES)[number];

export const MANUAL_FINANCIAL_TYPE_OPTIONS: { value: ManualFinancialType; label: string; hint: string }[] = [
  { value: "Entrata Sponsor", label: "Entrata sponsor", hint: "Incasso da brand non registrato come collaborazione" },
  { value: "Altra entrata", label: "Altra entrata", hint: "Affiliazioni, diritti, bonus piattaforme…" },
  { value: "Spesa Materiale", label: "Spesa materiale", hint: "Attrezzatura, prodotti, scenografia" },
  { value: "Altra spesa", label: "Altra spesa", hint: "Software, viaggi, collaboratori…" },
];

export function isManualFinancialType(v: string): v is ManualFinancialType {
  return (MANUAL_FINANCIAL_TYPES as readonly string[]).includes(v);
}

export function isExpenseType(type: string) {
  return type === "Spesa Materiale" || type === "Altra spesa";
}
