import { NextResponse } from "next/server";
import { cronUserId, isAuthorizedCron } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncYoutubeData } from "@/lib/youtube";

export const maxDuration = 60;

/** Job giornaliero: canale + ricavi del mese precedente e di quello in corso. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  try {
    const result = await syncYoutubeData({
      userId: cronUserId(),
      supabase: createSupabaseAdminClient(),
    });
    return NextResponse.json({
      ok: true,
      range: result.range,
      months: result.fetchedRevenueRows,
      monetizationWarning: result.monetizationWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sync YouTube";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = GET;
