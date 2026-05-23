"use client";

import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  className?: string;
  label?: string;
  startDate?: string;
  endDate?: string;
};

export function YouTubeSyncButton({
  className,
  label = "Sync YouTube",
  startDate,
  endDate,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    start(() => {
      void (async () => {
        const res = await fetch("/api/youtube/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) {
          setError(data.error ?? "Sync YouTube fallita");
          return;
        }
        router.refresh();
      })();
    });
  };

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className={className ?? "gap-1.5 rounded-full border-gray-200 text-xs"}
        onClick={onSync}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Sync in corso{elapsedSeconds > 0 ? ` · ${elapsedSeconds}s` : "…"}
          </>
        ) : (
          <>
            <RefreshCcw className="size-3.5" />
            {label}
          </>
        )}
      </Button>
      {pending ? (
        <p className="text-[11px] text-gray-500" role="status" aria-live="polite">
          Recupero canale e ricavi stimati: può richiedere ~10–30s
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
