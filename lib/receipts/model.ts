/**
 * Modello ricevuta per prestazione occasionale: tipi, calcolo importi e testo
 * del documento (IT/EN). Nessuna dipendenza server: usato sia dal PDF sia
 * dall'anteprima nel form.
 */

export type ReceiptLanguage = "it" | "en";
export type ReceiptStatus = "emessa" | "pagata" | "annullata";
export type PaymentMethod = "bank" | "paypal";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  emessa: "Emessa",
  pagata: "Pagata",
  annullata: "Annullata",
};

/** Soglia annua lorda oltre la quale scattano i contributi INPS (Gestione Separata). */
export const OCCASIONAL_WORK_THRESHOLD = 5000;

/** Oltre questo importo la ricevuta richiede la marca da bollo da € 2,00. */
export const STAMP_DUTY_MIN_AMOUNT = 77.47;

export type ReceiptRecipient = {
  name: string;
  /** Multi-riga */
  address: string;
  vatNumber: string;
  /** Righe libere (telefono, direzione, C.F.…) */
  extra: string;
};

export type IssuerProfile = {
  fullName: string;
  alias: string;
  gender: "f" | "m";
  birthPlace: string;
  /** YYYY-MM-DD */
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  taxCode: string;
  email: string;
  defaultPlace: string;
  defaultDescriptionIt: string;
  defaultDescriptionEn: string;
  defaultPaymentMethod: PaymentMethod;
  bankName: string;
  iban: string;
  bic: string;
  bankAddress: string;
  accountHolder: string;
  paypalEmail: string;
  signatureDataUrl: string;
};

/** Parte del profilo congelata nella ricevuta (senza default e firma). */
export type IssuerSnapshot = Pick<
  IssuerProfile,
  | "fullName"
  | "alias"
  | "gender"
  | "birthPlace"
  | "birthDate"
  | "street"
  | "postalCode"
  | "city"
  | "province"
  | "country"
  | "taxCode"
  | "email"
>;

export type PaymentDetails = Pick<
  IssuerProfile,
  "bankName" | "iban" | "bic" | "bankAddress" | "accountHolder" | "paypalEmail"
>;

export const DEFAULT_DESCRIPTION_IT =
  "la collaborazione occasionale per la creazione di materiale fotografico ai fini commerciali eseguito nel {anno} in Italia";
export const DEFAULT_DESCRIPTION_EN =
  "occasional collaboration for the creation of photographic material for commercial purposes carried out in {anno} in Italy";

export function emptyIssuerProfile(): IssuerProfile {
  return {
    fullName: "",
    alias: "",
    gender: "f",
    birthPlace: "",
    birthDate: "",
    street: "",
    postalCode: "",
    city: "",
    province: "",
    country: "ITALY",
    taxCode: "",
    email: "",
    defaultPlace: "",
    defaultDescriptionIt: DEFAULT_DESCRIPTION_IT,
    defaultDescriptionEn: DEFAULT_DESCRIPTION_EN,
    defaultPaymentMethod: "bank",
    bankName: "",
    iban: "",
    bic: "",
    bankAddress: "",
    accountHolder: "",
    paypalEmail: "",
    signatureDataUrl: "",
  };
}

export function toIssuerSnapshot(p: IssuerProfile): IssuerSnapshot {
  return {
    fullName: p.fullName,
    alias: p.alias,
    gender: p.gender,
    birthPlace: p.birthPlace,
    birthDate: p.birthDate,
    street: p.street,
    postalCode: p.postalCode,
    city: p.city,
    province: p.province,
    country: p.country,
    taxCode: p.taxCode,
    email: p.email,
  };
}

export function toPaymentDetails(p: IssuerProfile): PaymentDetails {
  return {
    bankName: p.bankName,
    iban: p.iban,
    bic: p.bic,
    bankAddress: p.bankAddress,
    accountHolder: p.accountHolder,
    paypalEmail: p.paypalEmail,
  };
}

/** Campi del profilo necessari per emettere un documento completo. */
export function missingProfileFields(p: IssuerProfile, method: PaymentMethod): string[] {
  const out: string[] = [];
  if (!p.fullName.trim()) out.push("nome e cognome");
  if (!p.taxCode.trim()) out.push("codice fiscale");
  if (!p.street.trim() || !p.city.trim()) out.push("residenza");
  if (method === "bank" && !p.iban.trim()) out.push("IBAN");
  if (method === "paypal" && !p.paypalEmail.trim()) out.push("email PayPal");
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeAmounts(gross: number, withholdingRate: number) {
  const g = round2(gross);
  const withholding = round2((g * withholdingRate) / 100);
  return { gross: g, withholding, net: round2(g - withholding) };
}

export function formatAmount(n: number, lang: ReceiptLanguage) {
  return new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatReceiptNumber(number: number, year: number) {
  return `${String(number).padStart(2, "0")}/${year}`;
}

/** YYYY-MM-DD → DD{sep}MM{sep}YYYY */
function formatDate(iso: string, sep: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return [d, m, y].join(sep);
}

export function resolveDescription(template: string, year: number) {
  return template.replaceAll("{anno}", String(year)).trim().replace(/[.\s]+$/, "");
}

export type ReceiptDocumentInput = {
  language: ReceiptLanguage;
  number: number;
  year: number;
  issueDate: string;
  place: string;
  description: string;
  gross: number;
  withholdingRate: number;
  stampDuty: boolean;
  paymentMethod: PaymentMethod;
  recipient: ReceiptRecipient;
  issuer: IssuerSnapshot;
  payment: PaymentDetails;
};

export type ReceiptLine = { text: string; bold?: boolean; label?: string };

/**
 * Documento come sequenza di paragrafi (ogni paragrafo = righe logiche,
 * separati da spazio verticale). La firma viene aggiunta dal renderer.
 */
export type ReceiptDocument = {
  paragraphs: ReceiptLine[][];
  signatureLabel: string;
};

const join = (parts: (string | undefined | null)[], sep = ", ") =>
  parts.map((p) => p?.trim()).filter(Boolean).join(sep);

function splitLines(s: string) {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function buildReceiptDocument(input: ReceiptDocumentInput): ReceiptDocument {
  const { issuer: me, recipient: to, payment: pay, language: lang } = input;
  const it = lang === "it";
  const amounts = computeAmounts(input.gross, input.withholdingRate);
  const eur = (n: number) => `€ ${formatAmount(n, lang)}`;
  const cityProv = join([me.city, me.province ? `(${me.province})` : ""], " ");
  const residence = join([me.street, me.postalCode, cityProv]) + (me.country ? ` - ${me.country}` : "");
  const description = resolveDescription(input.description, input.year);
  const paragraphs: ReceiptLine[][] = [];

  const recipientBlock: ReceiptLine[] = [];
  if (to.name.trim()) recipientBlock.push({ text: to.name.trim(), bold: true });
  for (const l of splitLines(to.address)) recipientBlock.push({ text: l });
  for (const l of splitLines(to.extra)) recipientBlock.push({ text: l });
  if (to.vatNumber.trim()) {
    recipientBlock.push({ label: it ? "P.IVA:" : "VAT:", text: to.vatNumber.trim() });
  }
  if (recipientBlock.length) paragraphs.push(recipientBlock);

  paragraphs.push([
    { label: it ? "Nome:" : "Name:", text: me.fullName },
    { label: it ? "Residenza:" : "Address:", text: residence },
    { label: it ? "Codice Fiscale:" : "Tax code:", text: me.taxCode },
  ]);

  paragraphs.push([
    {
      text: it
        ? `Nota n° ${String(input.number).padStart(2, "0")} del ${input.year}`
        : `Receipt no. ${String(input.number).padStart(2, "0")} of ${input.year}`,
      bold: true,
    },
  ]);

  const female = me.gender === "f";
  const alias = me.alias.trim();
  const birth = me.birthDate ? formatDate(me.birthDate, it ? "/" : "-") : "";
  const declaration = it
    ? `Io sottoscritt${female ? "a" : "o"} ${me.fullName}` +
      (alias ? `, in alias ${alias}` : "") +
      (me.birthPlace ? `, nat${female ? "a" : "o"} a ${me.birthPlace}` : "") +
      (birth ? `, il ${birth}` : "") +
      `, residente a ${join([me.city, me.street, me.postalCode])}`
    : `I, the undersigned ${me.fullName}` +
      (alias ? `, also known as ${alias}` : "") +
      (me.birthPlace || birth
        ? `, born${me.birthPlace ? ` in ${me.birthPlace}` : ""}${birth ? ` on ${birth}` : ""}`
        : "") +
      `, residing at ${join([cityProv, me.street, me.postalCode])}` +
      (me.country ? ` - ${me.country}` : "");
  paragraphs.push([{ text: declaration }]);

  paragraphs.push([
    {
      text: it
        ? `RICEVO la somma di ${eur(amounts.gross)} quale compenso per ${description}.`
        : `RECEIVE the sum of ${eur(amounts.gross)} as compensation for ${description}.`,
    },
  ]);

  if (amounts.withholding > 0) {
    const rate = formatAmount(input.withholdingRate, lang).replace(/[.,]00$/, "");
    paragraphs.push([
      { label: it ? "Compenso lordo:" : "Gross amount:", text: eur(amounts.gross) },
      {
        label: it ? `Ritenuta d'acconto ${rate}%:` : `Withholding tax ${rate}%:`,
        text: `- ${eur(amounts.withholding)}`,
      },
      { label: it ? "Netto a pagare:" : "Net to pay:", text: eur(amounts.net), bold: true },
    ]);
  } else {
    paragraphs.push([{ label: it ? "Netto a pagare:" : "Net to pay:", text: eur(amounts.net), bold: true }]);
  }

  const fiscal: ReceiptLine[] = [
    {
      text: it
        ? "La prestazione è occasionale ed è esclusa dal campo di applicazione dell’IVA (art. 5 del DPR 633 del 26/10/1972), da inquadrare tra i redditi diversi di cui all’art. 67, comma 1, lettera l) del DPR 917/86."
        : "The service is occasional and excluded from the scope of VAT (art. 5 of DPR 633 of 26/10/1972), to be classified among the miscellaneous income referred to in art. 67, paragraph 1, letter l) of DPR 917/86.",
    },
  ];
  if (input.stampDuty) {
    fiscal.push({
      text: it
        ? "Marca da bollo da € 2,00 assolta sull’originale."
        : "Stamp duty of € 2.00 paid on the original.",
    });
  }
  paragraphs.push(fiscal);

  const payBlock: ReceiptLine[] = [];
  if (input.paymentMethod === "bank") {
    payBlock.push({
      label: it ? "Pagamento da effettuarsi tramite Banca:" : "Payment to be made via:",
      text: pay.bankName || (it ? "" : "Bank transfer"),
    });
    payBlock.push({ label: "IBAN:", text: pay.iban });
    if (pay.bic) payBlock.push({ label: it ? "BIC:" : "BIC/SWIFT:", text: pay.bic });
    if (pay.bankAddress) payBlock.push({ label: it ? "Indirizzo:" : "Address:", text: pay.bankAddress });
  } else {
    payBlock.push({
      label: it ? "Pagamento da effettuarsi tramite:" : "Payment to be made via:",
      text: "PayPal",
    });
    payBlock.push({ label: it ? "Indirizzo:" : "Address:", text: pay.paypalEmail });
  }
  if (pay.accountHolder) {
    payBlock.push({ label: it ? "Conto intestato a:" : "Account holder:", text: pay.accountHolder });
  }
  paragraphs.push(payBlock);

  if (me.email) paragraphs.push([{ label: "Email:", text: me.email }]);

  paragraphs.push([
    {
      label: it ? "Luogo e data:" : "Place and date:",
      text: join([input.place, formatDate(input.issueDate, "-")]),
    },
  ]);

  return { paragraphs, signatureLabel: it ? "Firma" : "Signature:" };
}

export function receiptFileName(opts: { number: number; year: number; recipientName: string }) {
  const slug = opts.recipientName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `Ricevuta_${opts.year}-${String(opts.number).padStart(2, "0")}${slug ? `_${slug}` : ""}.pdf`;
}
