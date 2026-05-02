import { NextResponse } from "next/server";
import { askBusinessAssistant } from "@/lib/ai/business-assistant";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string };
    const question = String(body?.question ?? "");
    const result = await askBusinessAssistant(question);
    return NextResponse.json({ ok: true, answer: result.answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore assistente IA";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
