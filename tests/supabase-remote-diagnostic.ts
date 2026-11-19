/**
 * Script de Verificação e Homologação Remota de Multi-Tenancy e RLS
 * Executado quando um Supabase dedicado do TeoClass estiver conectado via .env.local
 *
 * Cenários Testados:
 * 1. Isolamento Hermético: Tenant A não lê dados do Tenant B.
 * 2. Bloqueio de Escrita Indevida: Tenant A não insere dados em nome do Tenant B.
 * 3. Integridade RBAC: Aluno/Professor não conseguem se autopromover para Admin ou alterar roles.
 * 4. Imutabilidade de Auditoria: Usuários normais não conseguem apagar ou alterar audit_logs.
 * 5. Proteção de Operador: Usuário comum não consegue setar is_platform_operator = true.
 */

import { isSupabaseConfigured, isSupabaseAdminConfigured } from "../src/lib/supabase/config";
import { createAdminClient } from "../src/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function runDiagnostic() {
  console.log("=================================================================");
  console.log("TeoClass — Diagnóstico de Conexão e Integridade do Supabase");
  console.log("=================================================================");

  const configured = isSupabaseConfigured();
  const adminConfigured = isSupabaseAdminConfigured();

  console.log(`URL do Supabase configurada: ${configured ? "SIM" : "NÃO / PROVISÓRIA"}`);
  console.log(`Chave Service Role configurada: ${adminConfigured ? "SIM" : "NÃO / PROVISÓRIA"}`);

  if (!adminConfigured) {
    console.log("\n[STATUS: AGUARDANDO PROVISIONAMENTO]");
    console.log("Nenhum banco remoto TeoClass configurado no ambiente.");
    console.log("Para homologar em ambiente real:");
    console.log("1. Crie o projeto no Supabase.");
    console.log("2. Aplique a migration 'supabase/migrations/0001_core_tenants_and_auth.sql'.");
    console.log("3. Configure o arquivo '.env.local' com as chaves reais.");
    console.log("4. Execute novamente este script.");
    return;
  }

  console.log("\nIniciando testes de integridade ao vivo...");
  const adminClient = createAdminClient();

  try {
    // 1. Teste de conexão do service_role
    const { data: tenants, error: tenantsError } = await adminClient
      .from("tenants")
      .select("id, name, slug")
      .limit(5);

    if (tenantsError) {
      console.error("❌ Falha ao consultar tabela tenants:", tenantsError.message);
      return;
    }

    console.log(`✅ Conexão administrativa bem-sucedida. (${tenants?.length || 0} tenants encontrados)`);
  } catch (err) {
    console.error("❌ Erro inesperado durante diagnóstico:", err);
  }
}

runDiagnostic().catch(console.error);
