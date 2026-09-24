"use client";

import { saveIssuerProfile } from "@/lib/actions/receipts";
import type { IssuerProfile, PaymentMethod } from "@/lib/receipts/model";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const MAX_SIGNATURE_BYTES = 280_000;

type Props = { profile: IssuerProfile; incomplete?: boolean };

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] text-gray-500">{label}</Label>
      {children}
    </div>
  );
}

const inputCls = "h-8 border-gray-200 bg-white text-sm text-gray-900";

export function IssuerProfileDialog({ profile, incomplete }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<IssuerProfile>(profile);

  const set = <K extends keyof IssuerProfile>(k: K, v: IssuerProfile[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));

  function onSignatureFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setErr("La firma deve essere un'immagine PNG o JPG");
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setErr("Immagine firma troppo grande (max ~280 KB). Ritagliala o comprimila.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("signatureDataUrl", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await saveIssuerProfile(p);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 rounded-full border-gray-200 text-gray-700"
        onClick={() => {
          setP(profile);
          setErr(null);
          setOpen(true);
        }}
      >
        <UserCog className="size-4" />
        Profilo fiscale
        {incomplete ? <span className="size-1.5 rounded-full bg-amber-500" aria-label="incompleto" /> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onPointerDownOutside={(e) => pending && e.preventDefault()}
          className="max-h-[min(92vh,820px)] max-w-2xl overflow-y-auto border border-gray-200/80 bg-white text-gray-900"
        >
          <DialogHeader>
            <DialogTitle className="text-lg text-gray-900">Profilo fiscale</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Dati di chi emette la ricevuta. Vengono copiati in ogni documento al momento
              dell&apos;emissione.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Anagrafica</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Nome e cognome *">
                  <Input value={p.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Alias (nome d'arte)">
                  <Input value={p.alias} onChange={(e) => set("alias", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Luogo di nascita">
                  <Input
                    value={p.birthPlace}
                    onChange={(e) => set("birthPlace", e.target.value)}
                    placeholder="Camerino (MC)"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Data di nascita">
                    <Input
                      type="date"
                      value={p.birthDate}
                      onChange={(e) => set("birthDate", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Forma (IT)">
                    <Select value={p.gender} onValueChange={(v) => set("gender", v as "f" | "m")}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="f">sottoscritta</SelectItem>
                        <SelectItem value="m">sottoscritto</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Codice fiscale *">
                  <Input
                    value={p.taxCode}
                    onChange={(e) => set("taxCode", e.target.value.toUpperCase())}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Email (riportata nel documento)">
                  <Input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </Field>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Residenza</p>
              <div className="grid gap-2 sm:grid-cols-6">
                <Field label="Via e civico *" className="sm:col-span-4">
                  <Input value={p.street} onChange={(e) => set("street", e.target.value)} className={inputCls} />
                </Field>
                <Field label="CAP" className="sm:col-span-2">
                  <Input value={p.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Comune *" className="sm:col-span-3">
                  <Input value={p.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Prov." className="sm:col-span-1">
                  <Input
                    value={p.province}
                    onChange={(e) => set("province", e.target.value.toUpperCase())}
                    maxLength={4}
                    className={inputCls}
                  />
                </Field>
                <Field label="Paese" className="sm:col-span-2">
                  <Input value={p.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                </Field>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pagamento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Metodo predefinito">
                  <Select
                    value={p.defaultPaymentMethod}
                    onValueChange={(v) => set("defaultPaymentMethod", v as PaymentMethod)}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bonifico bancario</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Conto intestato a">
                  <Input
                    value={p.accountHolder}
                    onChange={(e) => set("accountHolder", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Banca">
                  <Input
                    value={p.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder="Revolut Bank UAB"
                    className={inputCls}
                  />
                </Field>
                <Field label="IBAN">
                  <Input
                    value={p.iban}
                    onChange={(e) => set("iban", e.target.value.toUpperCase())}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="BIC / SWIFT">
                  <Input
                    value={p.bic}
                    onChange={(e) => set("bic", e.target.value.toUpperCase())}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Indirizzo banca (opzionale)">
                  <Input
                    value={p.bankAddress}
                    onChange={(e) => set("bankAddress", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Email PayPal">
                  <Input
                    type="email"
                    value={p.paypalEmail}
                    onChange={(e) => set("paypalEmail", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Predefiniti documento</p>
              <Field label="Luogo di emissione">
                <Input
                  value={p.defaultPlace}
                  onChange={(e) => set("defaultPlace", e.target.value)}
                  placeholder="Corridonia"
                  className={inputCls}
                />
              </Field>
              <Field label="Descrizione compenso (IT) — segue “quale compenso per…”; {anno} = anno della ricevuta">
                <Textarea
                  value={p.defaultDescriptionIt}
                  onChange={(e) => set("defaultDescriptionIt", e.target.value)}
                  rows={2}
                  className="resize-none border-gray-200 bg-white text-sm text-gray-900"
                />
              </Field>
              <Field label="Descrizione compenso (EN) — segue “as compensation for…”">
                <Textarea
                  value={p.defaultDescriptionEn}
                  onChange={(e) => set("defaultDescriptionEn", e.target.value)}
                  rows={2}
                  className="resize-none border-gray-200 bg-white text-sm text-gray-900"
                />
              </Field>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Firma</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-44 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                  {p.signatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.signatureDataUrl} alt="Firma" className="max-h-14 max-w-40 object-contain" />
                  ) : (
                    <span className="text-xs text-gray-400">Nessuna firma</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onSignatureFile(e.target.files?.[0])}
                    className="h-8 max-w-64 border-gray-200 bg-white text-xs"
                  />
                  {p.signatureDataUrl ? (
                    <button
                      type="button"
                      className="self-start text-xs text-red-600 hover:underline"
                      onClick={() => set("signatureDataUrl", "")}
                    >
                      Rimuovi firma
                    </button>
                  ) : (
                    <p className="text-[11px] text-gray-400">PNG con sfondo trasparente consigliato.</p>
                  )}
                </div>
              </div>
            </section>

            {err && (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="border-gray-200 text-gray-800"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={pending} className="rounded-full">
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvataggio…
                  </>
                ) : (
                  "Salva profilo"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
