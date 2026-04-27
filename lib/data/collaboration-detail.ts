import { parseContactsJson, type BrandContact } from "@/lib/brand-contacts";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient } from "@/lib/supabase";
import type { EventType } from "@/lib/collab-event-types";

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
  attached_file_url: string | null;
};

export type DeliverableRow = {
  id: string;
  created_at: string;
  type: string;
  publish_date: string | null;
  status: string;
  content_url: string | null;
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
  is_periodic: boolean;
  content_count: number | null;
  fee_per_content: string | null;
  fee_per_content_value: number | null;
  brand: BrandLite | null;
  events: CollaborationEventRow[];
  deliverables: DeliverableRow[];
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
  is_periodic: boolean | null;
  content_count: number | null;
  fee_per_content: number | string | null;
  brands: BrandsJoin | BrandsJoin[] | null;
};

function toMoney(v: string | number | null): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isNaN(n))
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(n);
    return v;
  }
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

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

function toNumericOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
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

  const supabase = createSupabaseClient();

  const { data: collab, error: cErr } = await supabase
    .from("collaborations")
    .select(
      `id, general_notes, agreed_fee, brief_text, status, contract_url, created_at,
      is_periodic, content_count, fee_per_content,
      brands ( id, name, sector, contacts, contacts_json, notes )`
    )
    .eq("id", id)
    .maybeSingle<CollaborationRow>();

  if (cErr) {
    return { ok: false, message: cErr.message };
  }
  if (!collab) {
    return { ok: false, notFound: true };
  }

  const { data: events, error: eErr } = await supabase
    .from("collaboration_events")
    .select("id, created_at, event_at, event_type, description, attached_file_url")
    .eq("collaboration_id", id)
    .order("event_at", { ascending: false, nullsFirst: false });

  if (eErr) {
    return { ok: false, message: eErr.message };
  }

  const { data: deliv, error: dErr } = await supabase
    .from("deliverables")
    .select("id, created_at, type, publish_date, status, content_url")
    .eq("collaboration_id", id)
    .order("publish_date", { ascending: true, nullsFirst: false });

  if (dErr) {
    return { ok: false, message: dErr.message };
  }

  const eventRows: CollaborationEventRow[] = (events ?? []).map((e) => {
    const r = e as {
      id: string;
      created_at: string;
      event_at?: string | null;
      event_type: EventType;
      description: string | null;
      attached_file_url: string | null;
    };
    return {
      ...r,
      event_at: r.event_at ?? r.created_at,
    };
  });

  const agreedRaw = toNumericOrNull(
    collab.agreed_fee as number | string | null
  );
  const fpcRaw = toNumericOrNull(
    collab.fee_per_content as number | string | null
  );

  const detail: CollaborationDetail = {
    id: collab.id,
    general_notes: collab.general_notes,
    agreed_fee: toMoney(collab.agreed_fee as number | string | null),
    agreed_fee_value: agreedRaw,
    brief_text: collab.brief_text,
    status: collab.status,
    contract_url: collab.contract_url,
    created_at: collab.created_at,
    is_periodic: collab.is_periodic === true,
    content_count:
      collab.content_count == null
        ? null
        : Number.isFinite(Number(collab.content_count))
          ? Number(collab.content_count)
          : null,
    fee_per_content: toMoney(
      collab.fee_per_content as number | string | null
    ),
    fee_per_content_value: fpcRaw,
    brand: normalizeBrand(collab),
    events: eventRows,
    deliverables: (deliv ?? []) as DeliverableRow[],
  };

  return { ok: true, data: detail };
}
