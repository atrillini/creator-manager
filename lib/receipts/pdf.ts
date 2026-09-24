import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { ReceiptDocument } from "@/lib/receipts/model";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 72;
const MARGIN_TOP = 80;
const MARGIN_BOTTOM = 60;
const FONT_SIZE = 10.5;
const LINE_HEIGHT = 14.5;
const PARAGRAPH_GAP = 12;
const TEXT_COLOR = rgb(0.1, 0.1, 0.1);

/** Caratteri extra (oltre Latin-1) codificabili con WinAnsi nei font standard. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** I font standard PDF usano WinAnsi: sostituisce i caratteri non codificabili. */
function sanitize(text: string) {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
    } else if (ch === "\t") {
      out += " ";
    } else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += /^[\x20-\x7e]$/.test(base) ? base : "?";
    }
  }
  return out;
}

type Word = { text: string; font: PDFFont };

/** Spezza una riga logica (label in grassetto + testo) in righe che stanno nella larghezza. */
function wrap(words: Word[], maxWidth: number): Word[][] {
  const lines: Word[][] = [];
  let current: Word[] = [];
  let width = 0;
  for (const w of words) {
    const wWidth = w.font.widthOfTextAtSize(w.text, FONT_SIZE);
    const space = current.length ? w.font.widthOfTextAtSize(" ", FONT_SIZE) : 0;
    if (current.length && width + space + wWidth > maxWidth) {
      lines.push(current);
      current = [w];
      width = wWidth;
    } else {
      current.push(w);
      width += space + wWidth;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

async function embedSignature(pdf: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const bytes = Buffer.from(m[2]!, "base64");
  try {
    return m[1]!.toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function renderReceiptPdf(
  doc: ReceiptDocument,
  opts: { title: string; signatureDataUrl?: string | null; watermark?: string | null }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setCreator("CreatorCRM");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const ensureSpace = (h: number) => {
    if (y - h < MARGIN_BOTTOM) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  const drawWords = (line: Word[]) => {
    ensureSpace(LINE_HEIGHT);
    let x = MARGIN_X;
    for (const [i, w] of line.entries()) {
      if (i > 0) x += w.font.widthOfTextAtSize(" ", FONT_SIZE);
      page.drawText(w.text, { x, y, size: FONT_SIZE, font: w.font, color: TEXT_COLOR });
      x += w.font.widthOfTextAtSize(w.text, FONT_SIZE);
    }
    y -= LINE_HEIGHT;
  };

  for (const paragraph of doc.paragraphs) {
    for (const line of paragraph) {
      const words: Word[] = [];
      if (line.label) {
        for (const t of sanitize(line.label).split(/\s+/).filter(Boolean)) words.push({ text: t, font: bold });
      }
      const textFont = line.bold ? bold : regular;
      for (const t of sanitize(line.text).split(/\s+/).filter(Boolean)) words.push({ text: t, font: textFont });
      if (!words.length) continue;
      for (const l of wrap(words, maxWidth)) drawWords(l);
    }
    y -= PARAGRAPH_GAP;
  }

  const signature = opts.signatureDataUrl ? await embedSignature(pdf, opts.signatureDataUrl) : null;
  const sigBox = signature ? signature.scaleToFit(150, 55) : null;
  ensureSpace(LINE_HEIGHT + (sigBox?.height ?? 0) + 10);
  const label = sanitize(doc.signatureLabel);
  page.drawText(label, { x: MARGIN_X, y, size: FONT_SIZE, font: regular, color: TEXT_COLOR });
  const labelWidth = regular.widthOfTextAtSize(label, FONT_SIZE);
  if (signature && sigBox) {
    page.drawImage(signature, {
      x: MARGIN_X + labelWidth + 12,
      y: y - 12,
      width: sigBox.width,
      height: sigBox.height,
    });
  } else {
    page.drawLine({
      start: { x: MARGIN_X + labelWidth + 8, y: y - 2 },
      end: { x: MARGIN_X + labelWidth + 190, y: y - 2 },
      thickness: 0.6,
      color: TEXT_COLOR,
    });
  }

  if (opts.watermark) {
    for (const p of pdf.getPages()) {
      p.drawText(sanitize(opts.watermark), {
        x: 120,
        y: PAGE_HEIGHT / 2 - 60,
        size: 72,
        font: bold,
        color: rgb(0.85, 0.2, 0.2),
        opacity: 0.18,
        rotate: degrees(35),
      });
    }
  }

  return pdf.save();
}
