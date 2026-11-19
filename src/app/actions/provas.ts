"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { assertPlanEntitlement } from "@/lib/rbac/entitlements";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  AssessmentQuestion,
  AssessmentQuestionInput,
  Assessment,
  AssessmentInput,
  AssessmentAttempt,
  SubmitAttemptInput,
  SnapshotQuestion,
} from "@/types/provas";

/**
 * Utilitário interno para operações protegidas do servidor que requerem privilégios mínimos
 * ou correção cega de gabaritos sem expor dados ao cliente.
 */
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ==============================================================================
// 1. BANCO DE QUESTÕES (assessment_questions & question_options)
// ==============================================================================

/**
 * Consulta questões do banco por disciplina
 */
export async function getAssessmentQuestionsAction(
  subjectId: string
): Promise<{ data: AssessmentQuestion[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "provas");
    assertPermission(session.role, "provas:manage_bank");

    const supabase = await createClient();
    const { data, error } = await (supabase.from("assessment_questions") as any)
      .select("*, options:question_options(*)")
      .eq("tenant_id", session.tenant.id)
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    console.error("getAssessmentQuestionsAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar banco de questões." };
  }
}

/**
 * Cria ou atualiza uma questão com suas alternativas
 */
export async function saveAssessmentQuestionAction(
  input: AssessmentQuestionInput,
  questionId?: string
): Promise<{ success: boolean; data?: AssessmentQuestion; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "provas");
    assertPermission(session.role, "provas:manage_bank");

    if (!input.prompt || input.prompt.trim().length < 3) {
      return { success: false, error: "O enunciado da questão é obrigatório." };
    }
    if (!input.subject_id) {
      return { success: false, error: "A disciplina vinculada é obrigatória." };
    }
    if (!input.options || input.options.length < 2) {
      return { success: false, error: "A questão deve ter pelo menos duas alternativas." };
    }

    const correctCount = input.options.filter((o) => o.is_correct).length;
    if (correctCount === 0) {
      return { success: false, error: "Defina ao menos uma alternativa correta como gabarito." };
    }
    if (input.question_type === "verdadeiro_falso" && input.options.length !== 2) {
      return { success: false, error: "Questões de Verdadeiro ou Falso devem conter exatamente 2 opções." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(questionId);

    // Validação de atribuição docente
    if (session.role === "professor") {
      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: input.subject_id,
        }
      );
      if (!hasAssignment) {
        return {
          success: false,
          error: "Acesso negado: Você não possui atribuição docente ativa nesta matéria.",
        };
      }
    }

    const admin = getAdminSupabase();
    let savedQuestionId = questionId;

    if (isEdit && questionId) {
      const { error: qErr } = await (admin.from("assessment_questions") as any)
        .update({
          question_type: input.question_type,
          prompt: input.prompt.trim(),
          explanation: input.explanation?.trim() || null,
          points: Number(input.points) || 1.0,
          is_active: input.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .eq("tenant_id", session.tenant.id);

      if (qErr) throw qErr;

      // Exclui alternativas antigas e reinsere
      await (admin.from("question_options") as any)
        .delete()
        .eq("question_id", questionId)
        .eq("tenant_id", session.tenant.id);
    } else {
      const { data: newQ, error: qErr } = await (admin.from("assessment_questions") as any)
        .insert({
          tenant_id: session.tenant.id,
          subject_id: input.subject_id,
          question_type: input.question_type,
          prompt: input.prompt.trim(),
          explanation: input.explanation?.trim() || null,
          points: Number(input.points) || 1.0,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (qErr || !newQ) throw qErr;
      savedQuestionId = newQ.id;
    }

    // Insere alternativas
    const optionsPayload = input.options.map((opt, idx) => ({
      tenant_id: session.tenant.id,
      question_id: savedQuestionId,
      option_text: opt.option_text.trim(),
      is_correct: Boolean(opt.is_correct),
      order_index: opt.order_index ?? idx + 1,
    }));

    const { error: optErr } = await (admin.from("question_options") as any)
      .insert(optionsPayload);
    if (optErr) throw optErr;

    // Busca questão completa atualizada
    const { data: fullQuestion } = await (admin.from("assessment_questions") as any)
      .select("*, options:question_options(*)")
      .eq("id", savedQuestionId)
      .single();

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: isEdit ? "QUESTION_UPDATED" : "QUESTION_CREATED",
      resourceType: "assessment_questions",
      resourceId: savedQuestionId!,
      details: { prompt: input.prompt, type: input.question_type },
    });

    revalidatePath("/app/provas");
    return { success: true, data: fullQuestion };
  } catch (err: any) {
    console.error("saveAssessmentQuestionAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar questão no banco." };
  }
}

// ==============================================================================
// 2. AVALIAÇÕES / PROVAS CONFIGURÁVEIS (assessments)
// ==============================================================================

/**
 * Consulta avaliações da disciplina ou ativas para o aluno
 */
export async function getAssessmentsAction(
  subjectId?: string
): Promise<{ data: Assessment[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    const supabase = await createClient();

    let query = (supabase.from("assessments") as any)
      .select("*, subject:subjects(id, name, code), school_class:classes(id, name)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false });

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Se aluno, computar tentativas e melhor nota
    if (session.role === "aluno") {
      const { data: student } = await (supabase.from("students") as any)
        .select("id")
        .eq("user_id", session.user.id)
        .eq("tenant_id", session.tenant.id)
        .single();

      if (student) {
        const { data: attempts } = await (supabase.from("assessment_attempts") as any)
          .select("id, assessment_id, attempt_number, total_score, status, passed")
          .eq("student_id", student.id)
          .eq("tenant_id", session.tenant.id);

        const attemptsByAssessment: Record<string, any[]> = {};
        (attempts || []).forEach((att: any) => {
          if (!attemptsByAssessment[att.assessment_id]) {
            attemptsByAssessment[att.assessment_id] = [];
          }
          attemptsByAssessment[att.assessment_id].push(att);
        });

        const enriched = (data || []).map((ass: any) => {
          const userAttempts = attemptsByAssessment[ass.id] || [];
          const bestScore = userAttempts.reduce(
            (max, a) => (a.total_score != null && a.total_score > max ? a.total_score : max),
            0
          );
          const activeAttempt = userAttempts.find((a) => a.status === "em_andamento");
          const canAttempt = userAttempts.length < ass.max_attempts || Boolean(activeAttempt);

          return {
            ...ass,
            user_attempts_count: userAttempts.length,
            user_best_score: userAttempts.length > 0 ? bestScore : null,
            user_can_attempt: canAttempt,
          };
        });

        return { data: enriched, error: null };
      }
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("getAssessmentsAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar avaliações." };
  }
}

/**
 * Cria ou edita uma avaliação
 */
export async function saveAssessmentAction(
  input: AssessmentInput,
  assessmentId?: string
): Promise<{ success: boolean; data?: Assessment; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "provas");
    assertPermission(session.role, "provas:manage_bank");

    if (!input.title || input.title.trim().length < 3) {
      return { success: false, error: "O título da avaliação é obrigatório." };
    }
    if (!input.subject_id) {
      return { success: false, error: "A disciplina vinculada é obrigatória." };
    }
    if (input.questions_count <= 0) {
      return { success: false, error: "A quantidade de questões deve ser maior que zero." };
    }
    if (input.duration_minutes <= 0) {
      return { success: false, error: "A duração da prova deve ser maior que zero minutos." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(assessmentId);

    // Validação docente
    if (session.role === "professor") {
      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: input.subject_id,
        }
      );
      if (!hasAssignment) {
        return {
          success: false,
          error: "Acesso negado: Você não possui atribuição docente ativa nesta disciplina.",
        };
      }
    }

    // Se turma informada, valida integridade curricular (mesmo curso da disciplina)
    if (input.class_id) {
      const [classRes, subjectRes] = await Promise.all([
        (supabase.from("classes") as any)
          .select("course_id")
          .eq("id", input.class_id)
          .eq("tenant_id", session.tenant.id)
          .single(),
        (supabase.from("subjects") as any)
          .select("course_id")
          .eq("id", input.subject_id)
          .eq("tenant_id", session.tenant.id)
          .single(),
      ]);

      if (classRes.data?.course_id !== subjectRes.data?.course_id) {
        return {
          success: false,
          error: "Incoerência curricular: A turma e a disciplina selecionadas pertencem a cursos diferentes.",
        };
      }
    }

    const payload: any = {
      subject_id: input.subject_id,
      class_id: input.class_id || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      questions_count: Number(input.questions_count),
      duration_minutes: Number(input.duration_minutes),
      max_attempts: Number(input.max_attempts) || 1,
      passing_grade: Number(input.passing_grade) || 7.0,
      shuffle_questions: input.shuffle_questions ?? true,
      shuffle_options: input.shuffle_options ?? true,
      release_answer_key: input.release_answer_key ?? false,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultAssessment: Assessment;

    if (isEdit && assessmentId) {
      const { data, error } = await (supabase.from("assessments") as any)
        .update(payload)
        .eq("id", assessmentId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultAssessment = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "ASSESSMENT_UPDATED",
        resourceType: "assessments",
        resourceId: assessmentId,
        details: { title: payload.title, subject_id: payload.subject_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("assessments") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultAssessment = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "ASSESSMENT_CREATED",
        resourceType: "assessments",
        resourceId: resultAssessment.id,
        details: { title: payload.title, subject_id: payload.subject_id },
      });
    }

    revalidatePath("/app/provas");
    return { success: true, data: resultAssessment };
  } catch (err: any) {
    console.error("saveAssessmentAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar avaliação." };
  }
}

// ==============================================================================
// 3. TENTATIVAS DE AVALIAÇÃO DO ALUNO (assessment_attempts & attempt_answers)
// ==============================================================================

/**
 * Inicia uma nova tentativa de avaliação com seleção aleatória de questões e alternativas embaralhadas.
 * GABARITO NÃO É EXPOSTO no snapshot retornado.
 */
export async function startAssessmentAttemptAction(
  assessmentId: string
): Promise<{ success: boolean; data?: AssessmentAttempt; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "provas");
    assertPermission(session.role, "provas:attempt");

    const supabase = await createClient();
    const admin = getAdminSupabase();

    // 1. Localiza avaliação
    const { data: assessment, error: aErr } = await (supabase.from("assessments") as any)
      .select("*")
      .eq("id", assessmentId)
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .single();

    if (aErr || !assessment) {
      return { success: false, error: "Avaliação não encontrada ou inativa." };
    }

    // 2. Identifica aluno autenticado e matrícula ativa
    const { data: student, error: sErr } = await (supabase.from("students") as any)
      .select("id")
      .eq("user_id", session.user.id)
      .eq("tenant_id", session.tenant.id)
      .single();

    if (sErr || !student) {
      return { success: false, error: "Registro de aluno não localizado para seu usuário." };
    }

    // Busca matrícula no curso da disciplina
    const { data: enrollment, error: eErr } = await (admin.from("enrollments") as any)
      .select("id, class_id")
      .eq("tenant_id", session.tenant.id)
      .eq("student_id", student.id)
      .in("status", ["ativa", "concluida"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (eErr || !enrollment) {
      return { success: false, error: "Você não possui matrícula ativa vinculada a este curso." };
    }

    // 3. Verifica tentativas anteriores
    const { data: existingAttempts } = await (admin.from("assessment_attempts") as any)
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("assessment_id", assessmentId)
      .eq("student_id", student.id);

    // Se já houver tentativa em andamento não expirada, retoma ela
    const activeAttempt = (existingAttempts || []).find((att: any) => {
      if (att.status !== "em_andamento") return false;
      const isExpired = new Date(att.expires_at).getTime() < Date.now();
      return !isExpired;
    });

    if (activeAttempt) {
      return { success: true, data: activeAttempt };
    }

    // Verifica se excedeu limite de tentativas
    const totalAttempts = (existingAttempts || []).length;
    if (totalAttempts >= assessment.max_attempts) {
      return {
        success: false,
        error: `Você atingiu o limite máximo de ${assessment.max_attempts} tentativa(s) permitida(s).`,
      };
    }

    // 4. Seleção aleatória de questões do banco (via admin para ler banco completo)
    const { data: availableQuestions, error: qErr } = await (admin.from("assessment_questions") as any)
      .select("id, prompt, question_type, points, explanation, options:question_options(id, option_text, is_correct, order_index)")
      .eq("tenant_id", session.tenant.id)
      .eq("subject_id", assessment.subject_id)
      .eq("is_active", true);

    if (qErr || !availableQuestions || availableQuestions.length === 0) {
      return { success: false, error: "Não há questões cadastradas nesta disciplina para gerar a prova." };
    }

    // Embaralha questões se configurado
    let selectedQuestions = [...availableQuestions];
    if (assessment.shuffle_questions) {
      selectedQuestions.sort(() => Math.random() - 0.5);
    }
    selectedQuestions = selectedQuestions.slice(0, assessment.questions_count);

    // Monta snapshot congelado SEM revelar is_correct para o aluno
    const snapshotQuestions: SnapshotQuestion[] = selectedQuestions.map((q) => {
      let opts = [...(q.options || [])];
      if (assessment.shuffle_options) {
        opts.sort(() => Math.random() - 0.5);
      }

      return {
        id: q.id,
        prompt: q.prompt,
        question_type: q.question_type,
        points: q.points,
        // Oculta explanation do aluno durante a tentativa
        explanation: null,
        options: opts.map((opt, oIdx) => ({
          id: opt.id,
          option_text: opt.option_text,
          order_index: oIdx + 1,
          // GABARITO NÃO EXPOSTO:
          is_correct: undefined,
        })),
      };
    });

    // 5. Calcula prazo estrito de expiração
    const now = new Date();
    const expiresAt = new Date(now.getTime() + assessment.duration_minutes * 60 * 1000);

    const { data: newAttempt, error: insErr } = await (admin.from("assessment_attempts") as any)
      .insert({
        tenant_id: session.tenant.id,
        assessment_id: assessmentId,
        student_id: student.id,
        enrollment_id: enrollment.id,
        attempt_number: totalAttempts + 1,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "em_andamento",
        snapshot_questions: snapshotQuestions,
      })
      .select()
      .single();

    if (insErr || !newAttempt) throw insErr;

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ASSESSMENT_ATTEMPT_STARTED",
      resourceType: "assessment_attempts",
      resourceId: newAttempt.id,
      details: {
        assessment_id: assessmentId,
        attempt_number: newAttempt.attempt_number,
        questions_count: snapshotQuestions.length,
      },
    });

    return { success: true, data: newAttempt };
  } catch (err: any) {
    console.error("startAssessmentAttemptAction error:", err);
    return { success: false, error: err?.message || "Erro ao iniciar tentativa de avaliação." };
  }
}

/**
 * Submete a tentativa de avaliação para correção automática no servidor.
 * Calcula a nota real confrontando com o banco de alternativas e congela o resultado.
 */
export async function submitAssessmentAttemptAction(
  input: SubmitAttemptInput
): Promise<{ success: boolean; data?: AssessmentAttempt; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "provas");
    assertPermission(session.role, "provas:attempt");

    const admin = getAdminSupabase();

    // 1. Busca tentativa
    const { data: attempt, error: attErr } = await (admin.from("assessment_attempts") as any)
      .select("*, assessment:assessments(*)")
      .eq("id", input.attempt_id)
      .eq("tenant_id", session.tenant.id)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Tentativa de avaliação não localizada." };
    }

    if (attempt.status !== "em_andamento") {
      return { success: false, error: "Esta tentativa já foi finalizada ou expirou." };
    }

    // 2. Valida expiração de tempo com tolerância de 30s para latência de rede
    const now = Date.now();
    const expiryTime = new Date(attempt.expires_at).getTime() + 30000;
    const isExpired = now > expiryTime;

    const assessment = attempt.assessment;
    const snapshotQuestions: SnapshotQuestion[] = attempt.snapshot_questions || [];

    // Mapeamento de respostas enviadas
    const submittedMap = new Map<string, string>();
    input.answers.forEach((ans) => {
      submittedMap.set(ans.question_id, ans.selected_option_id);
    });

    // 3. Busca alternativas corretas no banco pelo admin para correção cega
    const questionIds = snapshotQuestions.map((q) => q.id);
    const { data: correctOptions } = await (admin.from("question_options") as any)
      .select("id, question_id, is_correct")
      .in("question_id", questionIds)
      .eq("is_correct", true)
      .eq("tenant_id", session.tenant.id);

    const correctOptionByQuestion = new Map<string, string>();
    (correctOptions || []).forEach((opt: any) => {
      correctOptionByQuestion.set(opt.question_id, opt.id);
    });

    // 4. Computa pontuação questão a questão
    let totalScore = 0.0;
    let maxPossibleScore = 0.0;
    const answersPayload: any[] = [];

    snapshotQuestions.forEach((q) => {
      const qPoints = Number(q.points) || 1.0;
      maxPossibleScore += qPoints;

      const chosenOptionId = submittedMap.get(q.id);
      const correctOptionId = correctOptionByQuestion.get(q.id);
      const isCorrect = Boolean(chosenOptionId && chosenOptionId === correctOptionId);

      const scoreEarned = isCorrect ? qPoints : 0.0;
      totalScore += scoreEarned;

      if (chosenOptionId) {
        answersPayload.push({
          tenant_id: session.tenant.id,
          attempt_id: attempt.id,
          question_id: q.id,
          selected_option_id: chosenOptionId,
          is_correct: isCorrect,
          score_earned: scoreEarned,
        });
      }
    });

    // Converte nota para escala 0 a 10 se maxPossibleScore > 0
    const normalizedScore =
      maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 10 : 0.0;
    const finalScoreRounded = Math.round(normalizedScore * 100) / 100;
    const passed = finalScoreRounded >= (assessment?.passing_grade ?? 7.0);

    // 5. Persiste respostas registradas
    if (answersPayload.length > 0) {
      await (admin.from("attempt_answers") as any).upsert(answersPayload);
    }

    // 6. Atualiza tentativa com nota e status
    const finalStatus = isExpired ? "expirada" : "submetida";
    const { data: updatedAttempt, error: updErr } = await (admin.from("assessment_attempts") as any)
      .update({
        status: finalStatus,
        submitted_at: new Date().toISOString(),
        total_score: finalScoreRounded,
        passed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .select()
      .single();

    if (updErr || !updatedAttempt) throw updErr;

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ASSESSMENT_ATTEMPT_SUBMITTED",
      resourceType: "assessment_attempts",
      resourceId: attempt.id,
      details: {
        score: finalScoreRounded,
        passed,
        status: finalStatus,
      },
    });

    revalidatePath("/app/provas");
    return { success: true, data: updatedAttempt };
  } catch (err: any) {
    console.error("submitAssessmentAttemptAction error:", err);
    return { success: false, error: err?.message || "Erro ao corrigir e finalizar avaliação." };
  }
}
