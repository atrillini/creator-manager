/** Nome bucket (deve combaciare con la migration Supabase). */
export const COLLAB_FILES_BUCKET = "collaboration-files" as const;

export function makeCollaborationObjectPath(
  collaborationId: string,
  file: File
): string {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const safe = file.name.replaceAll(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `collabs/${collaborationId}/${id}/${safe}`;
}
