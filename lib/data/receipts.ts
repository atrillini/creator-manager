import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyIssuerProfile,
  type IssuerProfile,
  type IssuerSnapshot,
  type PaymentDetails,
  type PaymentMethod,
  type ReceiptLanguage,
  type ReceiptRecipient,
  type ReceiptStatus,
} from "@/lib/receipts/model";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

export type ReceiptRow = {
  id: string;
  number: number;
  year: number;
  issueDate: string;
  language: ReceiptLanguage;
  status: ReceiptStatus;
  isLegacy: boolean;
  gross: number;
  withholdingRate: number;
  withholding: number;
  net: number;
  stampDuty: boolean;
  description: string;
  place: string;
  paymentMethod: PaymentMethod;
  recipient: ReceiptRecipient;
  issuer: IssuerSnapshot | null;
  payment: PaymentDetails | null;
  paidAt: string | null;
  paymentId: string | null;
  notes: string | null;
  brandId: string | null;
  collaborationId: string | null;
  collaborationTitle: string | null;
};

export type ReceiptBrandOption = {
  id: string;
  name: string;
  recipient: ReceiptRecipient;
  language: ReceiptLanguage;
};

export type ReceiptCollaborationOption = {
  id: string;
  title: string;
  brandId: string;
  agreedFee: number | null;
  remainingDue: number | null;
};

export type ReceiptFormOptions = {
  brands: ReceiptBrandOption[];
  collaborations: ReceiptCollaborationOption[];
  profile: IssuerProfile;
  /** Ultimo numero usato per anno (incluse annullate e legacy). */
  maxNumberByYear: Record<number, number>;
};

const RECEIPT_SELECT = `id, number, year, issue_date, language, status, is_legacy,
  gross_amount, withholding_rate, withholding_amount, net_amount, stamp_duty,
  description, place, payment_method, recipient, issuer, payment_details,
  paid_at, payment_id, notes, brand_id, collaboration_id,
  collaborations ( brief_text )`;

type DbReceipt = {
  id: string;
  number: number;
  year: number;
  issue_date: string;
  language: ReceiptLanguage;
  status: ReceiptStatus;
  is_legacy: boolean;
  gross_amount: number | string;
  withholding_rate: number | string;
  withholding_amount: number | string;
  net_amount: number | string;
  stamp_duty: boolean;
  description: string | null;
  place: string | null;
  payment_method: PaymentMethod;
  recipient: Partial<ReceiptRecipient> | null;
  issuer: IssuerSnapshot | Record<string, never> | null;
  payment_details: PaymentDetails | Record<string, never> | null;
  paid_at: string | null;
  payment_id: string | null;
  notes: string | null;
  brand_id: string | null;
  collaboration_id: string | null;
  collaborations: { brief_text: string | null } | { brief_text: string | null }[] | null;
};

const nonEmpty = <T extends object>(o: T | Record<string, never> | null): T | null =>
  o && Object.keys(o).length > 0 ? (o as T) : null;

function mapReceipt(r: DbReceipt): ReceiptRow {
  const c = Array.isArray(r.collaborations) ? r.collaborations[0] : r.collaborations;
  return {
    id: r.id,
    number: r.number,
    year: r.year,
    issueDate: r.issue_date,
    language: r.language,
    status: r.status,
    isLegacy: r.is_legacy,
    gross: Number(r.gross_amount),
    withholdingRate: Number(r.withholding_rate),
    withholding: Number(r.withholding_amount),
    net: Number(r.net_amount),
    stampDuty: r.stamp_duty,
    description: r.description ?? "",
    place: r.place ?? "",
    paymentMethod: r.payment_method,
    recipient: {
      name: r.recipient?.name ?? "",
      address: r.recipient?.address ?? "",
      vatNumber: r.recipient?.vatNumber ?? "",
      extra: r.recipient?.extra ?? "",
    },
    issuer: nonEmpty<IssuerSnapshot>(r.issuer),
    payment: nonEmpty<PaymentDetails>(r.payment_details),
    paidAt: r.paid_at,
    paymentId: r.payment_id,
    notes: r.notes,
    brandId: r.brand_id,
    collaborationId: r.collaboration_id,
    collaborationTitle: c?.brief_text?.trim() || null,
  };
}

type DbIssuerProfile = {
  full_name: string | null;
  alias: string | null;
  gender: "f" | "m" | null;
  birth_place: string | null;
  birth_date: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  tax_code: string | null;
  email: string | null;
  default_place: string | null;
  default_description_it: string | null;
  default_description_en: string | null;
  default_payment_method: PaymentMethod | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  bank_address: string | null;
  account_holder: string | null;
  paypal_email: string | null;
  signature_data_url: string | null;
};

export async function loadIssuerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<IssuerProfile> {
  const empty = emptyIssuerProfile();
  const { data } = await supabase
    .from("issuer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<DbIssuerProfile>();
  if (!data) return empty;
  return {
    fullName: data.full_name ?? "",
    alias: data.alias ?? "",
    gender: data.gender ?? "f",
    birthPlace: data.birth_place ?? "",
    birthDate: data.birth_date ?? "",
    street: data.street ?? "",
    postalCode: data.postal_code ?? "",
    city: data.city ?? "",
    province: data.province ?? "",
    country: data.country ?? "",
    taxCode: data.tax_code ?? "",
    email: data.email ?? "",
    defaultPlace: data.default_place ?? "",
    defaultDescriptionIt: data.default_description_it || empty.defaultDescriptionIt,
    defaultDescriptionEn: data.default_description_en || empty.defaultDescriptionEn,
    defaultPaymentMethod: data.default_payment_method ?? "bank",
    bankName: data.bank_name ?? "",
    iban: data.iban ?? "",
    bic: data.bic ?? "",
    bankAddress: data.bank_address ?? "",
    accountHolder: data.account_holder ?? "",
    paypalEmail: data.paypal_email ?? "",
    signatureDataUrl: data.signature_data_url ?? "",
  };
}

export async function getIssuerProfile(): Promise<IssuerProfile> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  return loadIssuerProfile(supabase, userId);
}

export async function getReceipts(opts: { year?: number } = {}): Promise<ReceiptRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  let q = supabase
    .from("receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("number", { ascending: false });
  if (opts.year) q = q.eq("year", opts.year);
  const { data, error } = await q;
  if (error) {
    if (process.env.NODE_ENV === "development") console.warn("[CreatorCRM] receipts:", error.message);
    return [];
  }
  return ((data ?? []) as DbReceipt[]).map(mapReceipt);
}

export async function getReceiptsForCollaboration(collaborationId: string): Promise<ReceiptRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .eq("collaboration_id", collaborationId)
    .order("issue_date", { ascending: false });
  if (error) return [];
  return ((data ?? []) as DbReceipt[]).map(mapReceipt);
}

export async function getReceiptById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ReceiptRow | null> {
  const { data } = await supabase
    .from("receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle<DbReceipt>();
  return data ? mapReceipt(data) : null;
}

/** Anni con almeno una ricevuta (più l'anno corrente), in ordine decrescente. */
export async function getReceiptYears(): Promise<number[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase.from("receipts").select("year").eq("user_id", userId);
  const years = new Set<number>([new Date().getFullYear()]);
  for (const r of (data ?? []) as { year: number }[]) years.add(r.year);
  return [...years].sort((a, b) => b - a);
}

export async function getReceiptFormOptions(): Promise<ReceiptFormOptions> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [brandsRes, collabsRes, paysRes, numbersRes, profile] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, billing_name, billing_address, vat_number, billing_extra, receipt_language")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
    supabase
      .from("collaborations")
      .select("id, brand_id, brief_text, agreed_fee, status, created_at")
      .eq("user_id", userId)
      .neq("status", "rifiutata")
      .order("created_at", { ascending: false }),
    supabase.from("collaboration_payments").select("collaboration_id, amount").eq("user_id", userId),
    supabase.from("receipts").select("year, number").eq("user_id", userId),
    loadIssuerProfile(supabase, userId),
  ]);

  const brands: ReceiptBrandOption[] = (
    (brandsRes.data ?? []) as {
      id: string;
      name: string;
      billing_name: string | null;
      billing_address: string | null;
      vat_number: string | null;
      billing_extra: string | null;
      receipt_language: ReceiptLanguage | null;
    }[]
  ).map((b) => ({
    id: b.id,
    name: b.name,
    language: b.receipt_language ?? "it",
    recipient: {
      name: b.billing_name?.trim() || b.name,
      address: b.billing_address ?? "",
      vatNumber: b.vat_number ?? "",
      extra: b.billing_extra ?? "",
    },
  }));

  const paidByCollab = new Map<string, number>();
  for (const p of (paysRes.data ?? []) as { collaboration_id: string; amount: number | string }[]) {
    paidByCollab.set(p.collaboration_id, (paidByCollab.get(p.collaboration_id) ?? 0) + Number(p.amount));
  }

  const collaborations: ReceiptCollaborationOption[] = (
    (collabsRes.data ?? []) as {
      id: string;
      brand_id: string;
      brief_text: string | null;
      agreed_fee: number | string | null;
    }[]
  ).map((c) => {
    const fee = c.agreed_fee == null || c.agreed_fee === "" ? null : Number(c.agreed_fee);
    const agreed = fee != null && Number.isFinite(fee) ? fee : null;
    return {
      id: c.id,
      brandId: c.brand_id,
      title: c.brief_text?.trim() || "Senza titolo",
      agreedFee: agreed,
      remainingDue: agreed == null ? null : Math.max(0, agreed - (paidByCollab.get(c.id) ?? 0)),
    };
  });

  const maxNumberByYear: Record<number, number> = {};
  for (const r of (numbersRes.data ?? []) as { year: number; number: number }[]) {
    maxNumberByYear[r.year] = Math.max(maxNumberByYear[r.year] ?? 0, r.number);
  }

  return { brands, collaborations, profile, maxNumberByYear };
}
