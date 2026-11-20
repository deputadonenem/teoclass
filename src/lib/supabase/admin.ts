import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "./config";

/**
 * Cliente Supabase com Service Role Key para operações administrativas internas e testes de infraestrutura.
 * EXCLUSIVO DO SERVIDOR: NUNCA importe ou utilize no cliente/navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || !isSupabaseAdminConfigured()) {
    throw new Error(
      "Operação administrativa abortada: SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não estão configuradas."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { isSupabaseAdminConfigured };
