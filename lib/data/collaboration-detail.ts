import { parseContactsJson, type BrandContact } from "@/lib/brand-contacts";
import { formatEurOrNull, toNumberOrNull } from "@/lib/format";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import type { EventType } from "@/lib/collab-event-types";
import { COLLAB_FILES_BUCKET } from "@/lib/storage-constants";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type BrandLite = {
  id: string;
  name: string;
  sector: string | null;
  /** Legacy / riga unica */
  contacts: string | null;
  /** Rubrica (da contacts_json) */
  contact_people: BrandContact[];
  notes: string | null;
};

export type CollaborationEventRow = {
  id: string;
  created_at: string;
  /** Quando l’evento è avvenuto (linea del tempo, anche in passato). */
  event_at: string | null;
  event_type: EventType;
  description: string | null;
  /** Oggetto nel bucket privato `collaboration-files`. */
  attached_file_path: string | null;
  /** Link esterno legacy. */
  attached_file_url: string | null;
  /** URL da usare nei link: firmato (scade dopo un'ora) o legacy. */
  attachment_href: string | null;
};

export type DeliverableRow = {
  id: string;
  created_at: string;
  type: string;
  publish_date: string | null;
  status: string;
  content_url: string | null;
};

export type CollaborationPaymentRow = {
  id: string;
  paid_at: string;
  amount: number;
  note: string | null;
};

export type CollaborationDetail = {
  id: string;
  general_notes: string | null;
  agreed_fee: string | null;
  /** Valore numerico DB per input modifica (€) */
  agreed_fee_value: number | null;
  brief_text: string | null;
  status: string;
  contract_url: string | null;
  created_at: string;
  paid_at: string | null;
  is_periodic: boolean;
  content_count: number | null;
  fee_per_content: string | null;
  fee_per_content_value: number | null;
  /** Giveaway / scambio prodotti (può convivere con un compenso parziale). */
  is_giveaway: boolean;
  giveaway_details: string | null;
  /** Valore € formattato dei beni ricevuti (solo statistico, non entra nei pagamenti). */
  giveaway_value: string | null;
  giveaway_value_amount: number | null;
  brand: BrandLite | null;
  events: CollaborationEventRow[];
  deliverables: DeliverableRow[];
  payments: CollaborationPaymentRow[];
  paid_total: number;
  remaining_due: number | null;
};

export type LoadCollaborationResult =
  | { ok: true; data: CollaborationDetail }
  | { ok: false; notFound: true; message?: string }
  | { ok: false; notFound?: false; message: string };

type BrandsJoin = {
  id: string;
  name: string;
  sector: string | null;
  contacts: string | null;
  contacts_json?: unknown;
  notes: string | null;
} | null;

type CollaborationRow = {
  id: string;
  general_notes: string | null;
  agreed_fee: number | string | null;
  brief_text: string | null;
  status: string;
  contract_url: string | null;
  created_at: string;
  paid_at: string | null;
  is_periodic: boolean | null;
  content_count: number | null;
  fee_per_content: number | string | null;
  is_giveaway: boolean | null;
  giveaway_details: string | null;
  giveaway_value: number | string | null;
  brands: BrandsJoin | BrandsJoin[] | null;
};

function normalizeBrand(row: CollaborationRow): BrandLite | null {
  const b = row.brands;
  if (!b) return null;
  const raw = Array.isArray(b) ? b[0] : b;
  if (!raw) return null;
  const people = parseContactsJson(raw.contacts_json);
  return {
    id: raw.id,
    name: raw.name,
    sector: raw.sector,
    contacts: raw.contacts,
    contact_people: people,
    notes: raw.notes,
  };
}

export async function getCollaborationDetail(
  id: string
): Promise<LoadCollaborationResult> {
  if (!id) {
    return { ok: false, notFound: true, message: "ID mancante" };
  }

  if (!isValidUuid(id)) {
    return { ok: false, notFound: true };
  }

  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  const { data: collab, error: cErr } = await supabase
    .from("collaborations")
    .select(
      `id, general_notes, agreed_fee, brief_text, status, contract_url, created_at, paid_at,
      is_periodic, content_count, fee_per_content,
      is_giveaway, giveaway_details, giveaway_value,
      brands ( id, name, sector, contacts, contacts_json, notes )`
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<CollaborationRow>();

  if (cErr) {
    return { ok: false, message: cErr.message };
  }
  if (!collab) {
    return { ok: false, notFound: true };
  }

  const { data: events, error: eErr } = await supabase
    .from("collaboration_events")
    .select("id, created_at, event_at, event_type, description, attached_file_path, attached_file_url")
    .eq("collaboration_id", id)
    .eq("user_id", userId)
    .order("event_at", { ascending: false, nullsFirst: false });

  if (eErr) {
    return { ok: false, message: eErr.message };
  }

  const { data: deliv, error: dErr } = await supabase
    .from("deliverables")
    .select("id, created_at, type, publish_date, status, content_url")
    .eq("collaboration_id", id)
    .eq("user_id", userId)
    .order("publish_date", { ascending: true, nullsFirst: false });

  if (dErr) {
    return { ok: false, message: dErr.message };
  }

  const { data: pays, error: pErr } = await supabase
    .from("collaboration_payments")
    .select("id, paid_at, amount, note")
    .eq("collaboration_id", id)
    .eq("user_id", userId)
    .order("paid_at", { ascending: false });
  if (pErr) {
    return { ok: false, message: pErr.message };
  }

  const rawEvents = (events ?? []) as {
    id: string;
    created_at: string;
    event_at?: string | null;
    event_type: EventType;
    description: string | null;
    attached_file_path: string | null;
    attached_file_url: string | null;
  }[];
  const paths = rawEvents.map((e) => e.attached_file_path).filter((p): p is string => !!p);
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(COLLAB_FILES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }
  const eventRows: CollaborationEventRow[] = rawEvents.map((r) => ({
    ...r,
    event_at: r.event_at ?? r.created_at,
    attachment_href: r.attached_file_path
      ? signedByPath.get(r.attached_file_path) ?? null
      : r.attached_file_url,
  }));

  const agreedRaw = toNumberOrNull(
    collab.agreed_fee as number | string | null
  );
  const fpcRaw = toNumberOrNull(
    collab.fee_per_content as number | string | null
  );
  const giveawayValueRaw = toNumberOrNull(
    collab.giveaway_value as number | string | null
  );
  const payments = (pays ?? []) as CollaborationPaymentRow[];
  const paidTotal = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const remainingDue = agreedRaw == null ? null : Math.max(0, agreedRaw - paidTotal);

  const detail: CollaborationDetail = {
    id: collab.id,
    general_notes: collab.general_notes,
    agreed_fee: formatEurOrNull(collab.agreed_fee as number | string | null),
    agreed_fee_value: agreedRaw,
    brief_text: collab.brief_text,
    status: collab.status,
    contract_url: collab.contract_url,
    created_at: collab.created_at,
    paid_at: collab.paid_at,
    is_periodic: collab.is_periodic === true,
    content_count:
      collab.content_count == null
        ? null
        : Number.isFinite(Number(collab.content_count))
          ? Number(collab.content_count)
          : null,
    fee_per_content: formatEurOrNull(
      collab.fee_per_content as number | string | null
    ),
    fee_per_content_value: fpcRaw,
    is_giveaway: collab.is_giveaway === true,
    giveaway_details: collab.giveaway_details ?? null,
    giveaway_value: formatEurOrNull(collab.giveaway_value as number | string | null),
    giveaway_value_amount: giveawayValueRaw,
    brand: normalizeBrand(collab),
    events: eventRows,
    deliverables: (deliv ?? []) as DeliverableRow[],
    payments,
    paid_total: paidTotal,
    remaining_due: remainingDue,
  };

  return { ok: true, data: detail };
}
