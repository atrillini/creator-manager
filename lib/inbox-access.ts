import { getAdminUserId, isAdminUser } from "@/lib/admin";

/** Inbox riservata all'admin; se nessun admin è configurato resta aperta a chi è loggato. */
export function canAccessInbox(userId: string | null | undefined) {
  if (!getAdminUserId()) return Boolean(userId);
  return isAdminUser(userId);
}
