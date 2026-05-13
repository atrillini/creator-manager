"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { AIThinkingLoader } from "@/components/ai/ai-thinking-loader";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { BrandOption } from "./create-collaboration-dialog";

type Draft = {
  brandId?: string;
  briefText?: string;
  agreedFee?: string;
  isPeriodic?: boolean;
  contentCount?: number;
  feePerContent?: string;
  isGiveaway?: boolean;
  giveawayDetails?: string;
  giveawayValue?: string;
  plannedDeliverables?: { type: string; publishDate: string }[];
  initialTimelineNote?: string;
  initialPayments?: { amount: string; paidAt: string; note?: string }[];
};

type Props = {
  brands: BrandOption[];
  onDraftReady: (draft: Draft) => void;
};

function pickBrandIdByName(brands: BrandOption[], fromGemini: string): string | undefined {
  const q = fromGemini.trim().toLowerCase();
  if (!q) return undefined;
  const exact = brands.find((b) => b.name.trim().toLowerCase() === q);
  if (exact) return exact.id;
  const partial = brands.find((b) => b.name.trim().toLowerCase().includes(q));
  return partial?.id;
}

function normalizeDeliverableType(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("story")) return "Story";
  if (t.includes("reel") || t.includes("ig")) return "Reel IG";
  if (t.includes("youtube") || t.includes("yt")) return "Video YouTube";
  return null;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?$/i);
  if (!m) return null;
  const day = Number(m[1]);
  const monthName = m[2];
  const year = Number(m[3] ?? new Date().getFullYear());
  const monthMap: Record<string, number> = {
    gen: 1, gennaio: 1,
    feb: 2, febbraio: 2,
    mar: 3, marzo: 3,
    apr: 4, aprile: 4,
    mag: 5, maggio: 5,
    giu: 6, giugno: 6,
    lug: 7, luglio: 7,
    ago: 8, agosto: 8,
    set: 9, settembre: 9,
    ott: 10, ottobre: 10,
    nov: 11, novembre: 11,
    dic: 12, dicembre: 12,
  };
  const month = monthMap[monthName];
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateFromText(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  const direct = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (direct) return direct[1];
  const italian = normalized.match(
    /\b(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/i
  );
  if (!italian) return null;
  return normalizeDate(`${italian[1]} ${italian[2]} ${italian[3] ?? ""}`.trim());
}

function fallbackDeliverablesFromBrief(briefText: string): { type: string; publishDate: string }[] {
  const lower = briefText.toLowerCase();
  const mentionsYouTube = /\b(youtube|yt|video)\b/i.test(lower);
  const mentionsReel = /\b(reel|instagram|ig)\b/i.test(lower);
  const mentionsStory = /\bstory\b/i.test(lower);
  const publishedChunk = lower.match(/pubblicat[oa][^.\n]*/i)?.[0] ?? lower;
  const publishDate = extractDateFromText(publishedChunk) ?? extractDateFromText(lower);
  if (!publishDate) return [];
  if (mentionsYouTube) return [{ type: "Video YouTube", publishDate }];
  if (mentionsReel) return [{ type: "Reel IG", publishDate }];
  if (mentionsStory) return [{ type: "Story", publishDate }];
  return [];
}

function extractPaymentFromBrief(briefText: string): { amount: string; paidAt: string; note?: string } | null {
  const lower = briefText.toLowerCase();
  const paidChunk = lower.match(/(pagament[oa]|pagat[oa]|ricevut[oa])[^.\n]*/i)?.[0] ?? lower;
  const paidAt = extractDateFromText(paidChunk);
  if (!paidAt) return null;
  const amountMatch = briefText.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);
  if (!amountMatch) return null;
  const amount = amountMatch[1].replace(",", ".");
  return { amount, paidAt, note: "Pagamento rilevato automaticamente dal brief" };
}

function buildTimelineNote(briefText: string) {
  const txt = briefText.trim();
  const links = [...txt.matchAll(/((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi)]
    .map((m) => m[1])
    .slice(0, 5);
  const normalizedLinks = links.map((l) => (l.startsWith("http") ? l : `https://${l}`));
  const excerpt = txt.slice(0, 900);
  const linksBlock =
    normalizedLinks.length > 0
      ? `\n\nLink trovati nel brief:\n${normalizedLinks.map((l) => `- ${l}`).join("\n")}`
      : "";
  return `Brief cliente incollato in fase di creazione:\n${excerpt}${linksBlock}`;
}

export function GenerateFromBriefDialog({ brands, onDraftReady }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);

  const analyze = () => {
    setErr(null);
    setPreviewDraft(null);
    setIsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/gemini/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = (await res.json()) as
          | {
              ok: true;
              analysis: {
                brand_name: string;
                agreed_fee: number | null;
                is_giveaway?: boolean;
                giveaway_details?: string | null;
                giveaway_value?: number | null;
                deliverables: { type: string; publish_date: string | null }[];
              };
            }
          | { ok: false; error?: string };
        if (!data.ok) {
          setErr(data.error ?? "Analisi non riuscita");
          return;
        }
        const aiPlanned = data.analysis.deliverables
          .map((d) => ({
            type: normalizeDeliverableType(d.type),
            publishDate: normalizeDate(d.publish_date),
          }))
          .filter((d): d is { type: string; publishDate: string } => !!d.type && !!d.publishDate);
        const fallbackPlanned = aiPlanned.length > 0 ? [] : fallbackDeliverablesFromBrief(text);
        const plannedDeliverables = [...aiPlanned, ...fallbackPlanned];
        const deliverableHint =
          plannedDeliverables.length > 0
            ? `\n\nDeliverables suggeriti:\n${plannedDeliverables
                .map((d) => `- ${d.type} (${d.publishDate})`)
                .join("\n")}`
            : "";
        const inferredPayment = extractPaymentFromBrief(text);
        const draft: Draft = {
          brandId: pickBrandIdByName(brands, data.analysis.brand_name),
          agreedFee:
            data.analysis.agreed_fee == null ? "" : String(data.analysis.agreed_fee),
          isGiveaway: data.analysis.is_giveaway === true,
          giveawayDetails: data.analysis.giveaway_details ?? "",
          giveawayValue:
            data.analysis.giveaway_value == null
              ? ""
              : String(data.analysis.giveaway_value),
          briefText: `Brand: ${data.analysis.brand_name}${deliverableHint}`,
          plannedDeliverables,
          initialTimelineNote: buildTimelineNote(text),
          initialPayments: inferredPayment ? [inferredPayment] : [],
        };
        if (data.analysis.deliverables.length > 1) {
          draft.isPeriodic = true;
          draft.contentCount = data.analysis.deliverables.length;
          if (data.analysis.agreed_fee && data.analysis.agreed_fee > 0) {
            const feePc = data.analysis.agreed_fee / data.analysis.deliverables.length;
            draft.feePerContent = String(Math.round(feePc * 100) / 100);
          }
        }
        setPreviewDraft(draft);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setErr(null);
          setPreviewDraft(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-1">
          <Sparkles className="size-4" />
          Genera da Brief
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border border-white/60 bg-white/80 text-gray-900 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Genera collaborazione da brief</DialogTitle>
          <DialogDescription className="text-gray-600">
            Incolla l’email o il brief cliente. Gemini estrarrà brand, compenso e deliverable.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Incolla qui il brief/email..."
          className="min-h-[260px] resize-y border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
          disabled={isLoading}
        />
        {isLoading ? (
          <div className="rounded-xl bg-gray-50/90 px-3 py-2">
            <AIThinkingLoader label="Gemini sta leggendo il brief..." />
          </div>
        ) : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        {previewDraft ? (
          <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50/90 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Anteprima creazione
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-white px-2 py-1 text-gray-700">
                Deliverable: {previewDraft.plannedDeliverables?.length ?? 0}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-gray-700">
                Pagamenti: {previewDraft.initialPayments?.length ?? 0}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-gray-700">
                Fee: {previewDraft.agreedFee || "—"}
              </span>
              {previewDraft.isGiveaway ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  🎁 Giveaway
                  {previewDraft.giveawayValue
                    ? ` · ${previewDraft.giveawayValue}€`
                    : ""}
                </span>
              ) : null}
            </div>
            {previewDraft.isGiveaway && previewDraft.giveawayDetails ? (
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Cosa ricevi:</span>{" "}
                {previewDraft.giveawayDetails}
              </p>
            ) : null}
            {(previewDraft.plannedDeliverables?.length ?? 0) > 0 ? (
              <ul className="space-y-1 text-xs text-gray-600">
                {previewDraft.plannedDeliverables?.map((d, i) => (
                  <li key={`${d.type}-${d.publishDate}-${i}`} className="rounded-lg bg-white px-2 py-1">
                    {d.type} · {d.publishDate}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Nessun deliverable datato rilevato.</p>
            )}
            {(previewDraft.initialPayments?.length ?? 0) > 0 ? (
              <ul className="space-y-1 text-xs text-gray-600">
                {previewDraft.initialPayments?.map((p, i) => (
                  <li key={`${p.paidAt}-${p.amount}-${i}`} className="rounded-lg bg-white px-2 py-1">
                    Pagamento {p.amount}€ · {p.paidAt}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button type="button" onClick={analyze} disabled={isLoading || text.trim().length < 8}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analisi...
              </>
            ) : (
              "Analizza"
            )}
          </Button>
          <Button
            type="button"
            disabled={!previewDraft || isLoading}
            onClick={() => {
              if (!previewDraft) return;
              setOpen(false);
              onDraftReady(previewDraft);
            }}
          >
            Usa nel form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
