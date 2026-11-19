import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";
import { isSupabaseConfigured } from "./config";

/**
 * Cliente Supabase SSR para execução no Servidor (Server Components, Server Actions e Route Handlers).
 * Gerencia cookies de autenticação de forma isolada e segura.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://unconfigured.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "unconfigured-anon-key";

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignorado com segurança quando invocado a partir de Server Component puro
        }
      },
    },
  });
}

export { isSupabaseConfigured };
