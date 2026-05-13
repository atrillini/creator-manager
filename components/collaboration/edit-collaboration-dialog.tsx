"use client";

import { updateCollaboration } from "@/lib/actions/collaboration-update";
import { COLLAB_STATUS_OPTIONS } from "@/lib/collab-statuses";
import {
  numberToItalianInput,
  parseMoneyLocal,
} from "@/lib/collaboration-form-shared";
import type { CollaborationDetail } from "@/lib/data/collaboration-detail";
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
import { Gift, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import type { BrandOption } from "@/components/collaborazioni/create-collaboration-dialog";

function pickDefaultBrandId(list: BrandOption[], current: string) {
  if (current && list.some((b) => b.id === current)) return current;
  return list[0]?.id ?? "";
}

function formatEur(n: number) {
  if (!Number.isFinite(n) || n < 0) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

type Props = {
  data: CollaborationDetail;
  brands: BrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditCollaborationDialog({
  data,
  brands,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState(data.status);
  const [brief, setBrief] = useState(data.brief_text ?? "");
  const [contractUrl, setContractUrl] = useState(data.contract_url ?? "");
  const [isPeriodic, setIsPeriodic] = useState(data.is_periodic);
  const [contentCount, setContentCount] = useState(data.content_count ?? 1);
  const [feePerContent, setFeePerContent] = useState(
    numberToItalianInput(data.fee_per_content_value)
  );
  const [agreedFee, setAgreedFee] = useState(
    numberToItalianInput(data.agreed_fee_value)
  );
  const [isGiveaway, setIsGiveaway] = useState(data.is_giveaway);
  const [giveawayDetails, setGiveawayDetails] = useState(data.giveaway_details ?? "");
  const [giveawayValue, setGiveawayValue] = useState(
    numberToItalianInput(data.giveaway_value_amount)
  );
  const formId = useId();

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setBrandId(pickDefaultBrandId(brands, data.brand?.id ?? ""));
    setStatus(data.status);
    setBrief(data.brief_text ?? "");
    setContractUrl(data.contract_url ?? "");
    setIsPeriodic(data.is_periodic);
    setContentCount(data.content_count ?? 1);
    setFeePerContent(numberToItalianInput(data.fee_per_content_value));
    setAgreedFee(numberToItalianInput(data.agreed_fee_value));
    setIsGiveaway(data.is_giveaway);
    setGiveawayDetails(data.giveaway_details ?? "");
    setGiveawayValue(numberToItalianInput(data.giveaway_value_amount));
  }, [open, data, brands]);

  const periodicTotal = useMemo(() => {
    if (!isPeriodic) return 0;
    const n = Math.max(1, contentCount);
    const f = parseMoneyLocal(feePerContent);
    if (Number.isNaN(f) || f <= 0) return 0;
    return n * f;
  }, [isPeriodic, contentCount, feePerContent]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setErr("Seleziona un’azienda.");
      return;
    }
    setErr(null);
    start(() => {
      void (async () => {
        const res = await updateCollaboration({
          collaborationId: data.id,
          brandId,
          status,
          briefText: brief,
          contractUrl,
          isPeriodic,
          contentCount: isPeriodic ? contentCount : undefined,
          feePerContent: isPeriodic ? feePerContent : undefined,
          agreedFee: isPeriodic ? "" : agreedFee,
          isGiveaway,
          giveawayDetails: isGiveaway ? giveawayDetails : undefined,
          giveawayValue: isGiveaway ? giveawayValue : undefined,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        onOpenChange(false);
        router.refresh();
      })();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setErr(null);
      }}
    >
      <DialogContent
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
        className="max-h-[min(90vh,880px)] max-w-2xl overflow-y-auto border border-gray-200/80 bg-white text-gray-900"
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-gray-900">Modifica collaborazione</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Aggiorna azienda, compenso e tipo di deal. Gli scadenzari e i deliverable
            continui a gestirli sotto, nella scheda.
          </DialogDescription>
        </DialogHeader>
        {brands.length < 1 ? (
          <p className="text-sm text-gray-500">Nessun brand in anagrafica.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-b`} className="text-gray-700">
                Azienda *
              </Label>
              <Select value={brandId} onValueChange={setBrandId} disabled={pending}>
                <SelectTrigger
                  id={`${formId}-b`}
                  className="w-full border-gray-200 bg-white text-gray-900"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-brief`} className="text-gray-700">
                Titolo / breve *
              </Label>
              <Textarea
                id={`${formId}-brief`}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                required
                minLength={1}
                rows={3}
                className="min-h-[88px] resize-y border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Stato</Label>
              <Select value={status} onValueChange={setStatus} disabled={pending}>
                <SelectTrigger className="border-gray-200 bg-white text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLAB_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-gray-900">
                  Collaborazione periodica (multi-contenuto)
                </p>
                <p className="text-xs text-gray-500">
                  Pacchetto con compenso per pezzo. Le date restano nello scadenzario.
                </p>
              </div>
              <Switch
                checked={isPeriodic}
                onCheckedChange={setIsPeriodic}
                disabled={pending}
                aria-label="Collaborazione periodica"
              />
            </div>

            {!isPeriodic && (
              <div className="space-y-2">
                <Label htmlFor={`${formId}-fee`} className="text-gray-700">
                  {isGiveaway ? "Compenso in denaro (opz.)" : "Compenso totale (opz.)"}
                </Label>
                <Input
                  id={`${formId}-fee`}
                  value={agreedFee}
                  onChange={(e) => setAgreedFee(e.target.value)}
                  inputMode="decimal"
                  placeholder={isGiveaway ? "0 per giveaway puro" : "1200,50"}
                  autoComplete="off"
                  disabled={pending}
                  className="border-gray-200 bg-white text-gray-900"
                />
                {isGiveaway && (
                  <p className="text-xs text-gray-500">
                    Se il deal prevede solo prodotti senza denaro, lascia vuoto.
                  </p>
                )}
              </div>
            )}

            {isPeriodic && (
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-n`} className="text-gray-700">
                      Numero di contenuti *
                    </Label>
                    <Input
                      id={`${formId}-n`}
                      type="number"
                      min={1}
                      max={200}
                      value={contentCount}
                      onChange={(e) => {
                        const v = Math.min(
                          200,
                          Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                        );
                        setContentCount(v);
                      }}
                      disabled={pending}
                      className="rounded-xl border border-gray-200 bg-white text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-fpc`} className="text-gray-700">
                      Compenso per singolo contenuto {isGiveaway ? "(opz.)" : "*"}
                    </Label>
                    <Input
                      id={`${formId}-fpc`}
                      value={feePerContent}
                      onChange={(e) => setFeePerContent(e.target.value)}
                      inputMode="decimal"
                      placeholder={isGiveaway ? "0 per giveaway puro" : ""}
                      disabled={pending}
                      className="rounded-xl border border-gray-200 bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div
                  className="rounded-2xl border border-gray-100 bg-white px-4 py-3"
                  role="status"
                >
                  <p className="text-xs font-medium text-gray-500">Totale contrattuale</p>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">
                    {periodicTotal > 0 ? formatEur(periodicTotal) : "—"}
                  </p>
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Gift className="size-4 text-blue-500" />
                  Giveaway / scambio prodotti
                </p>
                <p className="text-xs text-gray-500">
                  Attiva se il brand ti invia un prodotto o servizio (anche oltre al compenso).
                </p>
              </div>
              <Switch
                checked={isGiveaway}
                onCheckedChange={setIsGiveaway}
                disabled={pending}
                aria-label="Giveaway / scambio prodotti"
              />
            </div>

            {isGiveaway && (
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 sm:p-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-gd`} className="text-gray-700">
                    Cosa ricevi *
                  </Label>
                  <Textarea
                    id={`${formId}-gd`}
                    rows={2}
                    value={giveawayDetails}
                    onChange={(e) => setGiveawayDetails(e.target.value)}
                    placeholder="Es. PS5 Pro + 2 controller DualSense"
                    className="min-h-[72px] resize-y border border-gray-200 bg-white text-gray-900"
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-gv`} className="text-gray-700">
                    Valore stimato € (opz.)
                  </Label>
                  <Input
                    id={`${formId}-gv`}
                    value={giveawayValue}
                    onChange={(e) => setGiveawayValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="700"
                    autoComplete="off"
                    disabled={pending}
                    className="rounded-xl border border-gray-200 bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500">
                    Solo per le tue statistiche personali — non confluisce nelle entrate.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${formId}-u`} className="text-gray-700">
                URL contratto (opz.)
              </Label>
              <Input
                id={`${formId}-u`}
                type="url"
                value={contractUrl}
                onChange={(e) => setContractUrl(e.target.value)}
                disabled={pending}
                className="rounded-xl border border-gray-200 bg-white text-gray-900"
              />
            </div>
            {err && (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={pending || !brandId}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salva…
                  </>
                ) : (
                  "Salva modifiche"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
