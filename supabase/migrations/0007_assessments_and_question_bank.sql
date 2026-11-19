-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0007: BANCO DE QUESTÕES E AVALIAÇÕES DO EAD
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Banco de Questões por Disciplina (assessment_questions):
--    Questões objetivas (múltipla escolha e verdadeiro/falso), pontuação e gabarito.
--    GABARITO NUNCA exposto ao aluno diretamente via SELECT.
-- 2. Alternativas das Questões (question_options):
--    Texto da alternativa, ordem e flag de correta (is_correct).
-- 3. Avaliações / Provas Configuráveis (assessments):
--    Vinculadas à disciplina ou turma, com título, quantidade de questões sorteadas,
--    período de vigência, tempo limite de duração (minutos), limite de tentativas,
--    nota mínima para aprovação e flag para liberar gabarito após conclusão.
-- 4. Tentativas de Prova por Aluno (assessment_attempts):
--    Vinculadas à matrícula e aluno. Registra início, prazo limite de expiração,
--    término, nota final obtida, status (em_andamento, submetida, expirada) e
--    instantâneo congelado das questões e alternativas sorteadas para garantir
--    auditabilidade estrita (anti-adulteração de histórico).
-- 5. Respostas da Tentativa (attempt_answers):
--    Registra a alternativa selecionada pelo aluno para cada questão sorteada.
-- 6. Imutabilidade de tenant_id em todas as tabelas via prevent_tenant_id_change().
-- 7. RLS Default-Deny:
--    - Admin e Secretaria: visualização e gestão institucional.
--    - Professores: gestão de banco e provas das disciplinas/turmas atribuídas.
--    - Alunos: consulta das provas ativas de sua matrícula, tentativa própria,
--      sem acesso a alternativas corretas (gabarito) antes da correção e liberação.
-- ==============================================================================

-- ==============================================================================
-- 1. PREPARAÇÃO: CONSTRAINT CANDIDATA COMPOSTA EM ENROLLMENTS
-- ==============================================================================
-- Adiciona constraint candidata composta (tenant_id, id) em enrollments para suportar
-- integridade referencial estrita multi-tenant em assessment_attempts
ALTER TABLE public.enrollments
    ADD CONSTRAINT uq_enrollments_tenant_id UNIQUE (tenant_id, id);


-- ==============================================================================
-- 2. TABELA DE QUESTÕES (assessment_questions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL,
    question_type VARCHAR(30) NOT NULL DEFAULT 'multipla_escolha'
        CHECK (question_type IN ('multipla_escolha', 'verdadeiro_falso')),
    prompt TEXT NOT NULL, -- Enunciado teológico da questão
    explanation TEXT, -- Comentário / justificativa exegética exibida após correção autorizada
    points NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (points > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para subject
    CONSTRAINT fk_assessment_questions_subject
        FOREIGN KEY (tenant_id, subject_id)
        REFERENCES public.subjects(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_assessment_questions_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assessment_questions_tenant ON public.assessment_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_subject ON public.assessment_questions(tenant_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_active ON public.assessment_questions(tenant_id, is_active);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_assessment_questions_tenant_immutable ON public.assessment_questions;
CREATE TRIGGER trg_assessment_questions_tenant_immutable
    BEFORE UPDATE ON public.assessment_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 2. TABELA DE ALTERNATIVAS (question_options)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para question
    CONSTRAINT fk_question_options_question
        FOREIGN KEY (tenant_id, question_id)
        REFERENCES public.assessment_questions(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_question_options_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_question_options_tenant ON public.question_options(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON public.question_options(tenant_id, question_id);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_question_options_tenant_immutable ON public.question_options;
CREATE TRIGGER trg_question_options_tenant_immutable
    BEFORE UPDATE ON public.question_options
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 3. TABELA DE AVALIAÇÕES / PROVAS (assessments)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL,
    class_id UUID, -- Opcional: restringe a avaliação a uma turma específica
    title VARCHAR(200) NOT NULL,
    description TEXT,
    questions_count INT NOT NULL DEFAULT 10 CHECK (questions_count > 0),
    duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    max_attempts INT NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
    passing_grade NUMERIC(5,2) NOT NULL DEFAULT 7.00 CHECK (passing_grade >= 0 AND passing_grade <= 100),
    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
    release_answer_key BOOLEAN NOT NULL DEFAULT FALSE, -- Liberar gabarito após término da tentativa
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para subject
    CONSTRAINT fk_assessments_subject
        FOREIGN KEY (tenant_id, subject_id)
        REFERENCES public.subjects(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para class (opcional)
    CONSTRAINT fk_assessments_class
        FOREIGN KEY (tenant_id, class_id)
        REFERENCES public.classes(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_assessments_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON public.assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_subject ON public.assessments(tenant_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON public.assessments(tenant_id, class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_active ON public.assessments(tenant_id, is_active);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_assessments_tenant_immutable ON public.assessments;
CREATE TRIGGER trg_assessments_tenant_immutable
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 4. TABELA DE TENTATIVAS DE AVALIAÇÃO (assessment_attempts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL,
    student_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL, -- Prazo limite estrito calculado no servidor
    submitted_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'em_andamento'
        CHECK (status IN ('em_andamento', 'submetida', 'expirada')),
    total_score NUMERIC(5,2) DEFAULT NULL, -- Nota calculada no servidor
    passed BOOLEAN DEFAULT NULL, -- Se atingiu nota mínima
    -- Congelamento das questões e alternativas sorteadas na tentativa (Anti-fraude e auditoria)
    snapshot_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FKs compostas
    CONSTRAINT fk_assessment_attempts_assessment
        FOREIGN KEY (tenant_id, assessment_id)
        REFERENCES public.assessments(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_assessment_attempts_student
        FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_assessment_attempts_enrollment
        FOREIGN KEY (tenant_id, enrollment_id)
        REFERENCES public.enrollments(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_assessment_attempts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_assessment_attempts_student_attempt UNIQUE (tenant_id, assessment_id, enrollment_id, attempt_number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_tenant ON public.assessment_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON public.assessment_attempts(tenant_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student ON public.assessment_attempts(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON public.assessment_attempts(tenant_id, status);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_assessment_attempts_tenant_immutable ON public.assessment_attempts;
CREATE TRIGGER trg_assessment_attempts_tenant_immutable
    BEFORE UPDATE ON public.assessment_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 5. TABELA DE RESPOSTAS DA TENTATIVA (attempt_answers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_option_id UUID, -- Alternativa escolhida
    is_correct BOOLEAN DEFAULT NULL, -- Computado pelo servidor na correção
    score_earned NUMERIC(5,2) DEFAULT NULL, -- Pontos obtidos nesta questão
    answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FKs compostas
    CONSTRAINT fk_attempt_answers_attempt
        FOREIGN KEY (tenant_id, attempt_id)
        REFERENCES public.assessment_attempts(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_attempt_answers_question
        FOREIGN KEY (tenant_id, question_id)
        REFERENCES public.assessment_questions(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_attempt_answers_option
        FOREIGN KEY (tenant_id, selected_option_id)
        REFERENCES public.question_options(tenant_id, id)
        ON DELETE SET NULL,

    CONSTRAINT uq_attempt_answers_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_attempt_answers_attempt_question UNIQUE (tenant_id, attempt_id, question_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_attempt_answers_tenant ON public.attempt_answers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON public.attempt_answers(tenant_id, attempt_id);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_attempt_answers_tenant_immutable ON public.attempt_answers;
CREATE TRIGGER trg_attempt_answers_tenant_immutable
    BEFORE UPDATE ON public.attempt_answers
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. ASSESSMENT_QUESTIONS & QUESTION_OPTIONS
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Staff (admin, secretaria): vê todas
-- - Professor: vê questões das disciplinas atribuídas
-- - Aluno: NÃO tem acesso direto às questões com gabarito via SELECT aberto
DROP POLICY IF EXISTS assessment_questions_select_policy ON public.assessment_questions;
CREATE POLICY assessment_questions_select_policy ON public.assessment_questions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessment_questions.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessment_questions.tenant_id, assessment_questions.subject_id)
                  )
              )
        )
    );

DROP POLICY IF EXISTS assessment_questions_write_policy ON public.assessment_questions;
CREATE POLICY assessment_questions_write_policy ON public.assessment_questions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessment_questions.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessment_questions.tenant_id, assessment_questions.subject_id)
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessment_questions.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessment_questions.tenant_id, assessment_questions.subject_id)
                  )
              )
        )
    );

-- QUESTION_OPTIONS: herda o acesso restrito da questão
DROP POLICY IF EXISTS question_options_select_policy ON public.question_options;
CREATE POLICY question_options_select_policy ON public.question_options
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            WHERE q.id = question_options.question_id
              AND q.tenant_id = question_options.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = question_options.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(q.tenant_id, q.subject_id)
                        )
                    )
              )
        )
    );

DROP POLICY IF EXISTS question_options_write_policy ON public.question_options;
CREATE POLICY question_options_write_policy ON public.question_options
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            WHERE q.id = question_options.question_id
              AND q.tenant_id = question_options.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = question_options.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(q.tenant_id, q.subject_id)
                        )
                    )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            WHERE q.id = question_options.question_id
              AND q.tenant_id = question_options.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = question_options.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(q.tenant_id, q.subject_id)
                        )
                    )
              )
        )
    );

-- ------------------------------------------------------------------------------
-- B. ASSESSMENTS (PROVAS)
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Admin e Secretaria: veem todas
-- - Professor: vê avaliações de suas disciplinas
-- - Aluno: vê avaliações ativas de matérias em que possui matrícula ativa
DROP POLICY IF EXISTS assessments_select_policy ON public.assessments;
CREATE POLICY assessments_select_policy ON public.assessments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessments.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria', 'financeiro')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessments.tenant_id, assessments.subject_id)
                  )
                  OR (
                      tu.role = 'aluno'
                      AND assessments.is_active = TRUE
                      AND public.has_student_subject_enrollment(assessments.tenant_id, assessments.subject_id)
                      AND (
                          assessments.class_id IS NULL
                          OR assessments.class_id IN (
                              SELECT e.class_id FROM public.enrollments e
                              JOIN public.students s ON s.id = e.student_id AND s.tenant_id = e.tenant_id
                              WHERE s.user_id = auth.uid() AND e.tenant_id = assessments.tenant_id
                          )
                      )
                  )
              )
        )
    );

-- WRITE (INSERT, UPDATE, DELETE): Admin, Secretaria ou Professor atribuído
DROP POLICY IF EXISTS assessments_write_policy ON public.assessments;
CREATE POLICY assessments_write_policy ON public.assessments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessments.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessments.tenant_id, assessments.subject_id)
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessments.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(assessments.tenant_id, assessments.subject_id)
                  )
              )
        )
    );

-- ------------------------------------------------------------------------------
-- C. ASSESSMENT_ATTEMPTS (TENTATIVAS)
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Staff e Professor da matéria: veem tentativas dos alunos
-- - Aluno: vê estritamente suas próprias tentativas
DROP POLICY IF EXISTS assessment_attempts_select_policy ON public.assessment_attempts;
CREATE POLICY assessment_attempts_select_policy ON public.assessment_attempts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = assessment_attempts.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND EXISTS (
                          SELECT 1 FROM public.assessments a
                          WHERE a.id = assessment_attempts.assessment_id
                            AND a.tenant_id = assessment_attempts.tenant_id
                            AND public.has_teacher_subject_assignment(a.tenant_id, a.subject_id)
                      )
                  )
                  OR (
                      tu.role = 'aluno'
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.id = assessment_attempts.student_id
                            AND s.tenant_id = assessment_attempts.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

-- INSERT / UPDATE: Aluno pode inserir sua tentativa e responder durante a vigência;
-- manipulação de total_score e status pós-submissão só pode ser efetuada via Server Action com service_role
DROP POLICY IF EXISTS assessment_attempts_insert_policy ON public.assessment_attempts;
CREATE POLICY assessment_attempts_insert_policy ON public.assessment_attempts
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = assessment_attempts.student_id
              AND s.tenant_id = assessment_attempts.tenant_id
              AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS assessment_attempts_update_policy ON public.assessment_attempts;
CREATE POLICY assessment_attempts_update_policy ON public.assessment_attempts
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = assessment_attempts.student_id
              AND s.tenant_id = assessment_attempts.tenant_id
              AND s.user_id = auth.uid()
        )
        AND assessment_attempts.status = 'em_andamento'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = assessment_attempts.student_id
              AND s.tenant_id = assessment_attempts.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- D. ATTEMPT_ANSWERS (RESPOSTAS DA TENTATIVA)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS attempt_answers_select_policy ON public.attempt_answers;
CREATE POLICY attempt_answers_select_policy ON public.attempt_answers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            WHERE att.id = attempt_answers.attempt_id
              AND att.tenant_id = attempt_answers.tenant_id
              AND (
                  EXISTS (
                      SELECT 1 FROM public.tenant_users tu
                      WHERE tu.tenant_id = attempt_answers.tenant_id
                        AND tu.user_id = auth.uid()
                        AND tu.role IN ('admin', 'secretaria', 'professor')
                  )
                  OR (
                      EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.id = att.student_id
                            AND s.tenant_id = attempt_answers.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS attempt_answers_insert_policy ON public.attempt_answers;
CREATE POLICY attempt_answers_insert_policy ON public.attempt_answers
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            JOIN public.students s ON s.id = att.student_id AND s.tenant_id = att.tenant_id
            WHERE att.id = attempt_answers.attempt_id
              AND att.tenant_id = attempt_answers.tenant_id
              AND s.user_id = auth.uid()
              AND att.status = 'em_andamento'
        )
    );

DROP POLICY IF EXISTS attempt_answers_update_policy ON public.attempt_answers;
CREATE POLICY attempt_answers_update_policy ON public.attempt_answers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            JOIN public.students s ON s.id = att.student_id AND s.tenant_id = att.tenant_id
            WHERE att.id = attempt_answers.attempt_id
              AND att.tenant_id = attempt_answers.tenant_id
              AND s.user_id = auth.uid()
              AND att.status = 'em_andamento'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            JOIN public.students s ON s.id = att.student_id AND s.tenant_id = att.tenant_id
            WHERE att.id = attempt_answers.attempt_id
              AND att.tenant_id = attempt_answers.tenant_id
              AND s.user_id = auth.uid()
              AND att.status = 'em_andamento'
        )
    );
