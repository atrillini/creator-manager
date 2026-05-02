"use client";

import { createCollaboration } from "@/lib/actions/collaboration-create";
import { COLLAB_STATUS_OPTIONS } from "@/lib/collab-statuses";
import {
  isDeliverableType,
  isValidDateKey,
  parseMoneyLocal,
} from "@/lib/collaboration-form-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

export type BrandOption = { id: string; name: string };

type Props = {
  brands: BrandOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  initialDraft?: {
    brandId?: string;
    briefText?: string;
    agreedFee?: string;
    isPeriodic?: boolean;
    contentCount?: number;
    feePerContent?: string;
    plannedDeliverables?: { type: string; publishDate: string }[];
    initialTimelineNote?: string;
    initialPayments?: { amount: string; paidAt: string; note?: string }[];
  } | null;
};

function pickDefaultBrandId(
  list: BrandOption[],
  current: string
): string {
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

export function CreateCollaborationDialog({
  brands,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  initialDraft,
}: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState("proposta");
  const [brandId, setBrandId] = useState(pickDefaultBrandId(brands, ""));
  const [isPeriodic, setIsPeriodic] = useState(false);
  const [contentCount, setContentCount] = useState(1);
  const [feePerContent, setFeePerContent] = useState("");
  const [agreedFee, setAgreedFee] = useState("");
  const [briefText, setBriefText] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [plannedDeliverables, setPlannedDeliverables] = useState<
    { type: string; publishDate: string }[]
  >([]);
  const [initialTimelineNote, setInitialTimelineNote] = useState<string>("");
  const [initialPayments, setInitialPayments] = useState<
    { amount: string; paidAt: string; note?: string }[]
  >([]);
  const briefId = useId();
  const open = controlledOpen ?? internalOpen;

  useEffect(() => {
    setBrandId((cur) => pickDefaultBrandId(brands, cur));
  }, [brands]);

  useEffect(() => {
    if (!open) return;
    if (!initialDraft) {
      setInitialTimelineNote("");
      setInitialPayments([]);
      return;
    }
    if (initialDraft.brandId && brands.some((b) => b.id === initialDraft.brandId)) {
      setBrandId(initialDraft.brandId);
    }
    if (initialDraft.briefText != null) setBriefText(initialDraft.briefText);
    if (initialDraft.agreedFee != null) setAgreedFee(initialDraft.agreedFee);
    if (initialDraft.isPeriodic != null) setIsPeriodic(initialDraft.isPeriodic);
    if (initialDraft.contentCount != null) setContentCount(initialDraft.contentCount);
    if (initialDraft.feePerContent != null) setFeePerContent(initialDraft.feePerContent);
    if (initialDraft.plannedDeliverables) {
      setPlannedDeliverables(initialDraft.plannedDeliverables);
    }
    if (initialDraft.initialTimelineNote != null) {
      setInitialTimelineNote(initialDraft.initialTimelineNote);
    }
    if (initialDraft.initialPayments) {
      setInitialPayments(initialDraft.initialPayments);
    }
  }, [open, initialDraft, brands]);

  function setOpenSafe(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  const periodicTotal = useMemo(() => {
    if (!isPeriodic) return 0;
    const n = Math.max(1, contentCount);
    const f = parseMoneyLocal(feePerContent);
    if (Number.isNaN(f) || f <= 0) return 0;
    return n * f;
  }, [isPeriodic, contentCount, feePerContent]);

  function onPeriodicSwitch(checked: boolean) {
    setIsPeriodic(checked);
    if (checked) {
      setContentCount(1);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const brief = briefText;
    if (!brandId) {
      setErr("Seleziona un’azienda oppure aggiungine una in Aziende.");
      return;
    }
    const agreedFeeField = agreedFee;

    start(() => {
      void (async () => {
        const res = await createCollaboration({
          brandId,
          status,
          briefText: brief,
          contractUrl,
          isPeriodic,
          agreedFee: isPeriodic ? "" : agreedFeeField,
          contentCount: isPeriodic ? contentCount : undefined,
          feePerContent: isPeriodic ? feePerContent : undefined,
          plannedDeliverables: plannedDeliverables
            .filter((d) => isValidDateKey(d.publishDate) && isDeliverableType(d.type)),
          initialTimelineNote,
          initialPayments,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setOpenSafe(false);
        setStatus("proposta");
        setIsPeriodic(false);
        setContentCount(1);
        setFeePerContent("");
        setAgreedFee("");
        setBriefText("");
        setContractUrl("");
        setPlannedDeliverables([]);
        setInitialTimelineNote("");
        setInitialPayments([]);
        setBrandId(pickDefaultBrandId(brands, ""));
        router.refresh();
      })();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpenSafe(o);
        if (o) setErr(null);
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" size="sm" className="gap-1">
            <Plus className="size-4" />
            Nuova collaborazione
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
        className="max-h-[min(90vh,880px)] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Nuova collaborazione</DialogTitle>
          <DialogDescription>
            {brands.length < 1
              ? "Devi avere almeno un’azienda in anagrafica per creare un deal."
              : "Con un pacchetto periodico, aggiungi le date di pubblicazione dallo scadenzario della scheda."}
          </DialogDescription>
        </DialogHeader>
        {brands.length < 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vai a{" "}
              <Link href="/aziende" className="font-medium text-primary hover:underline">
                Aziende
              </Link>{" "}
              e aggiungi un brand, poi riapri questa finestra.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenSafe(false)}>
                Chiudi
              </Button>
              <Button asChild>
                <Link href="/aziende">Apri Aziende</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Azienda *</Label>
              <Select
                value={brandId}
                onValueChange={setBrandId}
                required
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona" />
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
              <Label htmlFor={briefId}>Titolo / breve *</Label>
              <Textarea
                id={briefId}
                name="briefText"
                required
                minLength={1}
                rows={3}
                placeholder="Es. Pacchetto 10 Reel 2026"
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                className="min-h-[88px] resize-y"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label>Stato iniziale</Label>
              <Select value={status} onValueChange={setStatus} disabled={pending}>
                <SelectTrigger>
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
                "flex items-center justify-between gap-3 rounded-2xl border-0 bg-gray-100/60 px-4 py-3"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-gray-900">
                  Collaborazione periodica (multi-contenuto)
                </p>
                <p className="text-xs text-gray-500">
                  Pacchetto: indica quanti contenuti e compenso per uscita; le date si
                  impostano dopo nella scheda.
                </p>
              </div>
              <Switch
                checked={isPeriodic}
                onCheckedChange={onPeriodicSwitch}
                disabled={pending}
                aria-label="Collaborazione periodica (multi-contenuto)"
              />
            </div>

            {!isPeriodic && (
              <div className="space-y-2">
                <Label htmlFor="fee">Compenso totale (opz.)</Label>
                <Input
                  id="fee"
                  name="agreedFee"
                  type="text"
                  value={agreedFee}
                  onChange={(e) => setAgreedFee(e.target.value)}
                  inputMode="decimal"
                  placeholder="1200,50"
                  autoComplete="off"
                  disabled={pending}
                />
              </div>
            )}

            {isPeriodic && (
              <div className="space-y-3 rounded-2xl bg-white/50 p-3 sm:p-4">
                <p className="text-sm text-gray-600">
                  Dopo la creazione apri la collaborazione e, nello <strong>Scadenzario
                  contenuti</strong>, aggiungi data e tipo per ciascuna uscita (o tutte in
                  un secondo momento).
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="content-c">Numero di contenuti *</Label>
                    <Input
                      id="content-c"
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
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee-pc">Compenso per singolo contenuto *</Label>
                    <Input
                      id="fee-pc"
                      type="text"
                      inputMode="decimal"
                      placeholder="200"
                      value={feePerContent}
                      onChange={(e) => setFeePerContent(e.target.value)}
                      autoComplete="off"
                      disabled={pending}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div
                  className="rounded-2xl border-0 bg-gray-50/90 px-4 py-3"
                  role="status"
                >
                  <p className="text-xs font-medium text-gray-500">Totale contrattuale</p>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">
                    {formatEur(periodicTotal)}
                  </p>
                </div>
              </div>
            )}

            {plannedDeliverables.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-gray-50/80 p-3">
                <p className="text-xs font-medium text-gray-500">
                  Scadenze precompilate dal brief ({plannedDeliverables.length})
                </p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {plannedDeliverables.map((d, i) => (
                    <li key={`${d.type}-${d.publishDate}-${i}`} className="rounded-lg bg-white px-2 py-1">
                      {d.type} · {d.publishDate}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="curl">URL contratto (opz.)</Label>
              <Input
                id="curl"
                name="contractUrl"
                type="url"
                placeholder="https://…"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                disabled={pending}
                className="rounded-xl"
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
                onClick={() => setOpenSafe(false)}
                disabled={pending}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={pending || !brandId}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creazione…
                  </>
                ) : (
                  "Crea"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
