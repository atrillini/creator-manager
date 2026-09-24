export type BrandBilling = {
  /** Ragione sociale in ricevuta (se vuota si usa il nome brand) */
  billingName: string;
  /** Multi-riga */
  billingAddress: string;
  vatNumber: string;
  /** Righe libere (telefono, direzione…) */
  billingExtra: string;
  receiptLanguage: "it" | "en";
};

export function emptyBrandBilling(): BrandBilling {
  return { billingName: "", billingAddress: "", vatNumber: "", billingExtra: "", receiptLanguage: "it" };
}

export function brandBillingFromRow(row: {
  billing_name?: string | null;
  billing_address?: string | null;
  vat_number?: string | null;
  billing_extra?: string | null;
  receipt_language?: string | null;
}): BrandBilling {
  return {
    billingName: row.billing_name ?? "",
    billingAddress: row.billing_address ?? "",
    vatNumber: row.vat_number ?? "",
    billingExtra: row.billing_extra ?? "",
    receiptLanguage: row.receipt_language === "en" ? "en" : "it",
  };
}

export function brandBillingToRow(b: BrandBilling | undefined) {
  if (!b) return {};
  return {
    billing_name: b.billingName.trim() || null,
    billing_address: b.billingAddress.trim() || null,
    vat_number: b.vatNumber.trim() || null,
    billing_extra: b.billingExtra.trim() || null,
    receipt_language: b.receiptLanguage === "en" ? "en" : "it",
  };
}
