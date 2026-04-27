"use server";

import { COLLAB_STATUSES, type CollabStatus } from "@/lib/collab-statuses";
import {
  isDeliverableType,
  isValidDateKey,
  parseFee,
} from "@/lib/collaboration-form-shared";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient } from "@/lib/supabase";

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
  /** Opzionale: solo righe con data valida vengono inserite; il resto si aggiunge dalla scheda. */
  plannedDeliverables?: PlannedDeliverableInput[];
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

  const supabase = createSupabaseClient();

  if (input.isPeriodic) {
    const n = input.contentCount;
    if (n == null || !Number.isInteger(n) || n < 1 || n > 200) {
      return { ok: false, error: "Numero di contenuti non valido (1–200)" };
    }
    const fpcP = parseFee(input.feePerContent ?? "");
    if (!fpcP.ok) {
      return { ok: false, error: "Compenso per contenuto non valido" };
    }
    if (fpcP.value <= 0) {
      return { ok: false, error: "Inserisci un compenso per singolo contenuto" };
    }

    const planned = filterValidPlanned(input.plannedDeliverables);

    const totalFee = n * fpcP.value;

    const { data, error } = await supabase
      .from("collaborations")
      .insert({
        brand_id: input.brandId,
        status: input.status,
        brief_text: brief,
        agreed_fee: totalFee,
        contract_url: contractUrl,
        is_periodic: true,
        content_count: n,
        fee_per_content: fpcP.value,
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
      const delivRows = planned.map((p) => ({
        collaboration_id: collabId,
        type: p.type,
        publish_date: p.publishDate,
        status: "da girare" as const,
        content_url: null as string | null,
      }));

      const { error: dErr } = await supabase.from("deliverables").insert(delivRows);
      if (dErr) {
        await supabase.from("collaborations").delete().eq("id", collabId);
        return { ok: false, error: dErr.message };
      }
    }

    revalidateCollaborationPaths(collabId);
    return { ok: true, id: collabId };
  }

  const feeP = parseFee(input.agreedFee);
  if (!feeP.ok) {
    return { ok: false, error: "Importo (fee) non valido" };
  }
  const agreedFee = feeP.value === 0 ? null : feeP.value;

  const { data, error } = await supabase
    .from("collaborations")
    .insert({
      brand_id: input.brandId,
      status: input.status,
      brief_text: brief,
      agreed_fee: agreedFee,
      contract_url: contractUrl,
      is_periodic: false,
      content_count: null,
      fee_per_content: null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || !isValidUuid(data.id)) {
    return { ok: false, error: "Risposta inattesa dal server" };
  }

  revalidateCollaborationPaths(data.id);
  return { ok: true, id: data.id };
}
