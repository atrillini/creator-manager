"use server";

import { revalidatePath } from "next/cache";
import {
  formatContactsSummaryLine,
  type BrandContact,
} from "@/lib/brand-contacts";
import { createSupabaseClient } from "@/lib/supabase";
import { isValidUuid } from "@/lib/is-uuid";

export type CreateBrandInput = {
  name: string;
  sector?: string;
  /** Rubrica: uno o più referenti. */
  contactPeople: BrandContact[];
  notes?: string;
};

export type UpdateBrandInput = CreateBrandInput & { id: string };

export async function createBrand(
  input: CreateBrandInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name?.trim() ?? "";
  if (name.length < 1) {
    return { ok: false, error: "Inserisci il nome azienda" };
  }
  if (name.length > 200) {
    return { ok: false, error: "Nome troppo lungo" };
  }

  const people = (input.contactPeople ?? []).filter(
    (c) => c.firstName || c.lastName || c.email || c.whatsapp
  );
  const line = formatContactsSummaryLine(people);

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({
      name,
      sector: input.sector?.trim() || null,
      contacts: line || null,
      contacts_json: people,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || !isValidUuid(data.id)) {
    return { ok: false, error: "Risposta inattesa dal server" };
  }

  revalidatePath("/aziende");
  revalidatePath("/collaborazioni");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateBrand(
  input: UpdateBrandInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidUuid(input.id)) {
    return { ok: false, error: "ID non valido" };
  }
  const name = input.name?.trim() ?? "";
  if (name.length < 1) {
    return { ok: false, error: "Inserisci il nome azienda" };
  }
  if (name.length > 200) {
    return { ok: false, error: "Nome troppo lungo" };
  }

  const people = (input.contactPeople ?? []).filter(
    (c) => c.firstName || c.lastName || c.email || c.whatsapp
  );
  const line = formatContactsSummaryLine(people);

  const supabase = createSupabaseClient();
  const { data: updated, error } = await supabase
    .from("brands")
    .update({
      name,
      sector: input.sector?.trim() || null,
      contacts: line || null,
      contacts_json: people,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!updated) {
    return {
      ok: false,
      error:
        "Nessuna riga aggiornata. Verifica su Supabase la policy RLS (serve UPDATE su brands) o che l'ID esista.",
    };
  }

  const { data: collabRows } = await supabase
    .from("collaborations")
    .select("id")
    .eq("brand_id", input.id);
  for (const row of collabRows ?? []) {
    if (row?.id) {
      revalidatePath(`/collaborations/${row.id}`);
    }
  }

  revalidatePath("/aziende");
  revalidatePath("/collaborazioni");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath("/calendar");
  return { ok: true };
}
