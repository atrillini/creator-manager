import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { isSignupAllowedByEnv, isSignupEnabledInUi } from "@/lib/signup-settings";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseClient();
  const envEnabled = isSignupAllowedByEnv();
  const uiEnabled = await isSignupEnabledInUi(supabase);
  return NextResponse.json({
    ok: true,
    envEnabled,
    uiEnabled,
    effectiveEnabled: envEnabled && uiEnabled,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled === true;
  // La RLS non consente scritture dal client: scrive il server dopo il controllo admin.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      id: "global",
      signup_enabled: enabled,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, enabled });
}
