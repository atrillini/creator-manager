/** Pulizia del testo email: HTML → testo, link compattati, citazioni rimosse per l'AI. */

function compactUrl(raw: string) {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const clean = `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
    return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  } catch {
    return raw.length > 90 ? `${raw.slice(0, 87)}...` : raw;
  }
}

export function normalizeBodyText(input: string) {
  const noMarkdownLinks = input.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_m, label: string, url: string) => {
      const cleanUrl = compactUrl(url);
      if (/^https?:\/\//i.test(label.trim())) return cleanUrl;
      return `${label.trim()} (${cleanUrl})`;
    }
  );
  return noMarkdownLinks
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, (u) => compactUrl(u))
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlToText(input: string) {
  const plain = input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return normalizeBodyText(plain);
}

const QUOTE_HEADERS = [
  /^(il giorno|in data)\b.*\bha scritto:?\s*$/i,
  /^on\b.*\bwrote:?\s*$/i,
  /^-{2,}\s*(messaggio originale|original message)\s*-{2,}/i,
  /^(da|from):\s.+$/i,
];

/** Testo "nuovo" di un messaggio: senza la conversazione citata sotto. */
export function stripQuotedReply(text: string) {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (QUOTE_HEADERS.some((re) => re.test(line)) && i > 2) break;
    if (line.startsWith(">")) continue;
    out.push(lines[i]!);
  }
  return out.join("\n").trim() || text.trim();
}

/** Oggetto senza prefissi Re:/Fwd:/R:/I:. */
export function normalizeSubject(subject: string) {
  return subject.replace(/^\s*((re|r|fw|fwd|i|inoltra)\s*:\s*)+/i, "").trim() || "(Senza oggetto)";
}

/** Rimuove accenti per la ricerca (il DB indicizza con unaccent). */
export function unaccent(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
