import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function ensureSupabaseEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY mancanti in env"
    );
  }
}

export function createBrowserSupabaseClient() {
  ensureSupabaseEnv();
  return createBrowserClient(supabaseUrl as string, supabaseAnonKey as string);
}

export const supabase: SupabaseClient = createBrowserSupabaseClient();
