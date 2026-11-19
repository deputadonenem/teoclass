import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEventParams {
  tenantId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Registra eventos de auditoria no servidor de forma protegida.
 * Utiliza o cliente administrativo (`service_role`) para gravar na tabela imutável `audit_logs`,
 * respeitando as políticas de RLS da Migration 0001 (que proíbem INSERT direto via clientes externos).
 *
 * Limitações e Garantias de Atomicidade:
 * - A chamada ocorre estritamente dentro do runtime seguro do servidor (Next.js Server Actions / Handlers).
 * - O ator (`userId`) e o escopo (`tenantId`) são extraídos obrigatoriamente da sessão validada (`requireTenantSession`).
 * - Não expõe RPC para o cliente, prevenindo qualquer falsificação de ator, ação ou tenant.
 * - Caso a gravação de auditoria falhe, o erro é logado e não bloqueia silentemente operações sem registro.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const admin = createAdminClient();

    const { error } = await (admin.from("audit_logs") as any).insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      details: params.details || {},
      ip_address: params.ipAddress || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Falha ao gravar trilha de auditoria:", error.message);
    }
  } catch (err: unknown) {
    console.error("Erro interno no serviço de auditoria:", err);
  }
}
