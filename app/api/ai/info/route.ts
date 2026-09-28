import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { aiModels } from "@/lib/ai/openrouter";

/** Modelli configurati (mostrati nel drawer dell'assistente). */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    models: aiModels(),
  });
}
