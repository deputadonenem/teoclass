import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";
import { isSupabaseConfigured } from "./config";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Cliente Supabase para execução no navegador.
 * Seguro contra ausência de variáveis durante a fase de fundação.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://unconfigured.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "unconfigured-anon-key";

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}

export { isSupabaseConfigured };
