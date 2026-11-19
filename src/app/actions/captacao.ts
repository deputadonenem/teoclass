"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  sanitizeUserInput,
  detectPromptInjection,
  buildInstitutionalSystemPrompt,
  callOpenAIAgent,
} from "@/lib/captacao/agent";
import { getClientOriginHash, checkAtomicRateLimit } from "@/lib/captacao/rate-limiter";
import type {
  PublicSchoolInfo,
  SubmitLeadDTO,
  ChatRequestDTO,
  Lead,
  PublicPageSettings,
} from "@/types/captacao";

/**
 * Consulta as Informações Públicas da Escola por Slug (Acesso Público Anônimo)
 */
export async function getPublicSchoolInfoAction(slug: string): Promise<{
  data: PublicSchoolInfo | null;
  error: string | null;
}> {
  try {
    if (!slug || slug.trim() === "") {
      return { data: null, error: "Identificador da escola não informado." };
    }

    const cleanSlug = slug.trim().toLowerCase();
    const admin = createAdminClient();

    // 1. Busca dados cadastrais do tenant ativo estritamente por slug
    const { data: tenant, error: tErr } = await (admin.from("tenants") as any)
      .select("id, name, trade_name, slug, email, phone, status")
      .eq("slug", cleanSlug)
      .eq("status", "active")
      .single();

    if (tErr || !tenant) {
      return { data: null, error: "Escola teológica não encontrada ou inativa." };
    }

    // 2. Busca configurações da página pública
    const { data: rawSettings } = await (admin.from("public_page_settings") as any)
      .select("*")
      .eq("tenant_id", tenant.id)
      .single();

    const settings: PublicPageSettings = rawSettings || {
      tenant_id: tenant.id,
      is_published: true,
      show_financial_values: false,
      headline: "Formação Teológica Ministerial",
      subheadline: "Cursos bíblicos e acadêmicos com excelência e fidelidade doutrinária.",
      about_text: "Nossa instituição dedica-se ao ensino fiel das Sagradas Escrituras, capacitando líderes e vocacionados para a igreja e a sociedade.",
      contact_email: tenant.email,
      contact_phone: tenant.phone,
      contact_whatsapp: tenant.phone,
      address_display: null,
      ai_agent_enabled: true,
      ai_agent_name: "Assistente TeoClass",
      ai_agent_welcome_message: "Graça e paz! Sou o assistente virtual da escola. Como posso ajudar você a conhecer nossos cursos teológicos?",
      ai_agent_instructions: "",
      ai_daily_limit_messages: 500,
    };

    if (!settings.is_published) {
      return { data: null, error: "A página pública desta instituição está temporariamente desativada." };
    }

    // 3. Busca cursos ativos (Lista explícita de campos públicos autorizados)
    const { data: coursesData } = await (admin.from("courses") as any)
      .select("id, name, code, description, modality, workload_hours, duration_months, format")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    // 4. Busca planos financeiros de referência SOMENTE se expressamente autorizado
    let plansByCourse = new Map<string, any>();
    if (settings.show_financial_values) {
      const { data: plansData } = await (admin.from("financial_plans") as any)
        .select("course_id, installment_value, installments_count, enrollment_fee")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);

      (plansData || []).forEach((p: any) => {
        if (p.course_id && !plansByCourse.has(p.course_id)) {
          plansByCourse.set(p.course_id, {
            installment_value: Number(p.installment_value),
            installments_count: p.installments_count,
            enrollment_fee: Number(p.enrollment_fee),
          });
        }
      });
    }

    const courses = (coursesData || []).map((c: any) => ({
      ...c,
      price_info: plansByCourse.get(c.id) || null,
    }));

    return {
      data: {
        tenant_id: tenant.id,
        name: tenant.name,
        trade_name: tenant.trade_name,
        slug: tenant.slug,
        settings,
        courses,
      },
      error: null,
    };
  } catch (err: any) {
    console.error("Erro ao carregar página pública:", err);
    return { data: null, error: err.message || "Falha ao carregar informações da instituição." };
  }
}

/**
 * Envia Formulário de Interesse / Lead (Público com Consentimento LGPD)
 * Blindagem: Rate Limiting persistente e atômico no Supabase via check_and_increment_rate_limit
 */
export async function submitPublicLeadAction(dto: SubmitLeadDTO): Promise<{
  success: boolean;
  leadId?: string;
  error: string | null;
}> {
  try {
    if (!dto.school_slug || dto.school_slug.trim() === "") {
      return { success: false, error: "Identificador da escola não informado." };
    }

    const cleanSlug = dto.school_slug.trim().toLowerCase();

    // 1. Validações estritas de dados de entrada
    const fullName = (dto.full_name || "").trim();
    const email = (dto.email || "").trim().toLowerCase();

    if (fullName.length < 2 || fullName.length > 200) {
      return { success: false, error: "Por favor, informe seu nome completo válido." };
    }
    if (email.length < 5 || !email.includes("@") || !email.includes(".")) {
      return { success: false, error: "Por favor, informe um endereço de e-mail válido." };
    }
    if (!dto.lgpd_consent) {
      return { success: false, error: "É obrigatório consentir com o contato da instituição conforme a LGPD." };
    }

    const admin = createAdminClient();

    // 2. Resolve tenant de forma confiável no servidor
    const { data: tenant, error: tErr } = await (admin.from("tenants") as any)
      .select("id, status")
      .eq("slug", cleanSlug)
      .eq("status", "active")
      .single();

    if (tErr || !tenant) {
      return { success: false, error: "Instituição não localizada ou inativa." };
    }

    // 3. Rate Limiting Persistente e Atômico por Origem (Hash SHA-256) e Escola
    const originHash = await getClientOriginHash();
    const originBucketKey = `lead:origin:${originHash.substring(0, 16)}`;
    const { allowed: originAllowed } = await checkAtomicRateLimit(admin, {
      tenantId: tenant.id,
      bucketKey: originBucketKey,
      maxTokens: 5, // máx 5 submissões por origem a cada 10 minutos
      windowSeconds: 600,
    });

    if (!originAllowed) {
      return {
        success: false,
        error: "Muitas solicitações recebidas deste dispositivo. Por favor, aguarde alguns minutos.",
      };
    }

    // Cota Global da Instituição para Leads (máx 500 por hora)
    const schoolBucketKey = `lead:tenant:${tenant.id}`;
    const { allowed: schoolAllowed } = await checkAtomicRateLimit(admin, {
      tenantId: tenant.id,
      bucketKey: schoolBucketKey,
      maxTokens: 500,
      windowSeconds: 3600,
    });

    if (!schoolAllowed) {
      return {
        success: false,
        error: "A instituição atingiu temporariamente o limite de cadastros automáticos. Entre em contato por e-mail.",
      };
    }

    // 4. Valida se course_id (se fornecido) pertence realmente ao tenant
    let validatedCourseId: string | null = null;
    if (dto.course_id) {
      const { data: courseCheck } = await (admin.from("courses") as any)
        .select("id")
        .eq("id", dto.course_id)
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .single();

      if (courseCheck) {
        validatedCourseId = courseCheck.id;
      }
    }

    // 5. Inserção controlada com hash da origem anonimizado
    const { data, error } = await (admin.from("leads") as any)
      .insert({
        tenant_id: tenant.id,
        course_id: validatedCourseId,
        full_name: fullName,
        email: email,
        phone: dto.phone ? dto.phone.trim().substring(0, 30) : null,
        church_name: dto.church_name ? dto.church_name.trim().substring(0, 200) : null,
        notes: dto.notes ? dto.notes.trim().substring(0, 500) : null,
        source: dto.source || "pagina_publica",
        status: "novo",
        origin_hash: originHash,
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, leadId: data.id, error: null };
  } catch (err: any) {
    console.error("Erro ao salvar lead de interesse:", err);
    return { success: false, error: err.message || "Falha ao enviar formulário. Tente novamente." };
  }
}

/**
 * Interação no Chat Público com Agente IA (Público Anônimo com Rate Limiting e Sanitização)
 */
export async function sendPublicChatMessageAction(dto: ChatRequestDTO): Promise<{
  reply: string | null;
  error: string | null;
}> {
  try {
    if (!dto.school_slug || dto.school_slug.trim() === "") {
      return { reply: null, error: "Identificador da escola não informado." };
    }

    const cleanSlug = dto.school_slug.trim().toLowerCase();
    const rawMessage = dto.message || "";
    const cleanMessage = sanitizeUserInput(rawMessage);

    if (cleanMessage.length < 2) {
      return { reply: null, error: "Digite uma mensagem para falar com o assistente." };
    }

    // 1. Prevenção de Prompt Injection
    if (detectPromptInjection(cleanMessage)) {
      return {
        reply: "Desculpe, sou um assistente especializado apenas em informações sobre os cursos teológicos da nossa instituição. Como posso ajudar com dúvidas sobre matrículas e matérias?",
        error: null,
      };
    }

    const admin = createAdminClient();

    // 2. Resolve tenant e configurações ativas no servidor
    const { data: tenant, error: tErr } = await (admin.from("tenants") as any)
      .select("id, name, email, phone, status")
      .eq("slug", cleanSlug)
      .eq("status", "active")
      .single();

    if (tErr || !tenant) {
      return { reply: null, error: "Instituição não localizada." };
    }

    const { data: settings } = await (admin.from("public_page_settings") as any)
      .select("*")
      .eq("tenant_id", tenant.id)
      .single();

    if (settings && !settings.ai_agent_enabled) {
      return {
        reply: "O assistente interativo da escola está temporariamente indisponível. Por favor, envie sua mensagem no formulário de contato abaixo!",
        error: null,
      };
    }

    // 3. Rate Limiting Persistente e Atômico no Banco (Multi-Camadas)
    const originHash = await getClientOriginHash();
    const originKey = `chat_origin:${originHash.substring(0, 16)}`;
    const sessionKey = `chat_sess:${(dto.session_token || "anon").substring(0, 20)}`;
    const dailyKey = `chat_daily:${tenant.id}:${new Date().toISOString().split("T")[0]}`;

    // Camada A: Rate limit de rajada por origem (máx 15 msgs por minuto)
    const { allowed: originAllowed } = await checkAtomicRateLimit(admin, {
      tenantId: tenant.id,
      bucketKey: originKey,
      maxTokens: 15,
      windowSeconds: 60,
    });
    if (!originAllowed) {
      return {
        reply: "Muitas mensagens enviadas em curto intervalo. Aguarde um minuto ou preencha o formulário abaixo!",
        error: null,
      };
    }

    // Camada B: Limite por sessão (máx 30 msgs por sessão de 2 horas)
    const { allowed: sessAllowed } = await checkAtomicRateLimit(admin, {
      tenantId: tenant.id,
      bucketKey: sessionKey,
      maxTokens: 30,
      windowSeconds: 7200,
    });
    if (!sessAllowed) {
      return {
        reply: "Você atingiu o limite de perguntas desta sessão de atendimento. Para prosseguir com sua inscrição ou falar com nossa equipe, por favor preencha o formulário de contato logo abaixo!",
        error: null,
      };
    }

    // Camada C: Cota global diária da instituição (controle de custos)
    const dailyLimit = settings?.ai_daily_limit_messages || 500;
    const { allowed: dailyAllowed } = await checkAtomicRateLimit(admin, {
      tenantId: tenant.id,
      bucketKey: dailyKey,
      maxTokens: dailyLimit,
      windowSeconds: 86400,
    });
    if (!dailyAllowed) {
      return {
        reply: "O assistente atingiu a cota máxima diária de atendimento desta instituição. Por favor, deixe sua mensagem no formulário abaixo que nossa secretaria responderá em breve!",
        error: null,
      };
    }

    // 4. Registra sessão no banco para auditoria
    let sessionId = "";
    const { data: sessionData } = await (admin.from("public_chat_sessions") as any)
      .select("id, messages_count")
      .eq("session_token", dto.session_token)
      .eq("tenant_id", tenant.id)
      .single();

    if (sessionData) {
      sessionId = sessionData.id;
      await (admin.from("public_chat_sessions") as any)
        .update({
          messages_count: sessionData.messages_count + 1,
          last_interaction_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } else {
      const { data: newSession } = await (admin.from("public_chat_sessions") as any)
        .insert({
          tenant_id: tenant.id,
          session_token: dto.session_token,
          origin_hash: originHash,
          messages_count: 1,
        })
        .select("id")
        .single();
      if (newSession) sessionId = newSession.id;
    }

    // 5. Busca catálogo de cursos autorizados
    const { data: courses } = await (admin.from("courses") as any)
      .select("id, name, code, description, modality, workload_hours, duration_months, format")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    let plansByCourse = new Map<string, any>();
    if (settings?.show_financial_values) {
      const { data: plans } = await (admin.from("financial_plans") as any)
        .select("course_id, installment_value, installments_count, enrollment_fee")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);

      (plans || []).forEach((p: any) => {
        if (p.course_id && !plansByCourse.has(p.course_id)) {
          plansByCourse.set(p.course_id, {
            installment_value: Number(p.installment_value),
            installments_count: p.installments_count,
            enrollment_fee: Number(p.enrollment_fee),
          });
        }
      });
    }

    const coursesWithPrice = (courses || []).map((c: any) => ({
      ...c,
      price_info: plansByCourse.get(c.id) || null,
    }));

    // 6. Constrói prompt institucional estrito
    const systemPrompt = buildInstitutionalSystemPrompt({
      schoolName: tenant.name,
      contactEmail: settings?.contact_email || tenant.email || null,
      contactPhone: settings?.contact_phone || tenant.phone || null,
      courses: coursesWithPrice,
      customInstructions: settings?.ai_agent_instructions,
    });

    // 7. Chamada ao agente com fallback automático
    const { reply } = await callOpenAIAgent({
      systemPrompt,
      messages: [{ role: "user", content: cleanMessage }],
    });

    // 8. Grava histórico na sessão (sem PII desnecessário)
    if (sessionId) {
      await (admin.from("public_chat_messages") as any).insert([
        { tenant_id: tenant.id, session_id: sessionId, role: "user", content: cleanMessage },
        { tenant_id: tenant.id, session_id: sessionId, role: "assistant", content: reply },
      ]);
    }

    return { reply, error: null };
  } catch (err: any) {
    console.error("Erro no chat com IA:", err);
    return {
      reply: "Nosso assistente está temporariamente ocupado. Por favor, envie sua mensagem no formulário de interesse da página!",
      error: null,
    };
  }
}

/**
 * Consulta a Lista de Leads Captados (Painel Secretaria / Admin)
 * RBAC: Restrito a Admin e Secretaria do tenant
 */
export async function getLeadsAction(): Promise<{
  data: Lead[];
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "captacao:view" as any);

    if (session.role !== "admin" && session.role !== "secretaria") {
      return { data: [], error: "Acesso negado: apenas secretaria e administradores gerenciam interessados." };
    }

    const supabase = await createClient();

    const { data: leads, error } = await (supabase.from("leads") as any)
      .select(`
        id,
        tenant_id,
        course_id,
        full_name,
        email,
        phone,
        church_name,
        notes,
        source,
        status,
        lgpd_consent,
        lgpd_consent_at,
        created_at,
        course:courses(name)
      `)
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted: Lead[] = (leads || []).map((l: any) => ({
      id: l.id,
      tenant_id: l.tenant_id,
      course_id: l.course_id,
      course_name: l.course?.name || "Geral / Não Definido",
      full_name: l.full_name,
      email: l.email,
      phone: l.phone,
      church_name: l.church_name,
      notes: l.notes,
      source: l.source,
      status: l.status,
      lgpd_consent: l.lgpd_consent,
      lgpd_consent_at: l.lgpd_consent_at,
      created_at: l.created_at,
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    console.error("Erro ao carregar interessados:", err);
    return { data: [], error: err.message || "Falha ao carregar interessados." };
  }
}

/**
 * Atualiza o Status de um Lead (Painel Secretaria / Admin)
 */
export async function updateLeadStatusAction(
  leadId: string,
  newStatus: Lead["status"],
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    if (session.role !== "admin" && session.role !== "secretaria") {
      return { success: false, error: "Acesso negado." };
    }

    const supabase = await createClient();

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) updatePayload.notes = notes;

    const { error } = await (supabase.from("leads") as any)
      .update(updatePayload)
      .eq("id", leadId)
      .eq("tenant_id", session.tenant.id);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Erro ao atualizar lead:", err);
    return { success: false, error: err.message || "Falha ao atualizar interessado." };
  }
}

/**
 * Atualiza as Configurações da Página Pública e IA (Exclusivo Admin)
 */
export async function updatePublicPageSettingsAction(
  settings: Partial<PublicPageSettings>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    if (session.role !== "admin") {
      return { success: false, error: "Apenas administradores podem configurar a página pública e IA." };
    }

    const supabase = await createClient();

    const { error } = await (supabase.from("public_page_settings") as any)
      .upsert({
        tenant_id: session.tenant.id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Erro ao atualizar configurações da página pública:", err);
    return { success: false, error: err.message || "Falha ao salvar configurações." };
  }
}
