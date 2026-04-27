import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Client Supabase (browser o Server Components: usa le stesse env).
 * Nella fase iniziale i dati provengono da `lib/data` mock; collega le query reali
 * sostituendo le chiamate o usando questo client in parallelo.
 */
export function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[CreatorCRM] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY mancanti. " +
          "Inserisci le chiavi in .env.local; fino ad allora usa i dati mock."
      );
    }
  }
  return createClient(
    supabaseUrl ?? "https://placeholder.supabase.co",
    supabaseAnonKey ?? "placeholder"
  );
}

export const supabase = createSupabaseClient();
