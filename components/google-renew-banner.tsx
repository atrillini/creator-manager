import { AlertTriangle } from "lucide-react";
import { getGoogleConnectionStatus } from "@/lib/google-auth";
import { createSupabaseClient } from "@/lib/supabase-server";

/** Avviso globale: collegamento Google scaduto o in scadenza (app OAuth in modalità Testing). */
export async function GoogleRenewBanner() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const status = await getGoogleConnectionStatus(user.id).catch(() => null);
  if (!status?.connected || !status.renewSoon) return null;

  const expired = status.needsReconnect || (status.expiresAt ? new Date(status.expiresAt) < new Date() : false);
  const when = status.expiresAt
    ? new Date(status.expiresAt).toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200/70">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        {expired
          ? "Il collegamento Google è scaduto: la sync YouTube è ferma."
          : `Il collegamento Google scade ${when ? `${when}` : "a breve"}.`}
      </span>
      <a
        href="/api/google/connect?next=/dashboard"
        className="rounded-full bg-amber-900 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
      >
        Rinnova ora
      </a>
    </div>
  );
}
