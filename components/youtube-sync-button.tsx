"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className={className ?? "rounded-full border-gray-200 text-xs"}
        onClick={onSync}
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Sync...
          </>
        ) : (
          label
        )}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
