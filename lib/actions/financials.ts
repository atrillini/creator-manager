"use server";

import { revalidatePath } from "next/cache";
import { isManualFinancialType } from "@/lib/financial-types";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

type Result = { ok: true } | { ok: false; error: string };

export type FinancialMovementInput = {
  id?: string;
  type: string;
  amount: string;
  date: string;
  description: string;
  collaborationId: string | null;
};

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace("€", "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Math.abs(Number(normalized));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function revalidateFinance() {
  revalidatePath("/finanze");
  revalidatePath("/dashboard");
}

/** Crea o aggiorna un movimento manuale (le entrate YouTube restano gestite dalla sync). */
export async function saveFinancialMovement(input: FinancialMovementInput): Promise<Result> {
  if (input.id && !isValidUuid(input.id)) return { ok: false, error: "ID movimento non valido" };
  if (!isManualFinancialType(input.type)) return { ok: false, error: "Tipo movimento non valido" };
  const amount = parseAmount(input.amount);
  if (!amount) return { ok: false, error: "Importo non valido" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Data non valida" };
  if (input.collaborationId && !isValidUuid(input.collaborationId)) {
    return { ok: false, error: "Collaborazione non valida" };
  }

  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const row = {
    type: input.type,
    amount,
    date: input.date,
    description: input.description.trim().slice(0, 500) || null,
    collaboration_id: input.collaborationId,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("financials")
      .update(row)
      .eq("id", input.id)
      .eq("user_id", userId)
      .neq("type", "Entrata YouTube")
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Movimento non trovato" };
  } else {
    const { error } = await supabase.from("financials").insert({ ...row, user_id: userId });
    if (error) return { ok: false, error: error.message };
  }
  revalidateFinance();
  return { ok: true };
}

export async function deleteFinancialMovement(id: string): Promise<Result> {
  if (!isValidUuid(id)) return { ok: false, error: "ID movimento non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("financials")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .neq("type", "Entrata YouTube")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Movimento non trovato" };
  revalidateFinance();
  return { ok: true };
}
