import type { SupabaseClient } from "@supabase/supabase-js";

/** Kill switch da env: se AUTH_ALLOW_SIGNUP non è "true" la registrazione è chiusa. */
export function isSignupAllowedByEnv() {
  return (process.env.AUTH_ALLOW_SIGNUP ?? "false").toLowerCase() === "true";
}

export async function isSignupEnabledInUi(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("app_settings")
    .select("signup_enabled")
    .eq("id", "global")
    .maybeSingle<{ signup_enabled: boolean }>();
  return data?.signup_enabled === true;
}
