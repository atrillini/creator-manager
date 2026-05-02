import { NextResponse } from "next/server";
import { getYoutubeDebugDiagnostics } from "@/lib/youtube";

export async function GET() {
  try {
    const diagnostics = await getYoutubeDebugDiagnostics();
    return NextResponse.json({ ok: true, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown debug error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
