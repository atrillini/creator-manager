import { NextResponse } from "next/server";
import { analyzeBrief } from "@/lib/ai/analyze-brief";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = String(body?.text ?? "");
    const analysis = await analyzeBrief(text);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore analisi Gemini";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
