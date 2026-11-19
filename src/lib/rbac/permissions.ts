import type { TeoClassRole, PlanTier } from "@/types/database";

export type { TeoClassRole, PlanTier };

/**
 * Módulos do Sistema TeoClass
 */
export type TeoClassModule =
  | "inicio"
  | "secretaria"
  | "academico"
  | "portal_aluno"
  | "ead"
  | "provas"
  | "financeiro"
  | "certificados"
  | "captacao"
  | "configuracoes";

/**
 * Ações granulares para verificação em Server Actions / APIs
 */
export type TeoClassAction =
  // Secretaria
  | "secretaria:view"
  | "secretaria:manage_students"
  | "secretaria:manage_enrollments"
  // Acadêmico
  | "academico:view"
  | "academico:manage_courses"
  | "academico:manage_classes"
  | "academico:manage_curriculum"
  | "academico:manage_teachers"
  | "academico:record_grades"
  | "academico:record_attendance"
  // EAD & Provas
  | "ead:access_lessons"
  | "ead:manage_content"
  | "provas:attempt"
  | "provas:manage_bank"
  | "provas:grade"
  // Financeiro Escolar
  | "financeiro:view"
  | "financeiro:manage_receivables"
  | "financeiro:record_payments"
  | "financeiro:configure_gateway"
  // Certificados
  | "certificados:issue"
  | "certificados:revoke"
  | "certificados:view"
  // Captação de Alunos & Leads
  | "captacao:view"
  | "captacao:manage_leads"
  | "captacao:configure"
  // Configurações e Administração
  | "config:manage_institution"
  | "config:manage_team"
  | "config:manage_plans";

export interface RoleConfig {
  role: TeoClassRole;
  label: string;
  description: string;
  allowedModules: TeoClassModule[];
  allowedActions: TeoClassAction[];
}

/**
 * Matriz Centralizada de RBAC do TeoClass
 * Princípio fundamental: DEFAULT-DENY. Nenhuma permissão é concedida a menos que explicitada.
 */
export const ROLE_DEFINITIONS: Record<TeoClassRole, RoleConfig> = {
  admin: {
    role: "admin",
    label: "Administrador Institucional",
    description: "Gestão completa da instituição, equipe, configurações, financeiro e acadêmico.",
    allowedModules: [
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
    allowedActions: [
      "secretaria:view",
      "secretaria:manage_students",
      "secretaria:manage_enrollments",
      "academico:view",
      "academico:manage_courses",
      "academico:manage_classes",
      "academico:manage_curriculum",
      "academico:manage_teachers",
      "academico:record_grades",
      "academico:record_attendance",
      "ead:access_lessons",
      "ead:manage_content",
      "provas:attempt",
      "provas:manage_bank",
      "provas:grade",
      "financeiro:view",
      "financeiro:manage_receivables",
      "financeiro:record_payments",
      "financeiro:configure_gateway",
      "certificados:issue",
      "certificados:revoke",
      "certificados:view",
      "captacao:view",
      "captacao:manage_leads",
      "captacao:configure",
      "config:manage_institution",
      "config:manage_team",
      "config:manage_plans",
    ],
  },
  secretaria: {
    role: "secretaria",
    label: "Secretaria Acadêmica",
    description: "Gestão de alunos, cadastros, cursos, turmas, matrículas e emissão de certificados.",
    allowedModules: [
      "inicio",
      "secretaria",
      "academico",
      "certificados",
      "captacao",
    ],
    allowedActions: [
      "secretaria:view",
      "secretaria:manage_students",
      "secretaria:manage_enrollments",
      "academico:view",
      "academico:manage_courses",
      "academico:manage_classes",
      "academico:manage_curriculum",
      "academico:manage_teachers",
      "academico:record_attendance",
      "certificados:issue",
      "certificados:view",
      "captacao:view",
      "captacao:manage_leads",
    ],
  },
  financeiro: {
    role: "financeiro",
    label: "Gestão Financeira Escolar",
    description: "Controle de mensalidades, contas a receber, conciliação e relatórios financeiros.",
    allowedModules: [
      "inicio",
      "financeiro",
    ],
    allowedActions: [
      "financeiro:view",
      "financeiro:manage_receivables",
      "financeiro:record_payments",
    ],
  },
  professor: {
    role: "professor",
    label: "Professor / Corpo Docente",
    description: "Acesso estrito às turmas, aulas atribuídas, frequência, notas e provas.",
    allowedModules: [
      "inicio",
      "academico",
      "ead",
      "provas",
    ],
    allowedActions: [
      "academico:view",
      "academico:record_grades",
      "academico:record_attendance",
      "ead:access_lessons",
      "ead:manage_content",
      "provas:manage_bank",
      "provas:grade",
    ],
  },
  aluno: {
    role: "aluno",
    label: "Aluno / Discente",
    description: "Acesso pessoal ao portal do aluno, suas aulas, notas, frequência e certificados.",
    allowedModules: [
      "inicio",
      "portal_aluno",
      "ead",
      "provas",
      "certificados",
    ],
    allowedActions: [
      "ead:access_lessons",
      "provas:attempt",
      "certificados:view",
    ],
  },
};

/**
 * Avalia se um papel possui permissão para acessar determinado módulo.
 */
export function hasModuleAccess(role: TeoClassRole, module: TeoClassModule): boolean {
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) return false;
  return definition.allowedModules.includes(module);
}

/**
 * Avalia se um papel possui permissão para executar uma ação específica.
 */
export function hasActionAccess(role: TeoClassRole, action: TeoClassAction): boolean {
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) return false;
  return definition.allowedActions.includes(action);
}

/**
 * Asserção de permissão para uso direto no servidor.
 * Lança erro caso a ação não seja autorizada.
 */
export function assertPermission(role: TeoClassRole, action: TeoClassAction): void {
  if (!hasActionAccess(role, action)) {
    throw new Error(`Acesso negado: o perfil '${role}' não tem permissão para '${action}'.`);
  }
}
