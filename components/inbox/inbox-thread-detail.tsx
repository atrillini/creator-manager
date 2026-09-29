"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  Gift,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Unlink,
  X,
} from "lucide-react";
import { CreateCollaborationDialog } from "@/components/collaborazioni/create-collaboration-dialog";
import { renderTextWithLinks } from "@/components/linkified-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addInboxThreadTag,
  reanalyzeInboxThread,
  removeInboxThreadTag,
  updateInboxThreads,
} from "@/lib/actions/inbox";
import { DELIV_TYPES, isValidDateKey } from "@/lib/collaboration-form-shared";
import type { CollaborationOption } from "@/lib/data/fetchers";
import type { InboxMessage, InboxThreadDetail } from "@/lib/data/inbox";
import { formatEur } from "@/lib/format";
import {
  INBOX_CATEGORIES,
  INBOX_CATEGORY_META,
  INBOX_QUALITY_LABELS,
  INBOX_STATUSES,
  INBOX_STATUS_META,
} from "@/lib/inbox/constants";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Props = {
  thread: InboxThreadDetail;
  brands: { id: string; name: string }[];
  collaborations: CollaborationOption[];
};

type Draft = NonNullable<Parameters<typeof CreateCollaborationDialog>[0]["initialDraft"]>;

/** Bozza per "Crea collaborazione" dai dati già estratti dall'AI (nessuna nuova chiamata). */
function draftFromThread(thread: InboxThreadDetail): Draft {
  const ins = thread.insights;
  const planned: { type: string; publishDate: string }[] = [];
  let contentCount = 0;
  for (const d of ins?.deliverables ?? []) {
    const qty = Math.max(1, Math.min(20, Number(d.quantity) || 1));
    contentCount += qty;
    if ((DELIV_TYPES as readonly string[]).includes(d.type) && d.publish_date && isValidDateKey(d.publish_date)) {
      for (let i = 0; i < qty; i++) planned.push({ type: d.type, publishDate: d.publish_date });
    }
  }
  const fee = ins?.proposed_fee ?? null;
  const draft: Draft = {
    brandId: thread.brand?.id ?? ins?.brand_match_id ?? undefined,
    briefText: thread.subject,
    agreedFee: fee != null ? String(fee) : "",
    isGiveaway: ins?.is_giveaway === true,
    giveawayDetails: ins?.giveaway_details ?? "",
    giveawayValue: ins?.giveaway_value != null ? String(ins.giveaway_value) : "",
    plannedDeliverables: planned,
    initialTimelineNote: [
      `Collaborazione nata dall'email «${thread.subject}»`,
      thread.participants.length ? `Contatti: ${thread.participants.join(", ")}` : null,
      ins?.summary ? `Riassunto: ${ins.summary}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
  if (contentCount > 1) {
    draft.isPeriodic = true;
    draft.contentCount = contentCount;
    if (fee && fee > 0) draft.feePerContent = String(Math.round((fee / contentCount) * 100) / 100);
  }
  return draft;
}

function MessageCard({ m, defaultOpen }: { m: InboxMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showHtml, setShowHtml] = useState(false);
  const [images, setImages] = useState(false);
  const when = new Date(m.receivedAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className={cn("rounded-2xl border", m.direction === "out" ? "border-blue-100 bg-blue-50/40" : "border-gray-100 bg-white")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">
            {m.from}
            {m.fromEmail && m.direction === "in" ? <span className="ml-1 font-normal text-gray-400">&lt;{m.fromEmail}&gt;</span> : null}
          </span>
          {m.fromSpam ? (
            <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
              Arrivata nello Spam
            </span>
          ) : null}
          {!open ? <span className="block truncate text-xs text-gray-500">{m.bodyText.slice(0, 140)}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
          {m.attachments.length ? <Paperclip className="size-3" /> : null}
          {when}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <div className="border-t border-gray-100/80 px-4 py-3">
          {m.to.length ? <p className="mb-2 break-all text-[11px] text-gray-400">A: {m.to.join(", ")}</p> : null}
          {showHtml ? (
            <>
              <iframe
                title={`Email ${m.subject}`}
                src={`/api/inbox/messages/${m.id}/html${images ? "?images=1" : ""}`}
                sandbox=""
                className="h-[28rem] w-full rounded-xl border border-gray-100 bg-white"
              />
              {!images ? (
                <button type="button" onClick={() => setImages(true)} className="mt-1 text-[11px] text-blue-600 hover:underline">
                  Carica immagini esterne
                </button>
              ) : null}
            </>
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
              {renderTextWithLinks(m.bodyText)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {m.attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600" title="Il file resta nella casella iCloud">
                <Paperclip className="size-3" />
                {a.filename}
              </span>
            ))}
            {m.hasHtml ? (
              <button type="button" onClick={() => setShowHtml((v) => !v)} className="ml-auto text-[11px] text-gray-500 hover:text-gray-900">
                {showHtml ? "Mostra testo" : "Mostra originale"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function InboxThreadDetailView({ thread, brands, collaborations }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [analyzing, startAnalyze] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const ins = thread.insights;
  const draft = useMemo(() => draftFromThread(thread), [thread]);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };
  const update = (patch: Omit<Parameters<typeof updateInboxThreads>[0], "ids">) =>
    run(() => updateInboxThreads({ ids: [thread.id], ...patch }));

  const suggestedCollab = ins?.collaboration_match_id
    ? collaborations.find((c) => c.id === ins.collaboration_match_id)
    : undefined;
  const brandSuggestionMissing = !thread.brand && ins?.brand_name && !ins.brand_match_id;

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold leading-snug text-gray-900">{thread.subject}</h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {thread.participants.join(", ") || thread.lastFrom} · {thread.messageCount} messagg
              {thread.messageCount === 1 ? "io" : "i"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin text-gray-400" /> : null}
            {thread.status === "nuova" || thread.status === "da_rispondere" || thread.status === "in_attesa" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 rounded-full border-gray-200 px-2.5 text-xs"
                disabled={pending}
                onClick={() => update({ status: "gestita" })}
              >
                <Check className="size-3.5" />
                Segna gestita
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Stato
            <Select value={thread.status} onValueChange={(v) => update({ status: v })} disabled={pending}>
              <SelectTrigger className="h-8 border-gray-200 bg-white text-xs normal-case tracking-normal text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INBOX_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {INBOX_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Categoria
            <Select
              value={thread.category ?? NONE}
              onValueChange={(v) => update({ category: v === NONE ? null : v })}
              disabled={pending}
            >
              <SelectTrigger className="h-8 border-gray-200 bg-white text-xs normal-case tracking-normal text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Da classificare</SelectItem>
                {INBOX_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {INBOX_CATEGORY_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Brand
            <Select
              value={thread.brand?.id ?? NONE}
              onValueChange={(v) => update({ brandId: v === NONE ? null : v })}
              disabled={pending}
            >
              <SelectTrigger className="h-8 border-gray-200 bg-white text-xs normal-case tracking-normal text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nessun brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brandSuggestionMissing ? (
              <span className="block text-[11px] font-normal normal-case tracking-normal text-gray-500">
                L&apos;AI indica «{ins?.brand_name}», non ancora in anagrafica.{" "}
                <Link href="/aziende" className="text-blue-600 hover:underline">
                  Aggiungi azienda
                </Link>
              </span>
            ) : null}
          </label>
          <div className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Collaborazione
            {thread.collaboration ? (
              <div className="flex h-8 items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/60 px-2 text-xs normal-case tracking-normal">
                <Link href={`/collaborations/${thread.collaboration.id}`} className="truncate font-medium text-emerald-800 hover:underline">
                  {thread.collaboration.title}
                </Link>
                <button
                  type="button"
                  title="Scollega"
                  className="text-emerald-700 hover:text-emerald-900"
                  onClick={() => update({ collaborationId: null })}
                  disabled={pending}
                >
                  <Unlink className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Select value={NONE} onValueChange={(v) => v !== NONE && update({ collaborationId: v })} disabled={pending}>
                  <SelectTrigger className="h-8 min-w-0 flex-1 border-gray-200 bg-white text-xs normal-case tracking-normal text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Collega a esistente…</SelectItem>
                    {suggestedCollab ? (
                      <SelectItem value={suggestedCollab.id}>✦ {suggestedCollab.label}</SelectItem>
                    ) : null}
                    {collaborations
                      .filter((c) => c.id !== suggestedCollab?.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 rounded-md px-2 text-xs normal-case tracking-normal"
                  onClick={() => setCreateOpen(true)}
                  disabled={pending || brands.length === 0}
                  title={brands.length === 0 ? "Crea prima un'azienda" : "Crea collaborazione con i dati estratti"}
                >
                  <Plus className="size-3.5" />
                  Crea
                </Button>
              </div>
            )}
            {suggestedCollab && !thread.collaboration ? (
              <button
                type="button"
                className="block text-left text-[11px] font-normal normal-case tracking-normal text-blue-600 hover:underline"
                onClick={() => update({ collaborationId: suggestedCollab.id })}
                disabled={pending}
              >
                Suggerita: {suggestedCollab.label}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {thread.tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
              #{t.name}
              <button
                type="button"
                aria-label={`Rimuovi tag ${t.name}`}
                className="text-gray-400 hover:text-gray-700"
                onClick={() => run(() => removeInboxThreadTag({ threadId: thread.id, tagId: t.id }))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = tagInput.trim();
              if (!name) return;
              setTagInput("");
              run(() => addInboxThreadTag({ threadIds: [thread.id], name }));
            }}
          >
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="+ tag"
              className="h-6 w-24 rounded-full border-gray-200 px-2 text-[11px]"
            />
          </form>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
            <Sparkles className="size-3.5" />
            Analisi AI
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-violet-700 hover:bg-violet-100"
            disabled={analyzing}
            onClick={() => {
              setError(null);
              startAnalyze(async () => {
                const res = await reanalyzeInboxThread(thread.id);
                if (!res.ok) setError(res.error);
                else router.refresh();
              });
            }}
          >
            {analyzing ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {ins ? "Rianalizza" : "Analizza ora"}
          </Button>
        </div>
        {thread.aiStatus === "error" && thread.aiError ? (
          <p className="mt-2 text-xs text-red-600">Analisi non riuscita: {thread.aiError}</p>
        ) : null}
        {ins ? (
          <div className="mt-2 space-y-2 text-sm text-gray-800">
            <p>{ins.summary}</p>
            {ins.next_action ? (
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-800">Prossima azione:</span> {ins.next_action}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {ins.proposed_fee != null ? (
                <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-800 ring-1 ring-gray-100">
                  {formatEur(ins.proposed_fee)}
                </span>
              ) : null}
              {ins.deliverables.map((d, i) => (
                <span key={i} className="rounded-full bg-white px-2 py-0.5 text-gray-700 ring-1 ring-gray-100">
                  {d.quantity > 1 ? `${d.quantity}× ` : ""}
                  {d.type}
                  {d.publish_date ? ` · ${d.publish_date}` : ""}
                </span>
              ))}
              {ins.deadline ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-gray-700 ring-1 ring-gray-100">
                  <CalendarClock className="size-3" />
                  {ins.deadline}
                </span>
              ) : null}
              {ins.is_giveaway ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-pink-700">
                  <Gift className="size-3" />
                  {ins.giveaway_details ?? "Gifting"}
                  {ins.giveaway_value ? ` · ${formatEur(ins.giveaway_value)}` : ""}
                </span>
              ) : null}
              {ins.is_agency ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  <Briefcase className="size-3" />
                  {ins.agency_name ? `Agenzia: ${ins.agency_name}` : "Tramite agenzia"}
                </span>
              ) : null}
              {thread.isUrgent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                  <AlertCircle className="size-3" />
                  Urgente
                </span>
              ) : null}
              {thread.quality ? (
                <span className="rounded-full bg-gray-50 px-2 py-0.5 text-gray-500">{INBOX_QUALITY_LABELS[thread.quality]}</span>
              ) : null}
            </div>
            {ins.contact_name || ins.contact_email ? (
              <p className="text-xs text-gray-500">
                Referente: {[ins.contact_name, ins.contact_role, ins.contact_email].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : thread.aiStatus === "pending" ? (
          <p className="mt-2 text-xs text-gray-500">In coda per l&apos;analisi (entro il prossimo giro di sync).</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {thread.messages.map((m, i) => (
          <MessageCard key={m.id} m={m} defaultOpen={i === thread.messages.length - 1} />
        ))}
        {thread.collaboration ? (
          <Link
            href={`/collaborations/${thread.collaboration.id}`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
          >
            <ExternalLink className="size-3" />
            Apri la collaborazione
          </Link>
        ) : null}
      </div>

      <CreateCollaborationDialog
        brands={brands}
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDraft={draft}
        hideTrigger
        linkEmailThreadId={thread.id}
        onCreated={(id) => router.push(`/collaborations/${id}`)}
      />
    </div>
  );
}
