"use client";

import { Button } from "@/components/ui/button";
import type { YoutubeStatsRow } from "@/lib/data/fetchers";
import { Loader2, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = { initial: YoutubeStatsRow | null };

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function YouTubeHeroWidget({ initial }: Props) {
  const [stats, setStats] = useState<YoutubeStatsRow | null>(initial);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pending) {
      const startedAt = Date.now();
      setElapsedMs(0);
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAt);
      }, 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [pending]);

  const onSync = () => {
    setSyncError(null);
    setSyncWarning(null);
    start(() => {
      void (async () => {
        const res = await fetch("/api/youtube/sync", { method: "POST" });
        const data = (await res.json()) as
          | {
              ok: true;
              snapshot: {
                channelName: string;
                subscriberCount: number;
                viewCount: number;
                avatarUrl: string | null;
              };
              monetizationWarning?: string | null;
            }
          | { ok: false; error?: string };
        if (!data.ok) {
          setSyncError(data.error ?? "Sync YouTube fallita");
          return;
        }
        setStats({
          channelName: data.snapshot.channelName,
          subscriberCount: data.snapshot.subscriberCount,
          viewCount: data.snapshot.viewCount,
          avatarUrl: data.snapshot.avatarUrl,
          updatedAt: new Date().toISOString(),
        });
        if (data.monetizationWarning) {
          setSyncWarning(
            "Dati canale aggiornati, ma monetizzazione non disponibile con i permessi correnti."
          );
        }
      })();
    });
  };

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  return (
    <section
      aria-busy={pending}
      className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {stats?.avatarUrl ? (
            <img
              src={`/api/youtube/avatar?url=${encodeURIComponent(stats.avatarUrl)}`}
              alt={stats.channelName}
              className="size-14 rounded-full object-cover ring-1 ring-gray-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="size-14 rounded-full bg-gray-100" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              YouTube Channel
            </p>
            <h3 className="truncate text-lg font-semibold text-gray-900">
              {stats?.channelName ?? "Collega YouTube"}
            </h3>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 rounded-full border-gray-200 text-xs"
          onClick={onSync}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Sync in corso…
            </>
          ) : (
            <>
              <RefreshCcw className="size-3.5" />
              Sync
            </>
          )}
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Iscritti</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {compact(stats?.subscriberCount ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Visualizzazioni totali</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {compact(stats?.viewCount ?? 0)}
          </p>
        </div>
      </div>
      {syncError ? <p className="mt-3 text-xs text-red-600">{syncError}</p> : null}
      {syncWarning ? <p className="mt-2 text-xs text-amber-600">{syncWarning}</p> : null}
      {pending ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-3xl bg-white/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-gray-800">
            Sincronizzazione YouTube in corso…
          </p>
          <p className="text-xs text-gray-500">
            Recupero iscritti, visualizzazioni e ricavi stimati
            {elapsedSeconds > 0 ? ` · ${elapsedSeconds}s` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
