"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Building2, CornerUpLeft, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addInboxThreadTag, updateInboxThreads } from "@/lib/actions/inbox";
import type { InboxTag, InboxThreadListItem } from "@/lib/data/inbox";
import { INBOX_CATEGORY_META, INBOX_STATUS_META, type InboxStatus } from "@/lib/inbox/constants";
import { inboxHref, type InboxParams } from "@/lib/inbox/url";
import { cn } from "@/lib/utils";

type Props = {
  items: InboxThreadListItem[];
  params: InboxParams;
  selectedId: string | null;
  tags: InboxTag[];
  searching: boolean;
};

export function formatInboxDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "2-digit" }) });
}

const BULK_STATUSES: InboxStatus[] = ["da_rispondere", "gestita", "archiviata"];

export function InboxThreadList({ items, params, selectedId, tags, searching }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      setBulkTag("");
      router.refresh();
    });
  };

  if (!items.length) {
    return (
      <div className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-gray-400 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        {searching ? "Nessuna conversazione trovata." : "Niente da mostrare qui."}
      </div>
    );
  }

  const ids = [...selected];

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      {ids.length > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs">
          <span className="font-medium text-gray-700">{ids.length} selezionate</span>
          {BULK_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant="outline"
              className="h-6 rounded-full border-gray-200 px-2 text-[11px]"
              disabled={pending}
              onClick={() => runBulk(() => updateInboxThreads({ ids, status: s }))}
            >
              {INBOX_STATUS_META[s].label}
            </Button>
          ))}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (bulkTag.trim()) runBulk(() => addInboxThreadTag({ threadIds: ids, name: bulkTag }));
            }}
          >
            <Input
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              list="inbox-bulk-tags"
              placeholder="+ tag"
              className="h-6 w-24 rounded-full border-gray-200 bg-white px-2 text-[11px]"
            />
            <datalist id="inbox-bulk-tags">
              {tags.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </form>
          {pending ? <Loader2 className="size-3.5 animate-spin text-gray-400" /> : null}
          <button type="button" className="ml-auto text-gray-500 hover:text-gray-900" onClick={() => setSelected(new Set())}>
            Annulla
          </button>
          {error ? <p className="w-full text-red-600">{error}</p> : null}
        </div>
      ) : null}
      <ul className="divide-y divide-gray-50">
        {items.map((t) => {
          const active = t.id === selectedId;
          return (
            <li key={t.id} className={cn("group relative flex gap-2 px-3 py-2.5", active ? "bg-blue-50/60" : "hover:bg-gray-50/80")}>
              <input
                type="checkbox"
                aria-label={`Seleziona ${t.subject}`}
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                className={cn(
                  "mt-1 size-3.5 shrink-0 accent-gray-900",
                  selected.size === 0 && "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
              />
              <Link href={inboxHref(params, { t: t.id })} className="min-w-0 flex-1" scroll={false}>
                <div className="flex items-center gap-1.5">
                  {t.status === "nuova" ? <span className="size-2 shrink-0 rounded-full bg-blue-500" aria-label="Nuova" /> : null}
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      t.status === "nuova" ? "font-semibold text-gray-900" : "text-gray-700",
                      t.quality === "bassa" && "text-gray-400"
                    )}
                  >
                    {t.lastDirection === "out" ? <CornerUpLeft className="mr-1 inline size-3 text-gray-400" /> : null}
                    {t.lastFrom}
                    {t.messageCount > 1 ? <span className="ml-1 text-xs font-normal text-gray-400">{t.messageCount}</span> : null}
                  </p>
                  {t.isUrgent ? <AlertCircle className="size-3.5 shrink-0 text-red-500" aria-label="Urgente" /> : null}
                  <span className="shrink-0 text-[11px] text-gray-400">{formatInboxDate(t.lastMessageAt)}</span>
                </div>
                <p className={cn("truncate text-[13px]", t.status === "nuova" ? "font-medium text-gray-900" : "text-gray-700")}>
                  {t.subject}
                </p>
                <p className="line-clamp-2 text-xs text-gray-500">
                  {t.summary ? <Sparkles className="mr-1 inline size-3 text-violet-400" /> : null}
                  {t.summary ?? t.preview}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {t.status !== "nuova" ? (
                    <span className={cn("rounded-full px-1.5 py-px text-[10px]", INBOX_STATUS_META[t.status].className)}>
                      {INBOX_STATUS_META[t.status].label}
                    </span>
                  ) : null}
                  {t.category ? (
                    <span className={cn("rounded-full px-1.5 py-px text-[10px]", INBOX_CATEGORY_META[t.category].className)}>
                      {INBOX_CATEGORY_META[t.category].label}
                    </span>
                  ) : t.aiStatus === "pending" ? (
                    <span className="rounded-full bg-gray-50 px-1.5 py-px text-[10px] text-gray-400">In analisi…</span>
                  ) : null}
                  {t.brand ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-px text-[10px] text-gray-700">
                      <Building2 className="size-2.5" />
                      {t.brand.name}
                    </span>
                  ) : null}
                  {t.collaboration ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] text-emerald-700">
                      <Link2 className="size-2.5" />
                      Collegata
                    </span>
                  ) : null}
                  {t.tags.map((tag) => (
                    <span key={tag.id} className="text-[10px] text-gray-400">
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
