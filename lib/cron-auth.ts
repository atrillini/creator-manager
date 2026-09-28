import { timingSafeEqual } from "node:crypto";

/** I job schedulati (pg_cron / Vercel Cron) inviano `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Utente per cui girano i job (app mono-utente: l'admin). */
export function cronUserId() {
  const id = (process.env.ADMIN_USER_ID ?? process.env.INBOX_ALLOWED_USER_ID ?? "").trim();
  if (!id) throw new Error("ADMIN_USER_ID non configurato: necessario per i job schedulati");
  return id;
}
