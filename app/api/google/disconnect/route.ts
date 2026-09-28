import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { disconnectGoogle } from "@/lib/google-auth";

export async function POST() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  await disconnectGoogle(auth.userId);
  return NextResponse.json({ ok: true });
}
