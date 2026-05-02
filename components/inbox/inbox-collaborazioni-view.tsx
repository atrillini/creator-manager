"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIThinkingLoader } from "@/components/ai/ai-thinking-loader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreateCollaborationDialog,
  type BrandOption,
} from "@/components/collaborazioni/create-collaboration-dialog";

type Tag = { id: string; name: string; color: string | null };

type InboxMessageMeta = {
  id: string;
  externalMessageId: string;
  threadKey: string;
  from: string;
  fromEmail: string | null;
  to: string[];
  subject: string;
  date: string;
  preview: string;
  hasBody: boolean;
  tags: Tag[];
};

type InboxThreadRow = {
  threadKey: string;
  latestMessage: {
    id: string;
    externalMessageId: string;
    from: string;
    fromEmail: string | null;
    subject: string;
    preview: string;
    date: string;
    hasBody: boolean;
  };
  messageCount: number;
  tags: Tag[];
};

type AnalyzeResponse =
  | {
      ok: true;
      analysis: {
        brand_name: string;
        agreed_fee: number | null;
        deliverables: { type: string; publish_date: string | null }[];
      };
    }
  | { ok: false; error?: string };

type Draft = {
  brandId?: string;
  briefText?: string;
  agreedFee?: string;
  isPeriodic?: boolean;
  contentCount?: number;
  feePerContent?: string;
  plannedDeliverables?: { type: string; publishDate: string }[];
  initialTimelineNote?: string;
};

type Props = {
  brands: BrandOption[];
};

const THREAD_CACHE_TTL_MS = 5 * 60 * 1000;
const BODY_CACHE_TTL_MS = 30 * 60 * 1000;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

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
  return null;
}

function compactUrl(raw: string) {
  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(normalized);
    const clean = `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
    return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  } catch {
    return raw.length > 90 ? `${raw.slice(0, 87)}...` : raw;
  }
}

function normalizeBodyText(input: string) {
  const noMarkdownLinks = input.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_m, label: string, url: string) => {
      const cleanUrl = compactUrl(url);
      if (/^https?:\/\//i.test(label.trim())) return cleanUrl;
      return `${label.trim()} (${cleanUrl})`;
    }
  );
  const cleanedUrls = noMarkdownLinks.replace(/https?:\/\/[^\s<>"')\]]+/gi, (u) => compactUrl(u));
  return cleanedUrls
    .replace(/\[\s*([^\]]+)\s*\]/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatHtmlFallback(html: string) {
  return normalizeBodyText(
    html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  );
}

function mergeThreadsByKey(
  prev: InboxThreadRow[],
  incoming: InboxThreadRow[]
): InboxThreadRow[] {
  if (!incoming.length) return prev;
  const map = new Map<string, InboxThreadRow>();
  for (const t of prev) map.set(t.threadKey, t);
  for (const t of incoming) {
    const existing = map.get(t.threadKey);
    if (!existing) {
      map.set(t.threadKey, t);
      continue;
    }
    // Keep the newest summary for the same thread key
    const existingTs = new Date(existing.latestMessage.date).getTime();
    const nextTs = new Date(t.latestMessage.date).getTime();
    if (nextTs >= existingTs) {
      map.set(t.threadKey, t);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(b.latestMessage.date).getTime() -
      new Date(a.latestMessage.date).getTime()
  );
}

export function InboxCollaborazioniView({ brands }: Props) {
  const [threads, setThreads] = useState<InboxThreadRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [threadMessagesByKey, setThreadMessagesByKey] = useState<Record<string, InboxMessageMeta[]>>({});
  const [messageBodyById, setMessageBodyById] = useState<Record<string, { text: string; html: string | null }>>({});
  const [threadFetchedAtByKey, setThreadFetchedAtByKey] = useState<Record<string, number>>({});
  const [messageBodyFetchedAtById, setMessageBodyFetchedAtById] = useState<Record<string, number>>({});
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [loadingAiById, setLoadingAiById] = useState<Record<string, boolean>>({});
  const [loadingThreadByKey, setLoadingThreadByKey] = useState<Record<string, boolean>>({});
  const [loadingBodyById, setLoadingBodyById] = useState<Record<string, boolean>>({});
  const [tagBusyById, setTagBusyById] = useState<Record<string, boolean>>({});
  const [tagInputById, setTagInputById] = useState<Record<string, string>>({});
  const [tagSuggestionsById, setTagSuggestionsById] = useState<Record<string, { id: string; name: string }[]>>({});
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [sinceDays, setSinceDays] = useState(14);
  const [lastSyncedDays, setLastSyncedDays] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [initialDraft, setInitialDraft] = useState<Draft | null>(null);
  const suggestTimers = useRef<Record<string, number>>({});
  const searchTimer = useRef<number | null>(null);

  function isFresh(ts: number | undefined, ttlMs: number) {
    if (!ts) return false;
    return Date.now() - ts < ttlMs;
  }

  const fetchInbox = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      const reset = opts?.reset ?? true;
      const cursor = opts?.cursor;
      if (reset) setLoadingInbox(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const beforePart = !reset && cursor ? `&before=${encodeURIComponent(cursor)}` : "";
        const qPart = searchQuery.trim() ? `&q=${encodeURIComponent(searchQuery.trim())}` : "";
        const res = await fetch(`/api/emails/inbox?sinceDays=${sinceDays}&limit=30${beforePart}${qPart}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as
          | { ok: true; threads: InboxThreadRow[]; meta: { hasMore: boolean; nextCursor: string | null } }
          | { ok: false; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.ok ? "Errore caricamento inbox" : data.error ?? "Errore caricamento inbox");
        }
        setThreads((prev) =>
          reset ? mergeThreadsByKey([], data.threads) : mergeThreadsByKey(prev, data.threads)
        );
        setHasMore(Boolean(data.meta?.hasMore));
        setNextCursor(data.meta?.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore caricamento inbox");
      } finally {
        if (reset) setLoadingInbox(false);
        else setLoadingMore(false);
      }
    },
    [sinceDays, searchQuery]
  );

  useEffect(() => {
    void fetchInbox({ reset: true });
  }, [fetchInbox]);

  useEffect(() => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const availableTagFilters = useMemo(() => {
    const tagMap = new Map<string, string>();
    for (const thread of threads) {
      for (const tag of thread.tags) tagMap.set(tag.id, tag.name);
    }
    return [...tagMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    if (activeTagFilter === "all") return threads;
    return threads.filter((thread) => thread.tags.some((tag) => tag.id === activeTagFilter));
  }, [threads, activeTagFilter]);

  const runManualSync = async (daysOverride?: number) => {
    if (syncingInbox) return;
    setSyncingInbox(true);
    setError(null);
    const days = daysOverride ?? sinceDays;
    try {
      const res = await fetch("/api/emails/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinceDays: days }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Errore sincronizzazione");
      }
      const readRes = await fetch(`/api/emails/inbox?sinceDays=${days}&limit=30`, {
        cache: "no-store",
      });
      const readData = (await readRes.json()) as
        | { ok: true; threads: InboxThreadRow[]; meta: { hasMore: boolean; nextCursor: string | null } }
        | { ok: false; error?: string };
      if (!readRes.ok || !readData.ok) {
        throw new Error(readData.ok ? "Errore refresh inbox" : readData.error ?? "Errore refresh inbox");
      }
      setThreads(mergeThreadsByKey([], readData.threads));
      setHasMore(Boolean(readData.meta?.hasMore));
      setNextCursor(readData.meta?.nextCursor ?? null);
      setLastSyncedDays(days);
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sincronizzazione");
    } finally {
      setSyncingInbox(false);
    }
  };

  const loadThreadMessages = async (threadKey: string) => {
    setThreadModalOpen(true);
    setSelectedThreadKey(threadKey);
    const cached = threadMessagesByKey[threadKey];
    if (cached?.length && isFresh(threadFetchedAtByKey[threadKey], THREAD_CACHE_TTL_MS)) {
      setSelectedMessageId(cached[0]?.id ?? null);
      return;
    }
    setLoadingThreadByKey((prev) => ({ ...prev, [threadKey]: true }));
    try {
      const res = await fetch(`/api/emails/threads/${encodeURIComponent(threadKey)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as
        | { ok: true; messages: InboxMessageMeta[] }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.ok ? "Errore apertura thread" : data.error ?? "Errore apertura thread");
      }
      setThreadMessagesByKey((prev) => ({ ...prev, [threadKey]: data.messages }));
      setThreadFetchedAtByKey((prev) => ({ ...prev, [threadKey]: Date.now() }));
      setSelectedMessageId(data.messages[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore apertura thread");
    } finally {
      setLoadingThreadByKey((prev) => ({ ...prev, [threadKey]: false }));
    }
  };

  const loadMessageBody = useCallback(async (message: InboxMessageMeta) => {
    if (isFresh(messageBodyFetchedAtById[message.id], BODY_CACHE_TTL_MS) && messageBodyById[message.id]) return;
    if (loadingBodyById[message.id]) return;
    setLoadingBodyById((prev) => ({ ...prev, [message.id]: true }));
    try {
      let res = await fetch(`/api/emails/messages/${message.id}?includeBody=true`, { cache: "no-store" });
      let data = (await res.json()) as
        | { ok: true; message: { text: string; html: string | null; hasBody: boolean } }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.ok ? "Errore caricamento contenuto" : data.error ?? "Errore caricamento contenuto");
      }
      if (!data.message.hasBody || (!data.message.text.trim() && !(data.message.html ?? "").trim())) {
        const syncRes = await fetch("/api/emails/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sinceDays }),
        });
        const syncJson = (await syncRes.json()) as { ok: boolean; error?: string };
        if (syncRes.ok && syncJson.ok) {
          res = await fetch(`/api/emails/messages/${message.id}?includeBody=true`, { cache: "no-store" });
          data = (await res.json()) as
            | { ok: true; message: { text: string; html: string | null; hasBody: boolean } }
            | { ok: false; error?: string };
          if (!res.ok || !data.ok) {
            throw new Error(data.ok ? "Errore caricamento contenuto" : data.error ?? "Errore caricamento contenuto");
          }
        }
      }
      setMessageBodyById((prev) => ({
        ...prev,
        [message.id]: {
          text: data.message.text ?? "",
          html: data.message.html ?? null,
        },
      }));
      setMessageBodyFetchedAtById((prev) => ({ ...prev, [message.id]: Date.now() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento contenuto");
    } finally {
      setLoadingBodyById((prev) => ({ ...prev, [message.id]: false }));
    }
  }, [messageBodyById, loadingBodyById, messageBodyFetchedAtById, sinceDays]);

  const transformToCollaboration = async (email: InboxMessageMeta) => {
    if (loadingAiById[email.id]) return;
    setLoadingAiById((prev) => ({ ...prev, [email.id]: true }));
    setAiError(null);
    const body = messageBodyById[email.id]?.text ?? "";
    const textForAi = body.trim() || email.preview || email.subject;
    try {
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textForAi }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.ok ? "Analisi Gemini non riuscita" : data.error ?? "Analisi Gemini non riuscita");
      }
      const plannedDeliverables = data.analysis.deliverables
        .map((d) => ({
          type: normalizeDeliverableType(d.type),
          publishDate: normalizeDate(d.publish_date),
        }))
        .filter((d): d is { type: string; publishDate: string } => !!d.type && !!d.publishDate);

      const draft: Draft = {
        brandId: pickBrandIdByName(brands, data.analysis.brand_name),
        briefText: email.subject,
        agreedFee: data.analysis.agreed_fee == null ? "" : String(data.analysis.agreed_fee),
        plannedDeliverables,
        initialTimelineNote: `Email convertita da Inbox Collaborazioni:\n\nDa: ${email.from}\nOggetto: ${email.subject}\nData: ${formatDate(email.date)}\n\n${textForAi}`,
      };
      if (data.analysis.deliverables.length > 1) {
        draft.isPeriodic = true;
        draft.contentCount = data.analysis.deliverables.length;
      }

      setInitialDraft(draft);
      setOpenCreate(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Analisi Gemini non riuscita");
    } finally {
      setLoadingAiById((prev) => ({ ...prev, [email.id]: false }));
    }
  };

  const loadTagSuggestions = async (emailId: string, query: string) => {
    const q = query.trim();
    if (!q) {
      setTagSuggestionsById((prev) => ({ ...prev, [emailId]: [] }));
      return;
    }
    const res = await fetch(`/api/emails/tags?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json()) as
      | { ok: true; tags: { id: string; name: string }[] }
      | { ok: false };
    if (res.ok && data.ok) {
      setTagSuggestionsById((prev) => ({ ...prev, [emailId]: data.tags }));
    }
  };

  const addTag = async (emailId: string) => {
    const raw = (tagInputById[emailId] ?? "").trim();
    if (!raw || tagBusyById[emailId]) return;
    setTagBusyById((prev) => ({ ...prev, [emailId]: true }));
    try {
      const res = await fetch(`/api/emails/messages/${emailId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName: raw }),
      });
      const data = (await res.json()) as
        | { ok: true; tag: { id: string; name: string; color: string | null } }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error((!data.ok ? data.error : undefined) ?? "Errore aggiunta tag");
      }
      setTagInputById((prev) => ({ ...prev, [emailId]: "" }));
      setTagSuggestionsById((prev) => ({ ...prev, [emailId]: [] }));
      const addedTag = { id: data.tag.id, name: data.tag.name, color: data.tag.color };
      setThreadMessagesByKey((prev) => {
        const copy = { ...prev };
        for (const key of Object.keys(copy)) {
          copy[key] = copy[key].map((msg) =>
            msg.id === emailId && !msg.tags.some((t) => t.id === addedTag.id)
              ? { ...msg, tags: [...msg.tags, addedTag] }
              : msg
          );
        }
        return copy;
      });
      setThreads((prev) =>
        prev.map((thread) => {
          const hasMessage = (threadMessagesByKey[thread.threadKey] ?? []).some((m) => m.id === emailId);
          if (!hasMessage) return thread;
          if (thread.tags.some((t) => t.id === addedTag.id)) return thread;
          return { ...thread, tags: [...thread.tags, addedTag] };
        })
      );
      setThreadFetchedAtByKey((prev) => ({ ...prev, [selectedThreadKey ?? ""]: Date.now() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore aggiunta tag");
    } finally {
      setTagBusyById((prev) => ({ ...prev, [emailId]: false }));
    }
  };

  const removeTag = async (emailId: string, tagId: string) => {
    if (tagBusyById[emailId]) return;
    setTagBusyById((prev) => ({ ...prev, [emailId]: true }));
    try {
      const res = await fetch(`/api/emails/messages/${emailId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Errore rimozione tag");
      }
      setThreadMessagesByKey((prev) => {
        const copy = { ...prev };
        for (const key of Object.keys(copy)) {
          copy[key] = copy[key].map((msg) =>
            msg.id === emailId
              ? { ...msg, tags: msg.tags.filter((t) => t.id !== tagId) }
              : msg
          );
        }
        return copy;
      });
      setThreads((prev) =>
        prev.map((thread) => {
          const msgs = threadMessagesByKey[thread.threadKey] ?? [];
          const affected = msgs.some((m) => m.id === emailId);
          if (!affected) return thread;
          const stillUsed = msgs.some(
            (m) => m.id !== emailId && m.tags.some((t) => t.id === tagId)
          );
          if (stillUsed) return thread;
          return { ...thread, tags: thread.tags.filter((t) => t.id !== tagId) };
        })
      );
      setThreadFetchedAtByKey((prev) => ({ ...prev, [selectedThreadKey ?? ""]: Date.now() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore rimozione tag");
    } finally {
      setTagBusyById((prev) => ({ ...prev, [emailId]: false }));
    }
  };

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadKey === selectedThreadKey) ?? null,
    [threads, selectedThreadKey]
  );
  const selectedThreadMessages = selectedThreadKey ? threadMessagesByKey[selectedThreadKey] ?? [] : [];
  const selectedMessage = selectedThreadMessages.find((m) => m.id === selectedMessageId) ?? null;

  useEffect(() => {
    if (!selectedMessage) return;
    void loadMessageBody(selectedMessage);
  }, [selectedMessage, loadMessageBody]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Inbox Collaborazioni</h1>
            <p className="mt-1 text-sm text-gray-500">
              Leggi le email commerciali filtrate dal tuo indirizzo collaborazioni e trasformale in deal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cerca in subject, mittente, preview, contenuto..."
              className="w-[320px]"
            />
            <select
              className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm"
              value={sinceDays}
              onChange={(e) => {
                const nextDays = Number(e.target.value);
                setSinceDays(nextDays);
                void runManualSync(nextDays);
              }}
            >
              <option value={14}>14 giorni</option>
              <option value={30}>30 giorni</option>
              <option value={60}>60 giorni</option>
              <option value={120}>120 giorni</option>
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runManualSync()}
              disabled={syncingInbox}
            >
              {syncingInbox ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sincronizzo...
                </>
              ) : (
                "Sincronizza"
              )}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={activeTagFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTagFilter("all")}
          >
            Tutti
          </Button>
          {availableTagFilters.map((tag) => (
            <Button
              key={tag.id}
              type="button"
              variant={activeTagFilter === tag.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTagFilter(tag.id)}
            >
              {tag.name}
            </Button>
          ))}
        </div>
        {lastSyncedDays ? (
          <div className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
            Sincronizzato fino a {lastSyncedDays} giorni
            {lastSyncedAt
              ? ` · ${new Intl.DateTimeFormat("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(lastSyncedAt))}`
              : ""}
          </div>
        ) : null}
      </div>

      <section className="rounded-3xl bg-white p-2 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-3">
        <div className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Mittente</span>
          <span>Oggetto</span>
          <span>Tag</span>
          <span className="text-right">Azioni</span>
        </div>
        {loadingInbox ? (
          <div className="p-4">
            <AIThinkingLoader label="Sto scaricando le email da iCloud..." />
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Nessuna email trovata negli ultimi 14 giorni.</div>
        ) : (
          <div className="max-h-[72vh] space-y-1 overflow-y-auto">
            {filteredThreads.map((thread) => {
              return (
                <div
                  key={`${thread.threadKey}-${thread.latestMessage.id}`}
                  className="rounded-2xl border border-gray-100 bg-white"
                >
                  <div className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{thread.latestMessage.from}</p>
                      <p className="truncate text-xs text-gray-500">{formatDate(thread.latestMessage.date)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800">{thread.latestMessage.subject}</p>
                      <p className="truncate text-xs text-gray-500">{thread.latestMessage.preview || "Nessuna anteprima"}</p>
                      {!thread.latestMessage.hasBody ? (
                        <p className="mt-0.5 text-[11px] text-amber-600">Body non scaricato</p>
                      ) : null}
                      {thread.messageCount > 1 ? (
                        <p className="mt-0.5 text-[11px] text-blue-600">Thread: {thread.messageCount} messaggi</p>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap gap-1">
                        {thread.tags.length === 0 ? (
                          <span className="text-xs text-gray-400">Nessun tag</span>
                        ) : (
                          thread.tags.map((tag) => (
                            <Badge key={tag.id} variant="outline" className="rounded-full">
                              {tag.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadThreadMessages(thread.threadKey)}
                        disabled={loadingThreadByKey[thread.threadKey]}
                      >
                        {loadingThreadByKey[thread.threadKey] ? "Apro..." : "Apri"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          void transformToCollaboration({
                            id: thread.latestMessage.id,
                            externalMessageId: thread.latestMessage.externalMessageId,
                            threadKey: thread.threadKey,
                            from: thread.latestMessage.from,
                            fromEmail: thread.latestMessage.fromEmail,
                            to: [],
                            subject: thread.latestMessage.subject,
                            date: thread.latestMessage.date,
                            preview: thread.latestMessage.preview,
                            hasBody: thread.latestMessage.hasBody,
                            tags: thread.tags,
                          })
                        }
                        disabled={loadingAiById[thread.latestMessage.id]}
                        className="gap-1.5"
                      >
                        {loadingAiById[thread.latestMessage.id] ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Analisi...
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" />
                            Trasforma
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore ? (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  onClick={() => void fetchInbox({ reset: false, cursor: nextCursor })}
                  disabled={loadingMore || !nextCursor}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Carico...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {aiError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {aiError}
        </div>
      ) : null}

      <Dialog
        open={threadModalOpen}
        onOpenChange={(open) => {
          setThreadModalOpen(open);
          if (!open) {
            setSelectedThreadKey(null);
            setSelectedMessageId(null);
          }
        }}
      >
        <DialogContent className="h-[96vh] w-[96vw] !max-w-[96vw] md:!max-w-[1200px] overflow-hidden p-0">
          <DialogHeader className="border-b border-gray-100 px-5 py-4">
            <DialogTitle>
              {selectedThread?.latestMessage.subject ?? "Thread"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid h-[calc(96vh-76px)] min-h-0 grid-cols-1 gap-0 lg:grid-cols-[390px_1fr]">
            <div className="min-h-0 overflow-y-auto border-r border-gray-100 p-3">
              {loadingThreadByKey[selectedThreadKey ?? ""] ? (
                <AIThinkingLoader label="Carico i messaggi del thread..." />
              ) : selectedThreadMessages.length === 0 ? (
                <p className="text-sm text-gray-500">Nessun messaggio nel thread.</p>
              ) : (
                <div className="space-y-2">
                  {selectedThreadMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        void loadMessageBody(message);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left ${
                        selectedMessageId === message.id ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-gray-900">{message.from}</p>
                      <p className="truncate text-xs text-gray-500">{formatDate(message.date)}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">{message.preview}</p>
                      {!message.hasBody ? (
                        <p className="mt-1 text-[11px] text-amber-600">Body non scaricato</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-0 p-4">
              {!selectedMessage ? (
                <p className="text-sm text-gray-500">Seleziona un messaggio.</p>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedMessage.subject}</p>
                      <p className="text-xs text-gray-500">
                        {selectedMessage.from} · {formatDate(selectedMessage.date)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void transformToCollaboration(selectedMessage)}
                      disabled={loadingAiById[selectedMessage.id]}
                    >
                      {loadingAiById[selectedMessage.id] ? "Analisi..." : "Trasforma"}
                    </Button>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {selectedMessage.tags.map((tag) => (
                      <button key={tag.id} type="button" onClick={() => void removeTag(selectedMessage.id, tag.id)}>
                        <Badge variant="outline" className="gap-1 rounded-full">
                          {tag.name}
                          <X className="size-3" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <div className="relative mb-3">
                    <div className="flex gap-1">
                      <Input
                        value={tagInputById[selectedMessage.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTagInputById((prev) => ({ ...prev, [selectedMessage.id]: v }));
                          const old = suggestTimers.current[selectedMessage.id];
                          if (old) window.clearTimeout(old);
                          suggestTimers.current[selectedMessage.id] = window.setTimeout(() => {
                            void loadTagSuggestions(selectedMessage.id, v);
                          }, 180);
                        }}
                        placeholder="Aggiungi etichetta..."
                        className="h-8"
                        disabled={tagBusyById[selectedMessage.id]}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addTag(selectedMessage.id);
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => void addTag(selectedMessage.id)}
                        disabled={tagBusyById[selectedMessage.id]}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    {(tagSuggestionsById[selectedMessage.id]?.length ?? 0) > 0 ? (
                      <div className="mt-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                        {tagSuggestionsById[selectedMessage.id].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-50"
                            onClick={() => {
                              setTagInputById((prev) => ({ ...prev, [selectedMessage.id]: s.name }));
                              setTagSuggestionsById((prev) => ({ ...prev, [selectedMessage.id]: [] }));
                            }}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-gray-50/70 p-3">
                    {loadingBodyById[selectedMessage.id] ? (
                      <AIThinkingLoader label="Carico contenuto messaggio..." />
                    ) : (
                      <article className="whitespace-pre-wrap text-sm text-gray-700">
                        {normalizeBodyText(messageBodyById[selectedMessage.id]?.text ?? "") ||
                          formatHtmlFallback(messageBodyById[selectedMessage.id]?.html ?? "") ||
                          selectedMessage.preview ||
                          "Contenuto non disponibile."}
                      </article>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateCollaborationDialog
        brands={brands}
        hideTrigger
        open={openCreate}
        onOpenChange={setOpenCreate}
        initialDraft={initialDraft}
      />
    </div>
  );
}
