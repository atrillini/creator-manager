/** Testo multilinea con URL resi cliccabili (nuova scheda). */

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;

export function renderTextWithLinks(text: string | null | undefined) {
  const src = (text ?? "").trim();
  if (!src) return "—";
  const lines = src.split(/\r?\n/);
  return lines.map((line, lineIdx) => {
    const parts = line.split(URL_RE);
    return (
      <span key={`line-${lineIdx}`}>
        {parts.map((part, idx) => {
          if (!part) return null;
          if (/^(?:https?:\/\/|www\.)/i.test(part)) {
            const href = part.startsWith("http") ? part : `https://${part}`;
            return (
              <a
                key={`p-${lineIdx}-${idx}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
              >
                {part}
              </a>
            );
          }
          return <span key={`p-${lineIdx}-${idx}`}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}
