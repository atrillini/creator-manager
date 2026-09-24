"use server";

import { revalidatePath } from "next/cache";
import { refreshPaidFlag } from "@/lib/collaboration-paid-flag";
import { getReceiptById, loadIssuerProfile } from "@/lib/data/receipts";
import { isValidUuid } from "@/lib/is-uuid";
import {
  computeAmounts,
  formatReceiptNumber,
  missingProfileFields,
  toIssuerSnapshot,
  toPaymentDetails,
  type IssuerProfile,
  type PaymentMethod,
  type ReceiptLanguage,
  type ReceiptRecipient,
} from "@/lib/receipts/model";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

type Result = { ok: true } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SIGNATURE_LENGTH = 400_000;

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace("€", "");
  if (!t) return null;
  // "1.250,50" → 1250.50 ; "1250.50" → 1250.50
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function revalidateReceiptPaths(...collaborationIds: (string | null | undefined)[]) {
  revalidatePath("/ricevute");
  revalidatePath("/finanze");
  for (const id of new Set(collaborationIds)) {
    if (id) revalidateCollaborationPaths(id);
  }
}

function trimProfile(p: IssuerProfile): IssuerProfile {
  const out = { ...p };
  for (const k of Object.keys(out) as (keyof IssuerProfile)[]) {
    const v = out[k];
    if (typeof v === "string") (out as Record<string, unknown>)[k] = v.trim();
  }
  return out;
}

export async function saveIssuerProfile(input: IssuerProfile): Promise<Result> {
  const p = trimProfile(input);
  if (p.birthDate && !ISO_DATE.test(p.birthDate)) {
    return { ok: false, error: "Data di nascita non valida" };
  }
  if (p.signatureDataUrl && !/^data:image\/(png|jpe?g);base64,/i.test(p.signatureDataUrl)) {
    return { ok: false, error: "La firma deve essere un'immagine PNG o JPG" };
  }
  if (p.signatureDataUrl.length > MAX_SIGNATURE_LENGTH) {
    return { ok: false, error: "Immagine firma troppo grande (max ~300 KB)" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase.from("issuer_profiles").upsert({
    user_id: userId,
    updated_at: new Date().toISOString(),
    full_name: p.fullName || null,
    alias: p.alias || null,
    gender: p.gender === "m" ? "m" : "f",
    birth_place: p.birthPlace || null,
    birth_date: p.birthDate || null,
    street: p.street || null,
    postal_code: p.postalCode || null,
    city: p.city || null,
    province: p.province || null,
    country: p.country || null,
    tax_code: p.taxCode.toUpperCase() || null,
    email: p.email || null,
    default_place: p.defaultPlace || null,
    default_description_it: p.defaultDescriptionIt || null,
    default_description_en: p.defaultDescriptionEn || null,
    default_payment_method: p.defaultPaymentMethod === "paypal" ? "paypal" : "bank",
    bank_name: p.bankName || null,
    iban: p.iban.replace(/\s/g, "").toUpperCase() || null,
    bic: p.bic.toUpperCase() || null,
    bank_address: p.bankAddress || null,
    account_holder: p.accountHolder || null,
    paypal_email: p.paypalEmail || null,
    signature_data_url: p.signatureDataUrl || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ricevute");
  return { ok: true };
}

export type SaveReceiptInput = {
  id?: string;
  legacy: boolean;
  brandId: string | null;
  collaborationId: string | null;
  number: number;
  issueDate: string;
  language: ReceiptLanguage;
  gross: string;
  withholdingRate: number;
  stampDuty: boolean;
  description: string;
  place: string;
  paymentMethod: PaymentMethod;
  recipient: ReceiptRecipient;
  /** Solo per i legacy: stato iniziale. */
  legacyStatus?: "emessa" | "pagata";
  notes: string;
};

export async function saveReceipt(
  input: SaveReceiptInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (input.id && !isValidUuid(input.id)) return { ok: false, error: "ID ricevuta non valido" };
  if (input.brandId && !isValidUuid(input.brandId)) return { ok: false, error: "Brand non valido" };
  if (input.collaborationId && !isValidUuid(input.collaborationId)) {
    return { ok: false, error: "Collaborazione non valida" };
  }
  if (!ISO_DATE.test(input.issueDate)) return { ok: false, error: "Data di emissione non valida" };
  if (!Number.isInteger(input.number) || input.number < 1) {
    return { ok: false, error: "Numero ricevuta non valido" };
  }
  const gross = parseAmount(input.gross);
  if (!gross) return { ok: false, error: "Importo non valido" };
  const rate = Number(input.withholdingRate) || 0;
  if (rate < 0 || rate >= 100) return { ok: false, error: "Ritenuta non valida" };
  const recipient: ReceiptRecipient = {
    name: input.recipient.name.trim(),
    address: input.recipient.address.trim(),
    vatNumber: input.recipient.vatNumber.trim(),
    extra: input.recipient.extra.trim(),
  };
  if (!recipient.name) return { ok: false, error: "Inserisci l'intestatario (committente)" };

  const year = Number(input.issueDate.slice(0, 4));
  const amounts = computeAmounts(gross, rate);
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  const existing = input.id ? await getReceiptById(supabase, userId, input.id) : null;
  if (input.id && !existing) return { ok: false, error: "Ricevuta non trovata" };

  let issuer: object = {};
  let paymentDetails: object = {};
  if (!input.legacy) {
    const profile = await loadIssuerProfile(supabase, userId);
    const missing = missingProfileFields(profile, input.paymentMethod);
    if (missing.length) {
      return {
        ok: false,
        error: `Completa il profilo fiscale prima di emettere: ${missing.join(", ")}`,
      };
    }
    issuer = toIssuerSnapshot(profile);
    paymentDetails = toPaymentDetails(profile);
  }

  const row = {
    brand_id: input.brandId,
    collaboration_id: input.collaborationId,
    number: input.number,
    year,
    issue_date: input.issueDate,
    language: input.language === "en" ? "en" : "it",
    is_legacy: input.legacy,
    gross_amount: amounts.gross,
    withholding_rate: rate,
    withholding_amount: amounts.withholding,
    net_amount: amounts.net,
    stamp_duty: input.stampDuty,
    description: input.description.trim() || null,
    place: input.place.trim() || null,
    payment_method: input.paymentMethod === "paypal" ? "paypal" : "bank",
    recipient,
    issuer,
    payment_details: paymentDetails,
    notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let id = input.id;
  if (existing) {
    const { error } = await supabase
      .from("receipts")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: friendlyError(error, input.number, year) };
  } else {
    const legacyPaid = input.legacy && input.legacyStatus === "pagata";
    const { data, error } = await supabase
      .from("receipts")
      .insert({
        ...row,
        user_id: userId,
        status: legacyPaid ? "pagata" : "emessa",
        paid_at: legacyPaid ? input.issueDate : null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: friendlyError(error, input.number, year) };
    id = data.id as string;
  }

  revalidateReceiptPaths(input.collaborationId, existing?.collaborationId);
  return { ok: true, id: id! };
}

function friendlyError(error: { code?: string; message: string }, number: number, year: number) {
  if (error.code === "23505") {
    return `Esiste già una ricevuta n° ${formatReceiptNumber(number, year)}`;
  }
  return error.message;
}

export async function markReceiptPaid(input: {
  id: string;
  paidAt: string;
  registerPayment: boolean;
}): Promise<Result> {
  if (!isValidUuid(input.id)) return { ok: false, error: "ID ricevuta non valido" };
  if (!ISO_DATE.test(input.paidAt)) return { ok: false, error: "Data pagamento non valida" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const receipt = await getReceiptById(supabase, userId, input.id);
  if (!receipt) return { ok: false, error: "Ricevuta non trovata" };
  if (receipt.status === "annullata") return { ok: false, error: "La ricevuta è annullata" };

  let paymentId = receipt.paymentId;
  if (input.registerPayment && receipt.collaborationId && !paymentId) {
    const { data, error } = await supabase
      .from("collaboration_payments")
      .insert({
        collaboration_id: receipt.collaborationId,
        user_id: userId,
        amount: receipt.gross,
        paid_at: input.paidAt,
        note: `Ricevuta n° ${formatReceiptNumber(receipt.number, receipt.year)}`,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    paymentId = data.id as string;
  }

  const { error } = await supabase
    .from("receipts")
    .update({
      status: "pagata",
      paid_at: input.paidAt,
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", receipt.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (receipt.collaborationId && paymentId !== receipt.paymentId) {
    await refreshPaidFlag(receipt.collaborationId);
  }
  revalidateReceiptPaths(receipt.collaborationId);
  return { ok: true };
}

/** Riporta una ricevuta a "emessa" (da pagata o annullata); rimuove il pagamento creato in automatico. */
export async function reopenReceipt(id: string): Promise<Result> {
  if (!isValidUuid(id)) return { ok: false, error: "ID ricevuta non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const receipt = await getReceiptById(supabase, userId, id);
  if (!receipt) return { ok: false, error: "Ricevuta non trovata" };

  const { error } = await supabase
    .from("receipts")
    .update({ status: "emessa", paid_at: null, payment_id: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (receipt.paymentId) {
    await supabase
      .from("collaboration_payments")
      .delete()
      .eq("id", receipt.paymentId)
      .eq("user_id", userId);
    if (receipt.collaborationId) await refreshPaidFlag(receipt.collaborationId);
  }
  revalidateReceiptPaths(receipt.collaborationId);
  return { ok: true };
}

/** Annulla mantenendo il numero nel registro (consigliato rispetto all'eliminazione). */
export async function cancelReceipt(id: string): Promise<Result> {
  if (!isValidUuid(id)) return { ok: false, error: "ID ricevuta non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const receipt = await getReceiptById(supabase, userId, id);
  if (!receipt) return { ok: false, error: "Ricevuta non trovata" };
  if (receipt.status === "pagata") {
    return { ok: false, error: "Riporta prima la ricevuta a 'emessa' per annullarla" };
  }
  const { error } = await supabase
    .from("receipts")
    .update({ status: "annullata", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidateReceiptPaths(receipt.collaborationId);
  return { ok: true };
}

export async function deleteReceipt(id: string): Promise<Result> {
  if (!isValidUuid(id)) return { ok: false, error: "ID ricevuta non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const receipt = await getReceiptById(supabase, userId, id);
  if (!receipt) return { ok: false, error: "Ricevuta non trovata" };
  const { error } = await supabase.from("receipts").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidateReceiptPaths(receipt.collaborationId);
  return { ok: true };
}
