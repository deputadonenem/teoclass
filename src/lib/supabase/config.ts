/**
 * Helper para verificar se as variáveis do Supabase estão configuradas no ambiente.
 * Permite que a aplicação compile e forneça fallback seguro quando o Supabase
 * ainda não foi provisionado.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (url.includes("seu-projeto-teoclass") || url.includes("placeholder")) return false;
  return true;
}

export function isSupabaseAdminConfigured(): boolean {
  if (!isSupabaseConfigured()) return false;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey.includes("sua-chave-service-role")) return false;
  return true;
}
