"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useElapsedSeconds } from "@/hooks/use-elapsed-seconds";
import { syncInboxNow } from "@/lib/actions/inbox";
import type { InboxSyncStatus } from "@/lib/data/inbox";

function formatWhen(iso: string | null) {
  if (!iso) return "mai";
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export function InboxSyncButton({ status, aiPending }: { status: InboxSyncStatus; aiPending: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const elapsed = useElapsedSeconds(pending);

  const onSync = () => {
    setMessage(null);
    start(async () => {
      const res = await syncInboxNow();
      if (!res.ok) {
        setMessage({ text: res.error, error: true });
        return;
      }
      const { sync, ai, aiError } = res.result;
      const parts = [
        `${sync?.inbound ?? 0} ricevute, ${sync?.outbound ?? 0} inviate`,
        ai?.analyzed ? `${ai.analyzed} analizzate dall'AI` : null,
        (sync && !sync.complete) || ai?.remaining ? "il resto al prossimo giro" : null,
        ai?.skipped ?? aiError ?? null,
      ].filter(Boolean);
      setMessage({ text: parts.join(" · "), error: Boolean(aiError) });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-gray-500">
      {status.backfilling ? (
        <span className="text-amber-700" title="Il primo import procede dal più vecchio al più recente, un blocco ogni 15 minuti">
          Import storico in corso
          {status.importedUntil
            ? `: arrivato al ${new Date(status.importedUntil).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`
            : ""}
          {status.lastRunAt ? ` · ultimo giro ${formatWhen(status.lastRunAt)}` : ""}
        </span>
      ) : (
        <span>Ultima sync: {formatWhen(status.lastSuccessAt)}</span>
      )}
      {aiPending > 0 ? (
        <span title="Conversazioni in coda per l'analisi AI: calano a ogni giro di sync">· {aiPending} da analizzare</span>
      ) : null}
      {status.lastError ? <span className="text-red-600">Errore: {status.lastError}</span> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 rounded-full border-gray-200 px-2.5 text-xs"
        onClick={onSync}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
        {pending ? `Sincronizzo…${elapsed > 0 ? ` ${elapsed}s` : ""}` : "Sincronizza ora"}
      </Button>
      {message ? (
        <span className={message.error ? "w-full text-right text-red-600" : "w-full text-right text-gray-600"}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
