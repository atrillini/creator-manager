"use client";

import { Button } from "@/components/ui/button";
import type { YoutubeStatsRow } from "@/lib/data/fetchers";
import type { GoogleConnectionStatus } from "@/lib/google-auth";
import { AlertTriangle, Link2, Loader2, RefreshCcw } from "lucide-react";
import Image from "next/image";
import { GoogleConnectLink } from "@/components/google-connect-link";
import { useState, useTransition } from "react";
import { useElapsedSeconds } from "@/hooks/use-elapsed-seconds";

type Props = {
  initial: YoutubeStatsRow | null;
  google: GoogleConnectionStatus;
  /** Esito del ritorno da Google (`?google=` nell'URL). */
  oauthResult: string | null;
};

const OAUTH_MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  collegato: { text: "Account Google collegato: la sync ora gira anche in automatico ogni giorno.", tone: "ok" },
  annullato: { text: "Collegamento Google annullato.", tone: "warn" },
  "senza-token": {
    text: "Google non ha rilasciato un token permanente: riprova con «Collega Google».",
    tone: "warn",
  },
  errore: { text: "Collegamento Google non riuscito: riprova.", tone: "warn" },
};

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function YouTubeHeroWidget({ initial, google, oauthResult }: Props) {
  const [stats, setStats] = useState<YoutubeStatsRow | null>(initial);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const elapsedSeconds = useElapsedSeconds(pending);

  const oauthMessage = oauthResult ? OAUTH_MESSAGES[oauthResult] : undefined;
  const needsConnect = !google.connected || google.needsReconnect;

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

  return (
    <section
      aria-busy={pending}
      className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {stats?.avatarUrl ? (
            <Image
              src={`/api/youtube/avatar?url=${encodeURIComponent(stats.avatarUrl)}`}
              alt={stats.channelName}
              width={56}
              height={56}
              unoptimized
              className="size-14 rounded-full object-cover ring-1 ring-gray-100"
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
        {needsConnect ? (
          <GoogleConnectLink className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-900 px-4 text-xs font-medium text-white hover:bg-gray-800">
            <Link2 className="size-3.5" />
            {google.connected ? "Ricollega Google" : "Collega Google"}
          </GoogleConnectLink>
        ) : (
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
        )}
      </div>
      {google.needsReconnect ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Il collegamento Google è scaduto o è stato revocato: ricollega l&apos;account per riprendere la sync.
        </p>
      ) : google.legacyEnv ? (
        <p className="mt-3 text-xs text-gray-500">
          Collegato tramite token nelle variabili d&apos;ambiente.{" "}
          <GoogleConnectLink className="font-medium text-blue-600 hover:underline">Collega da qui</GoogleConnectLink>{" "}
          per non doverlo più rigenerare a mano.
        </p>
      ) : google.connected ? (
        <p className={google.renewSoon ? "mt-3 text-[11px] text-amber-700" : "mt-3 text-[11px] text-gray-400"}>
          Google{google.googleEmail ? ` · ${google.googleEmail}` : ""}
          {google.lastSyncAt
            ? ` · ultima sync ${new Date(google.lastSyncAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
            : ""}
          {google.expiresAt
            ? ` · scade il ${new Date(google.expiresAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
            : ""}
          {" · "}
          <GoogleConnectLink className="font-medium hover:underline">Rinnova</GoogleConnectLink>
        </p>
      ) : null}
      {oauthMessage ? (
        <p className={oauthMessage.tone === "ok" ? "mt-2 text-xs text-emerald-700" : "mt-2 text-xs text-amber-700"}>
          {oauthMessage.text}
        </p>
      ) : null}
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
