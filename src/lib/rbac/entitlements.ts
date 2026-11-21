import type { PlanTier, TeoClassModule, TeoClassAction } from "./permissions";

export type { PlanTier };

/**
 * Recursos e Módulos autorizados por Plano SaaS (Decisão Comercial TeoClass Lote 20)
 * 
 * - 'gestao': Secretaria Acadêmica, Cursos, Turmas, Equipe, Financeiro Escolar, Certificados.
 *             NÃO inclui Portal do Aluno individual, NÃO inclui página pública institucional, NÃO inclui EAD.
 * - 'gestao_ead': Tudo do plano Gestão + Página Pública da Instituição + Portal do Aluno + EAD assíncrono + Banco de Questões e Provas.
 * - 'institucional': Todos os recursos do TeoClass com limites personalizados e suporte a múltiplos polos/extensões.
 */
export const PLAN_MODULE_ENTITLEMENTS: Record<PlanTier, TeoClassModule[]> = {
  gestao: [
    "inicio",
    "secretaria",
    "academico",
    "financeiro",
    "certificados",
    "captacao",
    "configuracoes",
  ],
  gestao_ead: [
    "inicio",
    "secretaria",
    "academico",
    "portal_aluno",
    "ead",
    "provas",
    "financeiro",
    "certificados",
    "captacao",
    "configuracoes",
  ],
  institucional: [
    "inicio",
    "secretaria",
    "academico",
    "portal_aluno",
    "ead",
    "provas",
    "financeiro",
    "certificados",
    "captacao",
    "configuracoes",
  ],
};

/**
 * Ações bloqueadas especificamente pelo plano comercial, independentemente do papel do usuário.
 */
export const PLAN_BLOCKED_ACTIONS: Record<PlanTier, TeoClassAction[]> = {
  gestao: [
    "ead:access_lessons",
    "ead:manage_content",
    "provas:attempt",
    "provas:manage_bank",
    "provas:grade",
  ],
  gestao_ead: [],
  institucional: [],
};

/**
 * Verifica se um plano SaaS contratado concede acesso a determinado módulo.
 */
export function hasPlanModuleAccess(planTier: PlanTier, module: TeoClassModule): boolean {
  const allowed = PLAN_MODULE_ENTITLEMENTS[planTier] || PLAN_MODULE_ENTITLEMENTS.gestao;
  return allowed.includes(module);
}

/**
 * Verifica se uma ação é permitida sob o plano comercial ativo.
 */
export function hasPlanActionAccess(planTier: PlanTier, action: TeoClassAction): boolean {
  const blocked = PLAN_BLOCKED_ACTIONS[planTier] || [];
  return !blocked.includes(action);
}

/**
 * Asserção de Entitlement do Plano SaaS para execução no servidor.
 * Lança erro com mensagem cordial e explicativa caso o plano não contemple o recurso.
 */
export function assertPlanEntitlement(planTier: PlanTier, actionOrModule: TeoClassAction | TeoClassModule): void {
  // Se for módulo
  if (
    actionOrModule === "ead" ||
    actionOrModule === "provas" ||
    actionOrModule === "portal_aluno" ||
    actionOrModule === "financeiro" ||
    actionOrModule === "certificados" ||
    actionOrModule === "captacao"
  ) {
    if (!hasPlanModuleAccess(planTier, actionOrModule as TeoClassModule)) {
      throw new Error(
        `Recurso indisponível: o módulo '${actionOrModule}' não faz parte do plano contratado (${planTier.toUpperCase()}). Solicite um upgrade para Gestão + EAD.`
      );
    }
  }

  // Se for ação granular
  if (!hasPlanActionAccess(planTier, actionOrModule as TeoClassAction)) {
    throw new Error(
      `Operação não permitida no plano '${planTier.toUpperCase()}'. Este recurso requer o plano 'Gestão + EAD' ou superior.`
    );
  }
}
