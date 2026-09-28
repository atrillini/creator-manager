import { requireApiUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isInvalidGrant } from "@/lib/google-auth";
import { createSupabaseClient } from "@/lib/supabase-server";
import { syncYoutubeData } from "@/lib/youtube";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      startDate?: string;
      endDate?: string;
    };
    const data = await syncYoutubeData({
      userId: auth.userId,
      supabase: await createSupabaseClient(),
      range: { startDate: body.startDate, endDate: body.endDate },
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    let message = error instanceof Error ? error.message : "Unknown sync error";
    if (isInvalidGrant(error)) {
      message = "Collegamento Google scaduto o revocato: usa «Ricollega Google» nella dashboard.";
    } else if (/Insufficient permission/i.test(message)) {
      message =
        "Permessi YouTube insufficienti: usa «Ricollega Google» e accetta tutti i permessi richiesti (incluse le entrate).";
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
