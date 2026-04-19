import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export const isSupabaseEnabled = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

export function createSupabaseBrowser() {
  if (!isSupabaseEnabled) {
    throw new Error("Supabase not configured (NEXT_PUBLIC_SUPABASE_URL is empty). Use dev-login instead.");
  }
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
