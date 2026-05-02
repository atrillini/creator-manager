import { NextResponse } from "next/server";
import { syncYoutubeData } from "@/lib/youtube";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      startDate?: string;
      endDate?: string;
    };
    const data = await syncYoutubeData({
      startDate: body.startDate,
      endDate: body.endDate,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    let message = error instanceof Error ? error.message : "Unknown sync error";
    if (/Insufficient permission/i.test(message)) {
      message =
        "Permessi YouTube insufficienti: rigenera il refresh token includendo lo scope yt-analytics-monetary.readonly e verifica che il canale abbia accesso ai dati monetization.";
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
