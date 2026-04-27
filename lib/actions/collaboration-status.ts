"use server";

import { revalidatePath } from "next/cache";
import { COLLAB_STATUSES, type CollabStatus } from "@/lib/collab-statuses";
import { isValidUuid } from "@/lib/is-uuid";
import { type KanbanStatus, mapKanbanToDbStatus } from "@/lib/types";
import { createSupabaseClient } from "@/lib/supabase";

const path = (id: string) => `/collaborations/${id}`;

function isDbStatus(s: string): s is CollabStatus {
  return (COLLAB_STATUSES as readonly string[]).includes(s);
}

function revalidateForCollaboration(id: string) {
  revalidatePath("/collaborazioni");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath(path(id));
}

export async function setCollaborationStatus(
  collaborationId: string,
  status: string
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID non valido" };
  }
  if (!isDbStatus(status)) {
    return { ok: false as const, error: "Stato non valido" };
  }
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("collaborations")
    .update({ status })
    .eq("id", collaborationId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateForCollaboration(collaborationId);
  return { ok: true as const };
}

export async function moveCollaborationToColumn(
  collaborationId: string,
  column: KanbanStatus
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID non valido" };
  }
  const status = mapKanbanToDbStatus(column);
  return setCollaborationStatus(collaborationId, status);
}
