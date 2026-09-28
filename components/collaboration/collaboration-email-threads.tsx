import Link from "next/link";
import { CornerUpLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboxThreadListItem } from "@/lib/data/inbox";
import { INBOX_STATUS_META } from "@/lib/inbox/constants";
import { cn } from "@/lib/utils";

/** Conversazioni dell'inbox collegate alla collaborazione. */
export function CollaborationEmailThreads({ threads }: { threads: InboxThreadListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
          <Mail className="size-4 text-gray-400" />
          Email
        </CardTitle>
        <p className="text-sm text-gray-500">
          Conversazioni collegate dall&apos;inbox; le nuove risposte dello stesso thread compaiono qui da sole.
        </p>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <p className="text-xs text-gray-400">
            Nessuna email collegata. Dall&apos;
            <Link href="/inbox" className="text-blue-600 hover:underline">
              inbox
            </Link>{" "}
            usa «Collega a esistente» su una conversazione.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/inbox?view=tutte&t=${t.id}`}
                  className="block rounded-xl bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{t.subject}</p>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={cn("rounded-full px-1.5 py-px text-[10px]", INBOX_STATUS_META[t.status].className)}>
                      {INBOX_STATUS_META[t.status].label}
                    </span>
                    {t.lastDirection === "out" ? <CornerUpLeft className="size-3 text-gray-400" /> : null}
                    <span className="truncate">{t.summary ?? t.preview}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
