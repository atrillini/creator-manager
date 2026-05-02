import { NextResponse } from "next/server";
import { getGeminiModelCandidates, listAvailableGeminiModels } from "@/lib/ai/gemini-client";

export async function GET() {
  try {
    const [available, candidates] = await Promise.all([
      listAvailableGeminiModels(),
      getGeminiModelCandidates(),
    ]);
    return NextResponse.json({
      ok: true,
      preferred: process.env.GEMINI_MODEL ?? null,
      available,
      candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lista modelli";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
