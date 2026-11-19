-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0006: FUNDAÇÃO DO EAD (UNIDADES, AULAS E MATERIAIS)
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Proteção de integridade curricular cruzada em teaching_assignments:
--    Trigger nativo check_teaching_assignment_course_integrity impede que turma e
--    disciplina de cursos diferentes sejam vinculadas na mesma atribuição.
-- 2. Unidades de Aprendizagem (learning_units):
--    Vinculadas a disciplinas (subjects), com ordem, título, status e publicação.
-- 3. Aulas Teológicas (lessons):
--    Vinculadas à unidade de aprendizagem e disciplina, com ordem, duração estimada
--    e status de publicação.
-- 4. Materiais Didáticos por Aula (lesson_materials):
--    Vídeos externos (YouTube/Vimeo), documentos PDF, links web e textos complementares.
-- 5. Imutabilidade estrita de tenant_id via trigger nativo prevent_tenant_id_change().
-- 6. RLS Default-Deny:
--    - Secretaria e Admin: gestão completa.
--    - Professores: edição restrita a disciplinas/turmas atribuídas (teaching_assignments).
--    - Alunos: leitura das aulas publicadas em disciplinas de turmas com matrícula ativa.
-- ==============================================================================

-- ==============================================================================
-- 1. PROTEÇÃO NO BANCO: INTEGRIDADE DE CURSO EM TEACHING_ASSIGNMENTS
-- ==============================================================================
-- Impede teaching_assignments com class_id e subject_id apontando para cursos diferentes
CREATE OR REPLACE FUNCTION public.check_teaching_assignment_course_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_class_course_id UUID;
    v_subject_course_id UUID;
BEGIN
    -- Se turma e disciplina foram informadas simultaneamente
    IF NEW.class_id IS NOT NULL AND NEW.subject_id IS NOT NULL THEN
        -- Busca curso da turma
        SELECT course_id INTO v_class_course_id
        FROM public.classes
        WHERE id = NEW.class_id AND tenant_id = NEW.tenant_id;

        -- Busca curso da disciplina
        SELECT course_id INTO v_subject_course_id
        FROM public.subjects
        WHERE id = NEW.subject_id AND tenant_id = NEW.tenant_id;

        IF v_class_course_id IS NOT NULL AND v_subject_course_id IS NOT NULL THEN
            IF v_class_course_id <> v_subject_course_id THEN
                RAISE EXCEPTION 'Incoerência curricular: A turma (curso %) e a disciplina (curso %) pertencem a cursos diferentes.',
                    v_class_course_id, v_subject_course_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teaching_assignments_course_integrity ON public.teaching_assignments;
CREATE TRIGGER trg_teaching_assignments_course_integrity
    BEFORE INSERT OR UPDATE ON public.teaching_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_teaching_assignment_course_integrity();


-- ==============================================================================
-- 2. TABELA DE UNIDADES DE APRENDIZAGEM (learning_units)
-- ==============================================================================
-- Organiza a matéria em blocos pedagógicos/unidades (ex: Unidade 1 - Cristologia Bíblica)
CREATE TABLE IF NOT EXISTS public.learning_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para subject
    CONSTRAINT fk_learning_units_subject
        FOREIGN KEY (tenant_id, subject_id)
        REFERENCES public.subjects(tenant_id, id)
        ON DELETE CASCADE,

    -- Candidata a chave composta para FKs filhas
    CONSTRAINT uq_learning_units_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_learning_units_tenant ON public.learning_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_learning_units_subject ON public.learning_units(tenant_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_learning_units_order ON public.learning_units(subject_id, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_units_published ON public.learning_units(tenant_id, is_published);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_learning_units_tenant_immutable ON public.learning_units;
CREATE TRIGGER trg_learning_units_tenant_immutable
    BEFORE UPDATE ON public.learning_units
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 3. TABELA DE AULAS TEOLÓGICAS (lessons)
-- ==============================================================================
-- Aulas pertencentes a uma unidade de aprendizagem da disciplina
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    content_text TEXT, -- Texto expositivo / notas de aula teológicas
    duration_minutes INT DEFAULT 0 CHECK (duration_minutes >= 0),
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para learning_units
    CONSTRAINT fk_lessons_unit
        FOREIGN KEY (tenant_id, unit_id)
        REFERENCES public.learning_units(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para subjects
    CONSTRAINT fk_lessons_subject
        FOREIGN KEY (tenant_id, subject_id)
        REFERENCES public.subjects(tenant_id, id)
        ON DELETE CASCADE,

    -- Candidata a chave composta para FKs filhas
    CONSTRAINT uq_lessons_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lessons_tenant ON public.lessons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON public.lessons(tenant_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON public.lessons(tenant_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON public.lessons(unit_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_published ON public.lessons(tenant_id, is_published);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_lessons_tenant_immutable ON public.lessons;
CREATE TRIGGER trg_lessons_tenant_immutable
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 4. TABELA DE MATERIAIS DA AULA (lesson_materials)
-- ==============================================================================
-- Recursos pedagógicos vinculados a cada aula: vídeo externo, PDF, link web ou texto
CREATE TABLE IF NOT EXISTS public.lesson_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    material_type VARCHAR(50) NOT NULL
        CHECK (material_type IN ('video', 'pdf', 'link', 'text')),
    url TEXT, -- URL externa validada (ex: YouTube, Vimeo, link seguro para PDF ou site)
    content_text TEXT, -- Usado quando material_type = 'text'
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para lesson
    CONSTRAINT fk_lesson_materials_lesson
        FOREIGN KEY (tenant_id, lesson_id)
        REFERENCES public.lessons(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_lesson_materials_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lesson_materials_tenant ON public.lesson_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson ON public.lesson_materials(tenant_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_order ON public.lesson_materials(lesson_id, order_index);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_lesson_materials_tenant_immutable ON public.lesson_materials;
CREATE TRIGGER trg_lesson_materials_tenant_immutable
    BEFORE UPDATE ON public.lesson_materials
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================

ALTER TABLE public.learning_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. HELPER FUNCTION: Verifica se o usuário autenticado tem atribuição docente ativa na disciplina
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_teacher_subject_assignment(p_tenant_id UUID, p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.teaching_assignments ta
        JOIN public.teachers t ON t.id = ta.teacher_id AND t.tenant_id = ta.tenant_id
        WHERE ta.tenant_id = p_tenant_id
          AND ta.is_active = TRUE
          AND t.user_id = auth.uid()
          AND (
              ta.subject_id = p_subject_id
              OR ta.class_id IN (
                  SELECT c.id FROM public.classes c
                  JOIN public.subjects s ON s.course_id = c.course_id AND s.tenant_id = c.tenant_id
                  WHERE s.id = p_subject_id AND c.tenant_id = p_tenant_id
              )
          )
    );
$$;

-- ------------------------------------------------------------------------------
-- B. HELPER FUNCTION: Verifica se o aluno autenticado tem matrícula ativa no curso da disciplina
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_student_subject_enrollment(p_tenant_id UUID, p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id AND s.tenant_id = e.tenant_id
        JOIN public.subjects sub ON sub.course_id = e.course_id AND sub.tenant_id = e.tenant_id
        WHERE e.tenant_id = p_tenant_id
          AND s.user_id = auth.uid()
          AND sub.id = p_subject_id
          AND e.status IN ('ativa', 'concluida')
    );
$$;


-- ------------------------------------------------------------------------------
-- C. POLICIES: LEARNING_UNITS
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Admin e Secretaria: veem todas as unidades do tenant.
-- - Professor: vê unidades de disciplinas atribuídas a ele (ou todas do tenant para referência).
-- - Aluno: vê apenas unidades publicadas de disciplinas em que possui matrícula ativa.
DROP POLICY IF EXISTS learning_units_select_policy ON public.learning_units;
CREATE POLICY learning_units_select_policy ON public.learning_units
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = learning_units.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria', 'financeiro')
                  OR (
                      tu.role = 'professor'
                      AND (
                          public.has_teacher_subject_assignment(learning_units.tenant_id, learning_units.subject_id)
                          OR learning_units.is_published = TRUE
                      )
                  )
                  OR (
                      tu.role = 'aluno'
                      AND learning_units.is_published = TRUE
                      AND public.has_student_subject_enrollment(learning_units.tenant_id, learning_units.subject_id)
                  )
              )
        )
    );

-- INSERT: Admin, Secretaria ou Professor com atribuição ativa na disciplina
DROP POLICY IF EXISTS learning_units_insert_policy ON public.learning_units;
CREATE POLICY learning_units_insert_policy ON public.learning_units
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = learning_units.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(learning_units.tenant_id, learning_units.subject_id)
                  )
              )
        )
    );

-- UPDATE: Admin, Secretaria ou Professor com atribuição ativa na disciplina
DROP POLICY IF EXISTS learning_units_update_policy ON public.learning_units;
CREATE POLICY learning_units_update_policy ON public.learning_units
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = learning_units.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(learning_units.tenant_id, learning_units.subject_id)
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = learning_units.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(learning_units.tenant_id, learning_units.subject_id)
                  )
              )
        )
    );

-- DELETE: Admin, Secretaria ou Professor com atribuição ativa na disciplina
DROP POLICY IF EXISTS learning_units_delete_policy ON public.learning_units;
CREATE POLICY learning_units_delete_policy ON public.learning_units
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = learning_units.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(learning_units.tenant_id, learning_units.subject_id)
                  )
              )
        )
    );


-- ------------------------------------------------------------------------------
-- D. POLICIES: LESSONS
-- ------------------------------------------------------------------------------
-- SELECT:
-- - Admin e Secretaria: veem todas as aulas do tenant.
-- - Professor: vê aulas das disciplinas atribuídas (ou publicadas).
-- - Aluno: vê apenas aulas publicadas de disciplinas com matrícula ativa, desde que a unidade também esteja publicada.
DROP POLICY IF EXISTS lessons_select_policy ON public.lessons;
CREATE POLICY lessons_select_policy ON public.lessons
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = lessons.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria', 'financeiro')
                  OR (
                      tu.role = 'professor'
                      AND (
                          public.has_teacher_subject_assignment(lessons.tenant_id, lessons.subject_id)
                          OR lessons.is_published = TRUE
                      )
                  )
                  OR (
                      tu.role = 'aluno'
                      AND lessons.is_published = TRUE
                      AND public.has_student_subject_enrollment(lessons.tenant_id, lessons.subject_id)
                      AND EXISTS (
                          SELECT 1 FROM public.learning_units lu
                          WHERE lu.id = lessons.unit_id
                            AND lu.tenant_id = lessons.tenant_id
                            AND lu.is_published = TRUE
                      )
                  )
              )
        )
    );

-- INSERT: Admin, Secretaria ou Professor atribuído
DROP POLICY IF EXISTS lessons_insert_policy ON public.lessons;
CREATE POLICY lessons_insert_policy ON public.lessons
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = lessons.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(lessons.tenant_id, lessons.subject_id)
                  )
              )
        )
    );

-- UPDATE: Admin, Secretaria ou Professor atribuído
DROP POLICY IF EXISTS lessons_update_policy ON public.lessons;
CREATE POLICY lessons_update_policy ON public.lessons
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = lessons.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(lessons.tenant_id, lessons.subject_id)
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = lessons.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(lessons.tenant_id, lessons.subject_id)
                  )
              )
        )
    );

-- DELETE: Admin, Secretaria ou Professor atribuído
DROP POLICY IF EXISTS lessons_delete_policy ON public.lessons;
CREATE POLICY lessons_delete_policy ON public.lessons
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = lessons.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND public.has_teacher_subject_assignment(lessons.tenant_id, lessons.subject_id)
                  )
              )
        )
    );


-- ------------------------------------------------------------------------------
-- E. POLICIES: LESSON_MATERIALS
-- ------------------------------------------------------------------------------
-- SELECT: herda o acesso da aula correspondente
DROP POLICY IF EXISTS lesson_materials_select_policy ON public.lesson_materials;
CREATE POLICY lesson_materials_select_policy ON public.lesson_materials
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_materials.lesson_id
              AND l.tenant_id = lesson_materials.tenant_id
              AND (
                  -- Staff
                  EXISTS (
                      SELECT 1 FROM public.tenant_users tu
                      WHERE tu.tenant_id = lesson_materials.tenant_id
                        AND tu.user_id = auth.uid()
                        AND tu.role IN ('admin', 'secretaria', 'financeiro')
                  )
                  -- Professor com atribuição
                  OR (
                      EXISTS (
                          SELECT 1 FROM public.tenant_users tu
                          WHERE tu.tenant_id = lesson_materials.tenant_id
                            AND tu.user_id = auth.uid()
                            AND tu.role = 'professor'
                      )
                      AND (
                          public.has_teacher_subject_assignment(l.tenant_id, l.subject_id)
                          OR l.is_published = TRUE
                      )
                  )
                  -- Aluno com matrícula na disciplina e aula publicada
                  OR (
                      EXISTS (
                          SELECT 1 FROM public.tenant_users tu
                          WHERE tu.tenant_id = lesson_materials.tenant_id
                            AND tu.user_id = auth.uid()
                            AND tu.role = 'aluno'
                      )
                      AND lesson_materials.is_active = TRUE
                      AND l.is_published = TRUE
                      AND public.has_student_subject_enrollment(l.tenant_id, l.subject_id)
                  )
              )
        )
    );

-- INSERT: Admin, Secretaria ou Professor da aula
DROP POLICY IF EXISTS lesson_materials_insert_policy ON public.lesson_materials;
CREATE POLICY lesson_materials_insert_policy ON public.lesson_materials
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_materials.lesson_id
              AND l.tenant_id = lesson_materials.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = lesson_materials.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(l.tenant_id, l.subject_id)
                        )
                    )
              )
        )
    );

-- UPDATE: Admin, Secretaria ou Professor da aula
DROP POLICY IF EXISTS lesson_materials_update_policy ON public.lesson_materials;
CREATE POLICY lesson_materials_update_policy ON public.lesson_materials
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_materials.lesson_id
              AND l.tenant_id = lesson_materials.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = lesson_materials.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(l.tenant_id, l.subject_id)
                        )
                    )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_materials.lesson_id
              AND l.tenant_id = lesson_materials.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = lesson_materials.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(l.tenant_id, l.subject_id)
                        )
                    )
              )
        )
    );

-- DELETE: Admin, Secretaria ou Professor da aula
DROP POLICY IF EXISTS lesson_materials_delete_policy ON public.lesson_materials;
CREATE POLICY lesson_materials_delete_policy ON public.lesson_materials
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_materials.lesson_id
              AND l.tenant_id = lesson_materials.tenant_id
              AND EXISTS (
                  SELECT 1 FROM public.tenant_users tu
                  WHERE tu.tenant_id = lesson_materials.tenant_id
                    AND tu.user_id = auth.uid()
                    AND (
                        tu.role IN ('admin', 'secretaria')
                        OR (
                            tu.role = 'professor'
                            AND public.has_teacher_subject_assignment(l.tenant_id, l.subject_id)
                        )
                    )
              )
        )
    );
