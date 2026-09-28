import { NextResponse } from "next/server";
import { cronUserId, isAuthorizedCron } from "@/lib/cron-auth";
import { runInboxJob } from "@/lib/inbox/run";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

/** Job ogni 15 minuti: email nuove + analisi AI dei thread in coda. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  // ?budget=<secondi> solo per esecuzioni locali senza limite di durata (es. import storico in un colpo).
  const requested = Number(new URL(request.url).searchParams.get("budget"));
  const budgetMs = Number.isFinite(requested) && requested > 50 ? Math.min(requested, 1800) * 1000 : 50_000;
  const result = await runInboxJob({
    supabase: createSupabaseAdminClient(),
    userId: cronUserId(),
    budgetMs,
  });
  const ok = !result.syncError && !result.aiError;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
}

export const POST = GET;
