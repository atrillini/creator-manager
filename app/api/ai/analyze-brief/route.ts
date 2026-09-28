import { requireApiUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { analyzeBrief } from "@/lib/ai/analyze-brief";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { text?: string };
    const text = String(body?.text ?? "");
    const analysis = await analyzeBrief(text);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore analisi brief";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
