"use server";

import { revalidatePath } from "next/cache";
import { isDeliverableWorkflowStatus } from "@/lib/deliverable-statuses";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/is-uuid";
import { EVENT_TYPES, type EventType } from "@/lib/collab-event-types";
import { isDeliverableType } from "@/lib/collaboration-form-shared";

const path = (id: string) => `/collaborations/${id}`;

function isEventType(v: string): v is EventType {
  return (EVENT_TYPES as readonly string[]).includes(v);
}

/** Il path deve appartenere alla cartella della collaborazione (la RLS di Storage fa il resto). */
function normalizeAttachmentPath(collaborationId: string, raw: string | null | undefined) {
  const p = (raw ?? "").trim();
  if (!p) return { ok: true as const, path: null };
  if (!p.startsWith(`collabs/${collaborationId}/`) || p.includes("..")) {
    return { ok: false as const, error: "Allegato non valido" };
  }
  return { ok: true as const, path: p };
}

function normalizeContentUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  try {
    const withProto = t.includes("://") ? t : `https://${t}`;
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}

export async function updateGeneralNotes(
  collaborationId: string,
  generalNotes: string
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase
    .from("collaborations")
    .update({ general_notes: generalNotes })
    .eq("id", collaborationId)
    .eq("user_id", userId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath(path(collaborationId));
  return { ok: true as const };
}

export async function addCollaborationEvent(
  collaborationId: string,
  eventType: string,
  description: string,
  attachedFilePath: string | null,
  eventAtIso: string
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  if (!isEventType(eventType)) {
    return { ok: false as const, error: "Tipo evento non valido" };
  }
  const att = normalizeAttachmentPath(collaborationId, attachedFilePath);
  if (!att.ok) return att;
  const desc = (description || "").trim();
  const finalDescription =
    desc || (att.path ? "File caricato" : null);
  if (!finalDescription) {
    return {
      ok: false as const,
      error: "Inserisci una descrizione o carica un allegato",
    };
  }
  const t = (eventAtIso || "").trim();
  const at = t ? new Date(t) : new Date();
  if (Number.isNaN(at.getTime())) {
    return { ok: false as const, error: "Data o ora non valide" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase.from("collaboration_events").insert({
    collaboration_id: collaborationId,
    user_id: userId,
    event_type: eventType,
    description: finalDescription,
    attached_file_path: att.path,
    attached_file_url: null,
    event_at: at.toISOString(),
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath(path(collaborationId));
  return { ok: true as const };
}

export type UpsertEventInput = {
  eventType: string;
  description: string;
  eventAtIso: string;
  /** Oggetto nel bucket privato. */
  attachedFilePath: string | null;
  /** Link esterno legacy (eventi creati prima del bucket privato). */
  attachedFileUrl: string | null;
};

function normalizeEventInput(collaborationId: string, input: UpsertEventInput) {
  if (!isEventType(input.eventType)) {
    return { ok: false as const, error: "Tipo evento non valido" };
  }
  const att = normalizeAttachmentPath(collaborationId, input.attachedFilePath);
  if (!att.ok) return att;
  const legacyUrl = att.path ? null : input.attachedFileUrl?.trim() || null;
  const desc = (input.description || "").trim();
  const finalDescription =
    desc || (att.path || legacyUrl ? "File caricato" : null);
  if (!finalDescription) {
    return {
      ok: false as const,
      error: "Inserisci una descrizione o un allegato",
    };
  }
  const t = (input.eventAtIso || "").trim();
  const at = t ? new Date(t) : new Date();
  if (Number.isNaN(at.getTime())) {
    return { ok: false as const, error: "Data o ora non valide" };
  }
  return {
    ok: true as const,
    payload: {
      event_type: input.eventType,
      description: finalDescription,
      event_at: at.toISOString(),
      attached_file_path: att.path,
      attached_file_url: legacyUrl,
    },
  };
}

export async function updateCollaborationEvent(
  collaborationId: string,
  eventId: string,
  input: UpsertEventInput
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  const norm = normalizeEventInput(collaborationId, input);
  if (!norm.ok) {
    return norm;
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("collaboration_events")
    .update(norm.payload)
    .eq("id", eventId)
    .eq("collaboration_id", collaborationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data) {
    return { ok: false as const, error: "Evento non trovato o accesso negato" };
  }
  revalidatePath(path(collaborationId));
  return { ok: true as const };
}

export async function deleteCollaborationEvent(
  collaborationId: string,
  eventId: string
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("collaboration_events")
    .delete()
    .eq("id", eventId)
    .eq("collaboration_id", collaborationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data) {
    return { ok: false as const, error: "Evento non trovato" };
  }
  revalidatePath(path(collaborationId));
  return { ok: true as const };
}

export async function addDeliverable(
  collaborationId: string,
  type: string,
  publishDate: string,
  status: string = "da girare",
  contentUrl?: string
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  if (!isDeliverableType(type)) {
    return { ok: false as const, error: "Tipo contenuto non valido" };
  }
  if (!isDeliverableWorkflowStatus(status)) {
    return { ok: false as const, error: "Stato non valido" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
    return { ok: false as const, error: "Data di pubblicazione non valida" };
  }
  const link = normalizeContentUrl(contentUrl);
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase.from("deliverables").insert({
    collaboration_id: collaborationId,
    user_id: userId,
    type,
    publish_date: publishDate,
    status,
    content_url: link,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateCollaborationPaths(collaborationId);
  return { ok: true as const };
}

export type UpdateDeliverableInput = {
  type: string;
  publishDate: string;
  status: string;
  contentUrl: string | null;
};

export async function updateDeliverable(
  collaborationId: string,
  deliverableId: string,
  input: UpdateDeliverableInput
) {
  if (!isValidUuid(collaborationId)) {
    return { ok: false as const, error: "ID collaborazione non valido" };
  }
  if (!isDeliverableType(input.type)) {
    return { ok: false as const, error: "Tipo contenuto non valido" };
  }
  if (!isDeliverableWorkflowStatus(input.status)) {
    return { ok: false as const, error: "Stato non valido" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.publishDate)) {
    return { ok: false as const, error: "Data di pubblicazione non valida" };
  }
  const link = normalizeContentUrl(
    input.contentUrl === null ? "" : input.contentUrl
  );
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("deliverables")
    .update({
      type: input.type,
      publish_date: input.publishDate,
      status: input.status,
      content_url: link,
    })
    .eq("id", deliverableId)
    .eq("collaboration_id", collaborationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data) {
    return {
      ok: false as const,
      error: "Scadenza non trovata o accesso negato",
    };
  }
  revalidateCollaborationPaths(collaborationId);
  return { ok: true as const };
}
