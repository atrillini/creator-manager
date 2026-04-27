/**
 * Stringa in formato UUID standard (8-4-4-4-12) come restituita da PostgreSQL.
 * I mock della Kanban usano id come "c1" e vanno scartati prima di query/Supabase.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return Boolean(id && UUID.test(id));
}
