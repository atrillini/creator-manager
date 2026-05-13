"use server";

import { COLLAB_STATUSES, type CollabStatus } from "@/lib/collab-statuses";
import { parseFee } from "@/lib/collaboration-form-shared";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

export type UpdateCollaborationInput = {
  collaborationId: string;
  brandId: string;
  status: string;
  briefText: string;
  contractUrl: string;
  isPeriodic: boolean;
  contentCount?: number;
  feePerContent?: string;
  agreedFee: string;
  isGiveaway?: boolean;
  giveawayDetails?: string;
  giveawayValue?: string;
};

function isStatus(s: string): s is CollabStatus {
  return (COLLAB_STATUSES as readonly string[]).includes(s);
}

export async function updateCollaboration(
  input: UpdateCollaborationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidUuid(input.collaborationId)) {
    return { ok: false, error: "ID collaborazione non valido" };
  }
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
    const totalFee = fpcP.value > 0 ? n * fpcP.value : null;

    const { error } = await supabase
      .from("collaborations")
      .update({
        brand_id: input.brandId,
        status: input.status,
        brief_text: brief,
        contract_url: contractUrl,
        agreed_fee: totalFee,
        is_periodic: true,
        content_count: n,
        fee_per_content: fpcP.value > 0 ? fpcP.value : null,
        is_giveaway: isGiveaway,
        giveaway_details: giveawayDetails,
        giveaway_value: giveawayValue,
      })
      .eq("id", input.collaborationId)
      .eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }
    revalidateCollaborationPaths(input.collaborationId);
    return { ok: true };
  }

  const feeP = parseFee(input.agreedFee);
  if (!feeP.ok) {
    return { ok: false, error: "Importo (fee) non valido" };
  }
  const agreedFee = feeP.value === 0 ? null : feeP.value;

  const { error } = await supabase
    .from("collaborations")
    .update({
      brand_id: input.brandId,
      status: input.status,
      brief_text: brief,
      contract_url: contractUrl,
      agreed_fee: agreedFee,
      is_periodic: false,
      content_count: null,
      fee_per_content: null,
      is_giveaway: isGiveaway,
      giveaway_details: giveawayDetails,
      giveaway_value: giveawayValue,
    })
    .eq("id", input.collaborationId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateCollaborationPaths(input.collaborationId);
  return { ok: true };
}
