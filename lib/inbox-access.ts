export function canAccessInbox(userId: string | null | undefined) {
  const allowed = String(process.env.INBOX_ALLOWED_USER_ID ?? "").trim();
  if (!allowed) return true;
  if (!userId) return false;
  return userId === allowed;
}
