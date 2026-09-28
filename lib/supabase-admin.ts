import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client con service role: bypassa la RLS. Solo per job server (cron) e scritture
 * amministrative già autorizzate a monte. Filtrare sempre per `user_id` a mano.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in env");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
