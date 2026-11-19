-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0005: GESTÃO DE PROFESSORES, ATRIBUIÇÕES E INTEGRIDADE CURRICULAR
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Cadastro Docente (teachers): identificação, contato, formação acadêmica,
--    especialidades teológicas e vínculo opcional seguro com auth.users via user_id.
-- 2. Atribuições Docentes (teaching_assignments): associação de professores a turmas
--    e/ou disciplinas, com período letivo, papel na turma e vigência.
-- 3. Correção de Integridade Curricular em subjects:
--    Garante que o módulo (module_id) pertença rigorosamente ao mesmo curso (course_id)
--    da disciplina, adicionando constraint candidata UNIQUE (tenant_id, course_id, id)
--    em course_modules e FK composta em subjects (tenant_id, course_id, module_id).
-- 4. RLS estrito: professores têm visão de suas turmas e disciplinas atribuídas,
--    mas não possuem permissões de alteração administrativa global.
-- 5. Imutabilidade de tenant_id em todas as tabelas via prevent_tenant_id_change().
-- ==============================================================================

-- ==============================================================================
-- 1. CORREÇÃO DE INTEGRIDADE CURRICULAR (course_modules & subjects)
-- ==============================================================================
-- Adiciona constraint candidata composta (tenant_id, course_id, id) em course_modules
ALTER TABLE public.course_modules
    ADD CONSTRAINT uq_course_modules_tenant_course_id UNIQUE (tenant_id, course_id, id);

-- Remove a FK antiga mais permissiva de module_id
ALTER TABLE public.subjects
    DROP CONSTRAINT IF EXISTS fk_subjects_module;

-- Adiciona a FK composta rigorosa: module_id deve pertencer ao mesmo tenant e curso da disciplina.
-- No PostgreSQL 15+ (padrão Supabase), ON DELETE SET NULL (module_id) zera exclusivamente
-- a coluna opcional module_id caso o módulo seja excluído, preservando tenant_id e course_id intactos.
ALTER TABLE public.subjects
    ADD CONSTRAINT fk_subjects_module_strict
        FOREIGN KEY (tenant_id, course_id, module_id)
        REFERENCES public.course_modules(tenant_id, course_id, id)
        ON DELETE SET NULL (module_id);


-- ==============================================================================
-- 2. TABELA DE PROFESSORES / CORPO DOCENTE (teachers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Vínculo opcional com login
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    full_name VARCHAR(255) GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED,
    email VARCHAR(255),
    phone VARCHAR(30),
    academic_title VARCHAR(100), -- Ex: Bacharel, Mestre em Teologia, Doutor, Especialista
    theological_specialties TEXT, -- Ex: Teologia Sistemática, Grego Bíblico, Hermenêutica
    bio TEXT, -- Breve biografia ministerial e acadêmica
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraint composta para suportar integridade relacional entre tabelas filhas
    CONSTRAINT uq_teachers_tenant_id UNIQUE (tenant_id, id)
);

-- Um usuário auth só pode ser associado a 1 registro de professor no mesmo tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_tenant_user_id
    ON public.teachers (tenant_id, user_id)
    WHERE user_id IS NOT NULL;

-- Índices de consulta
CREATE INDEX IF NOT EXISTS idx_teachers_tenant_id ON public.teachers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_active ON public.teachers(tenant_id, is_active);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_teachers_tenant_immutable ON public.teachers;
CREATE TRIGGER trg_teachers_tenant_immutable
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- Trigger de proteção contra alteração indevida de user_id por usuários comuns
CREATE OR REPLACE FUNCTION public.check_teacher_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        IF (auth.uid() IS NOT NULL) THEN
            IF NOT (
                public.is_platform_operator()
                OR (
                    NEW.tenant_id IN (SELECT get_auth_tenant_ids())
                    AND public.get_auth_role_in_tenant(NEW.tenant_id) IN ('admin', 'secretaria')
                )
            ) THEN
                RAISE EXCEPTION 'Operação proibida: apenas administradores ou secretaria podem vincular ou alterar a conta do professor.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teachers_protect_user_id ON public.teachers;
CREATE TRIGGER trg_teachers_protect_user_id
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW
    EXECUTE FUNCTION public.check_teacher_user_id_change();


-- ==============================================================================
-- 3. TABELA DE ATRIBUIÇÕES DOCENTES (teaching_assignments)
-- ==============================================================================
-- Associa professores a turmas e/ou disciplinas da instituição
CREATE TABLE IF NOT EXISTS public.teaching_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL,
    class_id UUID, -- Turma vinculada (opcional para atribuição por matéria geral)
    subject_id UUID, -- Disciplina vinculada (opcional para professor regente de turma)
    role_description VARCHAR(100) NOT NULL DEFAULT 'titular'
        CHECK (role_description IN ('titular', 'adjunto', 'tutor', 'convidado')),
    start_date DATE,
    end_date DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para teacher
    CONSTRAINT fk_teaching_assignments_teacher
        FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES public.teachers(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para class
    CONSTRAINT fk_teaching_assignments_class
        FOREIGN KEY (tenant_id, class_id)
        REFERENCES public.classes(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para subject
    CONSTRAINT fk_teaching_assignments_subject
        FOREIGN KEY (tenant_id, subject_id)
        REFERENCES public.subjects(tenant_id, id)
        ON DELETE CASCADE,

    -- Ao menos uma associação deve ser informada (turma ou disciplina)
    CONSTRAINT chk_teaching_assignments_target
        CHECK (class_id IS NOT NULL OR subject_id IS NOT NULL)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_tenant ON public.teaching_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_teacher ON public.teaching_assignments(tenant_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_class ON public.teaching_assignments(tenant_id, class_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_subject ON public.teaching_assignments(tenant_id, subject_id);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_teaching_assignments_tenant_immutable ON public.teaching_assignments;
CREATE TRIGGER trg_teaching_assignments_tenant_immutable
    BEFORE UPDATE ON public.teaching_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. TEACHERS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT: Qualquer membro do tenant pode ver os professores cadastrados
DROP POLICY IF EXISTS teachers_select_policy ON public.teachers;
CREATE POLICY teachers_select_policy ON public.teachers
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

-- INSERT: Admin e Secretaria
DROP POLICY IF EXISTS teachers_insert_policy ON public.teachers;
CREATE POLICY teachers_insert_policy ON public.teachers
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teachers.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- UPDATE: Admin e Secretaria
DROP POLICY IF EXISTS teachers_update_policy ON public.teachers;
CREATE POLICY teachers_update_policy ON public.teachers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teachers.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teachers.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- DELETE: Apenas Admin
DROP POLICY IF EXISTS teachers_delete_policy ON public.teachers;
CREATE POLICY teachers_delete_policy ON public.teachers
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teachers.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- B. TEACHING_ASSIGNMENTS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Staff (admin, secretaria, financeiro) vê todas as atribuições
-- - Professor vê suas próprias atribuições via teachers.user_id = auth.uid()
-- - Aluno vê atribuições das turmas em que está matriculado
DROP POLICY IF EXISTS teaching_assignments_select_policy ON public.teaching_assignments;
CREATE POLICY teaching_assignments_select_policy ON public.teaching_assignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teaching_assignments.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria', 'financeiro')
                  OR (
                      tu.role = 'professor'
                      AND EXISTS (
                          SELECT 1 FROM public.teachers t
                          WHERE t.id = teaching_assignments.teacher_id
                            AND t.tenant_id = teaching_assignments.tenant_id
                            AND t.user_id = auth.uid()
                      )
                  )
                  OR (
                      tu.role = 'aluno'
                      AND (
                          teaching_assignments.class_id IN (
                              SELECT e.class_id FROM public.enrollments e
                              JOIN public.students s ON s.id = e.student_id
                              WHERE s.user_id = auth.uid() AND s.tenant_id = teaching_assignments.tenant_id
                          )
                      )
                  )
              )
        )
    );

-- INSERT: Admin e Secretaria
DROP POLICY IF EXISTS teaching_assignments_insert_policy ON public.teaching_assignments;
CREATE POLICY teaching_assignments_insert_policy ON public.teaching_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teaching_assignments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- UPDATE: Admin e Secretaria
DROP POLICY IF EXISTS teaching_assignments_update_policy ON public.teaching_assignments;
CREATE POLICY teaching_assignments_update_policy ON public.teaching_assignments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teaching_assignments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teaching_assignments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- DELETE: Admin e Secretaria
DROP POLICY IF EXISTS teaching_assignments_delete_policy ON public.teaching_assignments;
CREATE POLICY teaching_assignments_delete_policy ON public.teaching_assignments
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = teaching_assignments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );
