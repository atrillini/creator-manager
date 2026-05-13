"use server";

import { COLLAB_STATUSES, type CollabStatus } from "@/lib/collab-statuses";
import {
  isDeliverableType,
  isValidDateKey,
  parseFee,
} from "@/lib/collaboration-form-shared";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlannedDeliverableInput = {
  publishDate: string;
  type: string;
};

export type CreateCollaborationInput = {
  brandId: string;
  status: string;
  briefText: string;
  contractUrl: string;
  agreedFee: string;
  isPeriodic: boolean;
  contentCount?: number;
  feePerContent?: string;
  /** Giveaway / scambio prodotti (può convivere con un compenso, anche parziale). */
  isGiveaway?: boolean;
  giveawayDetails?: string;
  giveawayValue?: string;
  /** Opzionale: solo righe con data valida vengono inserite; il resto si aggiunge dalla scheda. */
  plannedDeliverables?: PlannedDeliverableInput[];
  /** Opzionale: nota iniziale in timeline (es. brief incollato + link). */
  initialTimelineNote?: string;
  /** Opzionale: pagamenti iniziali estratti dal brief. */
  initialPayments?: { amount: string; paidAt: string; note?: string }[];
};

function isStatus(s: string): s is CollabStatus {
  return (COLLAB_STATUSES as readonly string[]).includes(s);
}

function filterValidPlanned(
  planned: PlannedDeliverableInput[] | undefined
): PlannedDeliverableInput[] {
  if (!planned?.length) return [];
  return planned.filter((p) => {
    const d = (p.publishDate ?? "").trim();
    return isValidDateKey(d) && isDeliverableType(p.type);
  });
}

async function insertPlannedDeliverables(
  supabase: SupabaseClient,
  collabId: string,
  planned: PlannedDeliverableInput[],
  userId: string
) {
  if (planned.length === 0) {
    return { ok: true as const };
  }
  const delivRows = planned.map((p) => ({
    collaboration_id: collabId,
    user_id: userId,
    type: p.type,
    publish_date: p.publishDate,
    status: "da girare" as const,
    content_url: null as string | null,
  }));
  const { error: dErr } = await supabase.from("deliverables").insert(delivRows);
  if (dErr) {
    await supabase
      .from("collaborations")
      .delete()
      .eq("id", collabId)
      .eq("user_id", userId);
    return { ok: false as const, error: dErr.message };
  }
  return { ok: true as const };
}

async function insertInitialTimelineNote(
  supabase: SupabaseClient,
  collabId: string,
  note: string | undefined,
  userId: string
) {
  const n = (note ?? "").trim();
  if (!n) return;
  await supabase.from("collaboration_events").insert({
    collaboration_id: collabId,
    user_id: userId,
    event_type: "nota",
    description: n.slice(0, 4000),
    attached_file_url: null,
    event_at: new Date().toISOString(),
  });
}

async function insertInitialPayments(
  supabase: SupabaseClient,
  collabId: string,
  payments: { amount: string; paidAt: string; note?: string }[] | undefined,
  userId: string
) {
  if (!payments?.length) return;
  const rows = payments
    .map((p) => {
      const amountParsed = parseFee(String(p.amount ?? ""));
      const amount = amountParsed.ok ? amountParsed.value : 0;
      const paidAt = String(p.paidAt ?? "").trim();
      if (amount <= 0 || !isValidDateKey(paidAt)) return null;
      return {
        collaboration_id: collabId,
        user_id: userId,
        amount,
        paid_at: paidAt,
        note: p.note?.trim() || "Pagamento inserito da brief",
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  if (rows.length === 0) return;
  await supabase.from("collaboration_payments").insert(rows);
}

export async function createCollaboration(
  input: CreateCollaborationInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isValidUuid(input.brandId)) {
    return { ok: false, error: "Seleziona un’azienda valida" };
  }
  if (!isStatus(input.status)) {
    return { ok: false, error: "Stato non valido" };
  }
  const brief = (input.briefText ?? "").trim();
  if (brief.length < 1) {
    return { ok: false, error: "Inserisci un titolo o breve descrizione" };
  }

  const url = (input.contractUrl ?? "").trim();
  const contractUrl = url ? url : null;

  const isGiveaway = input.isGiveaway === true;
  const giveawayDetails = isGiveaway
    ? (input.giveawayDetails ?? "").trim().slice(0, 4000) || null
    : null;
  let giveawayValue: number | null = null;
  if (isGiveaway && (input.giveawayValue ?? "").trim() !== "") {
    const gv = parseFee(input.giveawayValue ?? "");
    if (!gv.ok) {
      return { ok: false, error: "Valore stimato giveaway non valido" };
    }
    giveawayValue = gv.value > 0 ? gv.value : null;
  }

  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  if (input.isPeriodic) {
    const n = input.contentCount;
    if (n == null || !Number.isInteger(n) || n < 1 || n > 200) {
      return { ok: false, error: "Numero di contenuti non valido (1–200)" };
    }
    const fpcP = parseFee(input.feePerContent ?? "");
    if (!fpcP.ok) {
      return { ok: false, error: "Compenso per contenuto non valido" };
    }
    if (!isGiveaway && fpcP.value <= 0) {
      return { ok: false, error: "Inserisci un compenso per singolo contenuto" };
    }

    const planned = filterValidPlanned(input.plannedDeliverables);

    const totalFee = fpcP.value > 0 ? n * fpcP.value : null;

    const { data, error } = await supabase
      .from("collaborations")
      .insert({
        user_id: userId,
        brand_id: input.brandId,
        status: input.status,
        brief_text: brief,
        agreed_fee: totalFee,
        contract_url: contractUrl,
        is_periodic: true,
        content_count: n,
        fee_per_content: fpcP.value > 0 ? fpcP.value : null,
        is_giveaway: isGiveaway,
        giveaway_details: giveawayDetails,
        giveaway_value: giveawayValue,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data || !isValidUuid(data.id)) {
      return { ok: false, error: "Risposta inattesa dal server" };
    }

    const collabId = data.id;

    if (planned.length > 0) {
      const ins = await insertPlannedDeliverables(supabase, collabId, planned, userId);
      if (!ins.ok) {
        return { ok: false, error: ins.error };
      }
    }
    await insertInitialPayments(supabase, collabId, input.initialPayments, userId);
    await insertInitialTimelineNote(supabase, collabId, input.initialTimelineNote, userId);

    revalidateCollaborationPaths(collabId);
    return { ok: true, id: collabId };
  }

  const feeP = parseFee(input.agreedFee);
  if (!feeP.ok) {
    return { ok: false, error: "Importo (fee) non valido" };
  }
  const agreedFee = feeP.value === 0 ? null : feeP.value;

  const planned = filterValidPlanned(input.plannedDeliverables);

  const { data, error } = await supabase
    .from("collaborations")
    .insert({
      user_id: userId,
      brand_id: input.brandId,
      status: input.status,
      brief_text: brief,
      agreed_fee: agreedFee,
      contract_url: contractUrl,
      is_periodic: false,
      content_count: null,
      fee_per_content: null,
      is_giveaway: isGiveaway,
      giveaway_details: giveawayDetails,
      giveaway_value: giveawayValue,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || !isValidUuid(data.id)) {
    return { ok: false, error: "Risposta inattesa dal server" };
  }

  if (planned.length > 0) {
    const ins = await insertPlannedDeliverables(supabase, data.id, planned, userId);
    if (!ins.ok) {
      return { ok: false, error: ins.error };
    }
  }
  await insertInitialPayments(supabase, data.id, input.initialPayments, userId);
  await insertInitialTimelineNote(supabase, data.id, input.initialTimelineNote, userId);

  revalidateCollaborationPaths(data.id);
  return { ok: true, id: data.id };
}
