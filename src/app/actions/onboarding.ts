"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import type { OnboardingProgressDTO, OnboardingStep } from "@/types/onboarding";

/**
 * Consulta o Progresso Real do Onboarding de 4 Passos da Escola
 * RBAC: Acessível por Administrador ou Secretaria no Dashboard
 */
export async function getOnboardingProgressAction(): Promise<{
  data: OnboardingProgressDTO | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "inicio" as any);

    const supabase = await createClient();

    // 1. Busca dados cadastrais e configurações do tenant ativo
    const { data: tenant, error: tErr } = await (supabase.from("tenants") as any)
      .select("id, name, email, phone, settings")
      .eq("id", session.tenant.id)
      .single();

    if (tErr || !tenant) {
      throw new Error("Falha ao carregar dados da instituição.");
    }

    // 2. Consultas paralelas para verificar a conclusão das 4 etapas
    const [coursesRes, classesRes, publicPageRes] = await Promise.all([
      // Etapa 2: Primeiro Curso cadastrado
      (supabase.from("courses") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id),

      // Etapa 3: Primeira Turma cadastrada
      (supabase.from("classes") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id),

      // Etapa 4: Página pública configurada e publicada
      (supabase.from("public_page_settings") as any)
        .select("is_published")
        .eq("tenant_id", session.tenant.id)
        .maybeSingle(),
    ]);

    // Etapa 1: Dados Institucionais (nome personalizado além do padrão e contato preenchido)
    const hasContactInfo = Boolean(tenant.email || tenant.phone);
    const hasCustomName = Boolean(tenant.name && !tenant.name.toLowerCase().startsWith("nova instituição"));
    const step1Completed = hasContactInfo && hasCustomName;

    // Etapa 2: Cursos > 0
    const step2Completed = (coursesRes.count || 0) > 0;

    // Etapa 3: Turmas > 0
    const step3Completed = (classesRes.count || 0) > 0;

    // Etapa 4: Página pública publicada
    const step4Completed = Boolean(publicPageRes.data?.is_published);

    const steps: OnboardingStep[] = [
      {
        id: "dados_escola",
        title: "1. Identidade & Dados da Escola",
        description: "Configure nome oficial, logotipo, contatos e endereço da instituição.",
        href: "/app/configuracoes",
        isCompleted: step1Completed,
        actionLabel: step1Completed ? "Revisar Dados" : "Configurar Escola",
      },
      {
        id: "primeiro_curso",
        title: "2. Cadastro do Primeiro Curso",
        description: "Crie a primeira formação teológica simples ou estruturada da escola.",
        href: "/app/academico",
        isCompleted: step2Completed,
        actionLabel: step2Completed ? "Ver Cursos" : "Cadastrar Curso",
      },
      {
        id: "primeira_turma",
        title: "3. Abertura da Primeira Turma",
        description: "Abra uma turma com período letivo para receber as primeiras matrículas.",
        href: "/app/academico",
        isCompleted: step3Completed,
        actionLabel: step3Completed ? "Ver Turmas" : "Criar Turma",
      },
      {
        id: "pagina_publica",
        title: "4. Ativação da Página Pública & IA",
        description: "Publique o catálogo na internet e habilite o assistente de captação de leads.",
        href: "/app/captacao",
        isCompleted: step4Completed,
        actionLabel: step4Completed ? "Ver Captação" : "Publicar Página",
      },
    ];

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalSteps = steps.length;
    const percent = Math.round((completedCount / totalSteps) * 100);
    const isAllCompleted = completedCount === totalSteps;

    // Verifica se o usuário optou por dispensar a exibição no dashboard
    const tenantSettings = (tenant.settings as Record<string, any>) || {};
    const isDismissed = Boolean(tenantSettings.onboarding_dismissed);

    return {
      data: {
        isDismissed,
        isAllCompleted,
        completedCount,
        totalSteps,
        percent,
        steps,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message || "Erro ao consultar progresso do onboarding." };
  }
}

/**
 * Alterna a visualização do card de onboarding no Dashboard
 * RBAC: Restrito a Administrador ou Secretaria
 * Blindagem: Permite atualizar ESTRITAMENTE a chave 'onboarding_dismissed' do JSONB settings,
 * preservando todas as demais configurações institucionais sem permitir sobrescrita arbitrária.
 */
export async function toggleDismissOnboardingAction(
  dismiss: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "inicio" as any);

    if (session.role === "aluno" || session.role === "professor") {
      return { success: false, error: "Acesso negado: perfil sem autorização para alterar visualização do onboarding." };
    }

    const supabase = await createClient();

    // 1. Busca settings atuais para fusão segura
    const { data: tenant, error: fetchErr } = await (supabase.from("tenants") as any)
      .select("settings")
      .eq("id", session.tenant.id)
      .single();

    if (fetchErr) {
      throw new Error(`Falha ao carregar configurações: ${fetchErr.message}`);
    }

    const currentSettings = (tenant?.settings as Record<string, any>) || {};
    
    // Fusão atômica estrita: atualiza APENAS onboarding_dismissed
    const safeSettings = {
      ...currentSettings,
      onboarding_dismissed: Boolean(dismiss),
    };

    const { error: updErr } = await (supabase.from("tenants") as any)
      .update({
        settings: safeSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.tenant.id);

    if (updErr) throw updErr;

    revalidatePath("/app/dashboard");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao atualizar preferência de onboarding." };
  }
}
