import { supabase } from "@/lib/supabase";
import { COLLAB_FILES_BUCKET, makeCollaborationObjectPath } from "@/lib/storage-constants";

/** Carica un allegato nel bucket privato e restituisce il path dell'oggetto (non un URL). */
export async function uploadCollaborationFile(collaborationId: string, file: File): Promise<string> {
  const objectPath = makeCollaborationObjectPath(collaborationId, file);
  const { data, error } = await supabase.storage.from(COLLAB_FILES_BUCKET).upload(objectPath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return data.path;
}
