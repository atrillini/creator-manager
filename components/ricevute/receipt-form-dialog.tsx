"use client";

import { saveReceipt } from "@/lib/actions/receipts";
import type { ReceiptFormOptions, ReceiptRow } from "@/lib/data/receipts";
import {
  STAMP_DUTY_MIN_AMOUNT,
  buildReceiptDocument,
  missingProfileFields,
  toIssuerSnapshot,
  toPaymentDetails,
  type PaymentMethod,
  type ReceiptLanguage,
  type ReceiptRecipient,
} from "@/lib/receipts/model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const NONE = "__none__";
const WITHHOLDING_RATE = 20;

export type ReceiptFormMode = "new" | "legacy" | "edit";

/** Montare solo quando il dialog è aperto: lo stato del form si inizializza al mount. */
type Props = {
  options: ReceiptFormOptions;
  mode: ReceiptFormMode;
  receipt?: ReceiptRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCollaborationId?: string | null;
};

type FormState = {
  brandId: string;
  collaborationId: string;
  language: ReceiptLanguage;
  issueDate: string;
  number: string;
  numberTouched: boolean;
  gross: string;
  withholding: boolean;
  stampDuty: boolean;
  paymentMethod: PaymentMethod;
  place: string;
  description: string;
  recipient: ReceiptRecipient;
  legacyStatus: "emessa" | "pagata";
  notes: string;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyRecipient = (): ReceiptRecipient => ({ name: "", address: "", vatNumber: "", extra: "" });

function parseGross(raw: string) {
  const t = raw.trim().replace(/\s/g, "").replace("€", "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inputCls = "h-8 border-gray-200 bg-white text-sm text-gray-900";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] text-gray-500">{label}</Label>
      {children}
    </div>
  );
}

export function ReceiptFormDialog({ options, mode, receipt, open, onOpenChange, initialCollaborationId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { profile, brands, collaborations, maxNumberByYear } = options;
  const legacy = mode === "legacy" || (mode === "edit" && receipt?.isLegacy === true);

  const nextNumber = (year: number) => (maxNumberByYear[year] ?? 0) + 1;
  const defaultDescription = (lang: ReceiptLanguage) =>
    lang === "en" ? profile.defaultDescriptionEn : profile.defaultDescriptionIt;

  const [f, setF] = useState<FormState>(() => initialState());

  function initialState(): FormState {
    if (mode === "edit" && receipt) {
      return {
        brandId: receipt.brandId ?? NONE,
        collaborationId: receipt.collaborationId ?? NONE,
        language: receipt.language,
        issueDate: receipt.issueDate,
        number: String(receipt.number),
        numberTouched: true,
        gross: String(receipt.gross).replace(".", ","),
        withholding: receipt.withholdingRate > 0,
        stampDuty: receipt.stampDuty,
        paymentMethod: receipt.paymentMethod,
        place: receipt.place,
        description: receipt.description,
        recipient: receipt.recipient,
        legacyStatus: receipt.status === "pagata" ? "pagata" : "emessa",
        notes: receipt.notes ?? "",
      };
    }
    const date = today();
    const base: FormState = {
      brandId: NONE,
      collaborationId: NONE,
      language: "it",
      issueDate: date,
      number: String(nextNumber(Number(date.slice(0, 4)))),
      numberTouched: false,
      gross: "",
      withholding: false,
      stampDuty: false,
      paymentMethod: profile.defaultPaymentMethod,
      place: profile.defaultPlace,
      description: profile.defaultDescriptionIt,
      recipient: emptyRecipient(),
      legacyStatus: "pagata",
      notes: "",
    };
    const collab = initialCollaborationId
      ? collaborations.find((c) => c.id === initialCollaborationId)
      : undefined;
    return collab ? applyCollaboration(base, collab.id) : base;
  }

  function applyBrand(state: FormState, brandId: string): FormState {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return { ...state, brandId: NONE };
    const language = brand.language;
    const wasDefaultDescription =
      state.description.trim() === "" || state.description === defaultDescription(state.language);
    return {
      ...state,
      brandId,
      recipient: brand.recipient,
      language,
      description: wasDefaultDescription ? defaultDescription(language) : state.description,
    };
  }

  function applyCollaboration(state: FormState, collaborationId: string): FormState {
    const collab = collaborations.find((c) => c.id === collaborationId);
    if (!collab) return { ...state, collaborationId: NONE };
    let next: FormState = { ...state, collaborationId };
    if (collab.brandId !== state.brandId) next = applyBrand(next, collab.brandId);
    const suggested = collab.remainingDue || collab.agreedFee;
    if (!state.gross.trim() && suggested) next.gross = String(suggested).replace(".", ",");
    return next;
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const setRecipient = (patch: Partial<ReceiptRecipient>) =>
    setF((prev) => ({ ...prev, recipient: { ...prev.recipient, ...patch } }));

  const year = Number(f.issueDate.slice(0, 4)) || new Date().getFullYear();
  const grossValue = parseGross(f.gross);
  const collabOptions = useMemo(
    () => (f.brandId === NONE ? collaborations : collaborations.filter((c) => c.brandId === f.brandId)),
    [collaborations, f.brandId]
  );
  const missing = legacy ? [] : missingProfileFields(profile, f.paymentMethod);

  const preview = useMemo(() => {
    if (legacy) return null;
    return buildReceiptDocument({
      language: f.language,
      number: Number(f.number) || 0,
      year,
      issueDate: f.issueDate,
      place: f.place,
      description: f.description,
      gross: grossValue,
      withholdingRate: f.withholding ? WITHHOLDING_RATE : 0,
      stampDuty: f.stampDuty,
      paymentMethod: f.paymentMethod,
      recipient: f.recipient,
      issuer: toIssuerSnapshot(profile),
      payment: toPaymentDetails(profile),
    });
  }, [legacy, f, year, grossValue, profile]);

  function onDateChange(v: string) {
    setF((prev) => {
      const y = Number(v.slice(0, 4));
      const number = !prev.numberTouched && y ? String(nextNumber(y)) : prev.number;
      return { ...prev, issueDate: v, number };
    });
  }

  function onLanguageChange(lang: ReceiptLanguage) {
    setF((prev) => ({
      ...prev,
      language: lang,
      description:
        prev.description === defaultDescription(prev.language) ? defaultDescription(lang) : prev.description,
    }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await saveReceipt({
        id: mode === "edit" ? receipt?.id : undefined,
        legacy,
        brandId: f.brandId === NONE ? null : f.brandId,
        collaborationId: f.collaborationId === NONE ? null : f.collaborationId,
        number: Number(f.number),
        issueDate: f.issueDate,
        language: f.language,
        gross: f.gross,
        withholdingRate: f.withholding ? WITHHOLDING_RATE : 0,
        stampDuty: f.stampDuty,
        description: f.description,
        place: f.place,
        paymentMethod: f.paymentMethod,
        recipient: f.recipient,
        legacyStatus: f.legacyStatus,
        notes: f.notes,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      if (!legacy && mode === "new") {
        setCreatedId(res.id);
        return;
      }
      onOpenChange(false);
    });
  }

  const title =
    mode === "edit" ? "Modifica ricevuta" : legacy ? "Registra ricevuta storica" : "Nuova ricevuta";
  const description = legacy
    ? "Documento già emesso fuori dal portale: viene solo registrato nello storico (nessun PDF)."
    : "Ricevuta per prestazione occasionale. Dopo l'emissione puoi aprire o scaricare il PDF da inviare.";

  if (createdId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border border-gray-200/80 bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-gray-900">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Ricevuta n° {String(f.number).padStart(2, "0")}/{year} emessa
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Registrata nello storico. Scarica il PDF e invialo a {f.recipient.name || "il brand"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button asChild variant="outline" className="border-gray-200 text-gray-800">
              <a href={`/api/ricevute/${createdId}/pdf`} target="_blank" rel="noreferrer">
                <FileText className="size-4" />
                Apri PDF
              </a>
            </Button>
            <Button asChild className="rounded-full">
              <a href={`/api/ricevute/${createdId}/pdf?download=1`}>
                <Download className="size-4" />
                Scarica PDF
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        className={cn(
          "max-h-[min(94vh,900px)] overflow-y-auto border border-gray-200/80 bg-white text-gray-900",
          legacy ? "max-w-xl" : "max-w-5xl"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-gray-900">{title}</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">{description}</DialogDescription>
        </DialogHeader>

        <div className={cn("grid gap-6", !legacy && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
          <form id="receipt-form" onSubmit={onSubmit} className="space-y-4">
            {missing.length > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Profilo fiscale incompleto ({missing.join(", ")}). Completa il profilo prima di emettere.
              </p>
            )}

            <section className="grid gap-2 sm:grid-cols-2">
              <Field label="Brand">
                <Select value={f.brandId} onValueChange={(v) => setF((prev) => (v === NONE ? { ...prev, brandId: NONE } : applyBrand(prev, v)))}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Nessuno (manuale) —</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Collaborazione">
                <Select
                  value={f.collaborationId}
                  onValueChange={(v) =>
                    setF((prev) => (v === NONE ? { ...prev, collaborationId: NONE } : applyCollaboration(prev, v)))
                  }
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Nessuna —</SelectItem>
                    {collabOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title.length > 60 ? `${c.title.slice(0, 60)}…` : c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </section>

            <section className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-medium text-gray-500">Intestatario (committente)</p>
              <Field label="Ragione sociale *">
                <Input
                  value={f.recipient.name}
                  onChange={(e) => setRecipient({ name: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
              {!legacy && (
                <>
                  <Field label="Indirizzo (una riga per voce)">
                    <Textarea
                      value={f.recipient.address}
                      onChange={(e) => setRecipient({ address: e.target.value })}
                      rows={3}
                      className="resize-none border-gray-200 bg-white text-sm text-gray-900"
                    />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="P.IVA / VAT">
                      <Input
                        value={f.recipient.vatNumber}
                        onChange={(e) => setRecipient({ vatNumber: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Righe extra (tel., direzione…)">
                      <Textarea
                        value={f.recipient.extra}
                        onChange={(e) => setRecipient({ extra: e.target.value })}
                        rows={1}
                        className="min-h-8 resize-y border-gray-200 bg-white text-sm text-gray-900"
                      />
                    </Field>
                  </div>
                  {f.brandId !== NONE && (
                    <p className="text-[11px] text-gray-400">
                      Precompilato dai dati di fatturazione del brand (modificabili in Aziende).
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="grid gap-2 sm:grid-cols-3">
              <Field label="Data emissione">
                <Input type="date" value={f.issueDate} onChange={(e) => onDateChange(e.target.value)} className={inputCls} required />
              </Field>
              <Field label={`Numero (${year})`}>
                <Input
                  type="number"
                  min={1}
                  value={f.number}
                  onChange={(e) => setF((prev) => ({ ...prev, number: e.target.value, numberTouched: true }))}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Importo lordo €">
                <Input
                  value={f.gross}
                  onChange={(e) => set("gross", e.target.value)}
                  inputMode="decimal"
                  placeholder="200,00"
                  className={inputCls}
                  required
                />
              </Field>
            </section>

            {legacy ? (
              <section className="grid gap-2 sm:grid-cols-2">
                <Field label="Stato">
                  <Select value={f.legacyStatus} onValueChange={(v) => set("legacyStatus", v as "emessa" | "pagata")}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pagata">Già pagata</SelectItem>
                      <SelectItem value="emessa">In attesa di pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Lingua">
                  <Select value={f.language} onValueChange={(v) => set("language", v as ReceiptLanguage)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </section>
            ) : (
              <>
                <section className="grid gap-2 sm:grid-cols-3">
                  <Field label="Lingua">
                    <Select value={f.language} onValueChange={(v) => onLanguageChange(v as ReceiptLanguage)}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pagamento">
                    <Select value={f.paymentMethod} onValueChange={(v) => set("paymentMethod", v as PaymentMethod)}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bonifico</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Luogo">
                    <Input value={f.place} onChange={(e) => set("place", e.target.value)} className={inputCls} />
                  </Field>
                </section>

                <Field label="Descrizione compenso — {anno} viene sostituito">
                  <Textarea
                    value={f.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    className="resize-none border-gray-200 bg-white text-sm text-gray-900"
                  />
                </Field>

                <section className="space-y-2 rounded-2xl border border-gray-100 p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm text-gray-800">Ritenuta d&apos;acconto 20%</span>
                      <span className="block text-[11px] text-gray-500">
                        Solo se il committente è un sostituto d&apos;imposta italiano (non per brand esteri).
                      </span>
                    </span>
                    <Switch checked={f.withholding} onCheckedChange={(v) => set("withholding", v)} />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm text-gray-800">Marca da bollo € 2,00</span>
                      <span className="block text-[11px] text-gray-500">
                        Dovuta sopra € {STAMP_DUTY_MIN_AMOUNT.toLocaleString("it-IT")}; aggiunge la dicitura sul documento.
                      </span>
                    </span>
                    <Switch checked={f.stampDuty} onCheckedChange={(v) => set("stampDuty", v)} />
                  </label>
                  {grossValue > STAMP_DUTY_MIN_AMOUNT && !f.stampDuty && (
                    <p className="text-[11px] text-amber-700">
                      L&apos;importo supera € 77,47: valuta se applicare la marca da bollo.
                    </p>
                  )}
                </section>
              </>
            )}

            <Field label="Note interne (non stampate)">
              <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
            </Field>

            {err && (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            )}
          </form>

          {preview && (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Anteprima</p>
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-[11px] leading-relaxed text-gray-800 shadow-sm">
                {preview.paragraphs.map((para, i) => (
                  <div key={i} className="mb-3">
                    {para.map((line, j) => (
                      <p key={j} className={cn(line.bold && "font-semibold")}>
                        {line.label ? <span className="font-semibold">{line.label} </span> : null}
                        {line.text}
                      </p>
                    ))}
                  </div>
                ))}
                <div className="flex items-end gap-3">
                  <span>{preview.signatureLabel}</span>
                  {profile.signatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.signatureDataUrl} alt="" className="max-h-10 max-w-32 object-contain" />
                  ) : (
                    <span className="inline-block w-40 border-b border-gray-400" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="border-gray-200 text-gray-800"
          >
            Annulla
          </Button>
          <Button type="submit" form="receipt-form" disabled={pending || missing.length > 0} className="rounded-full">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvataggio…
              </>
            ) : mode === "edit" ? (
              "Salva modifiche"
            ) : legacy ? (
              "Registra"
            ) : (
              "Emetti ricevuta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
