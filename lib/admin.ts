/** Utente amministratore (unico, o il primo di pochi): controlla inbox e registrazioni. */
export function getAdminUserId(): string | null {
  const raw = process.env.ADMIN_USER_ID ?? process.env.INBOX_ALLOWED_USER_ID ?? "";
  return raw.trim() || null;
}

export function isAdminUser(userId: string | null | undefined): boolean {
  const admin = getAdminUserId();
  return Boolean(admin && userId && userId === admin);
}
