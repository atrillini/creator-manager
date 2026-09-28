/**
 * URL pubblico dell'app da APP_URL, normalizzato: accetta anche "crm.dominio.com"
 * (aggiunge https://) e rimuove la / finale. null se non configurato o non valido.
 */
export function configuredAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return null;
  }
}
