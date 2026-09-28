import { requireApiAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getYoutubeDebugDiagnostics } from "@/lib/youtube";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const diagnostics = await getYoutubeDebugDiagnostics(auth.userId);
    return NextResponse.json({ ok: true, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown debug error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
