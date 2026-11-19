-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0003: CURSOS, TURMAS E MATRÍCULAS (ESCOLA TEOLÓGICA)
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Imutabilidade de tenant_id em courses, classes e enrollments via trigger nativo.
-- 2. FKs compostas (tenant_id, course_id) em classes e enrollments para blindar integridade no mesmo tenant.
-- 3. Unicidade de matrícula: (tenant_id, enrollment_number) único, e (tenant_id, student_id, course_id)
--    restringindo duplicidade de matrícula ativa no mesmo curso teológico.
-- 4. RLS estrito default-deny com USING e WITH CHECK rigorosamente sincronizados.
-- 5. Sem dependência de séries, 4 bimestres ou regras rígidas de educação básica.
-- ==============================================================================

-- 1. TABELA DE CURSOS TEOLÓGICOS (courses)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    modality VARCHAR(50) NOT NULL DEFAULT 'presencial'
        CHECK (modality IN ('presencial', 'hibrido', 'ead_assincrono')),
    format VARCHAR(50) NOT NULL DEFAULT 'simples'
        CHECK (format IN ('simples', 'estruturado')),
    duration_months INT CHECK (duration_months IS NULL OR duration_months > 0),
    workload_hours INT NOT NULL DEFAULT 60 CHECK (workload_hours > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraint composta para suportar integridade relacional entre tabelas filhas
    CONSTRAINT uq_courses_tenant_id UNIQUE (tenant_id, id)
);

-- Índices de consulta e performance
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON public.courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_active ON public.courses(tenant_id, is_active);

-- Trigger de Imutabilidade do tenant_id
CREATE TRIGGER trg_courses_tenant_immutable
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 2. TABELA DE TURMAS (classes)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    period_label VARCHAR(100), -- Ex: "2026/1", "Intensivo Julho", "Turma Noite"
    shift VARCHAR(50) NOT NULL DEFAULT 'noturno'
        CHECK (shift IN ('matutino', 'vespertino', 'noturno', 'integral', 'sabado', 'tempo_flexivel')),
    status VARCHAR(50) NOT NULL DEFAULT 'prevista'
        CHECK (status IN ('prevista', 'em_andamento', 'concluida', 'cancelada')),
    capacity INT NOT NULL DEFAULT 40 CHECK (capacity >= 0),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta garantindo que a turma pertença rigorosamente ao mesmo tenant do curso
    CONSTRAINT fk_classes_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    -- Constraint composta candidata
    CONSTRAINT uq_classes_tenant_id UNIQUE (tenant_id, id)
);

-- Índices de consulta
CREATE INDEX IF NOT EXISTS idx_classes_tenant_id ON public.classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_course ON public.classes(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_status ON public.classes(tenant_id, status);

-- Trigger de Imutabilidade do tenant_id
CREATE TRIGGER trg_classes_tenant_immutable
    BEFORE UPDATE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 3. TABELA DE MATRÍCULAS (enrollments)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    class_id UUID,
    enrollment_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ativa'
        CHECK (status IN ('pre_matricula', 'em_analise', 'ativa', 'trancada', 'cancelada', 'concluida', 'transferida')),
    status_reason TEXT,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para student
    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para course
    CONSTRAINT fk_enrollments_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para class (quando vinculada)
    CONSTRAINT fk_enrollments_class
        FOREIGN KEY (tenant_id, class_id)
        REFERENCES public.classes(tenant_id, id)
        ON DELETE SET NULL,

    -- Unicidade do número de matrícula por tenant
    CONSTRAINT uq_enrollments_tenant_number UNIQUE (tenant_id, enrollment_number)
);

-- Índice único condicional: impede que um aluno tenha duas matrículas ATIVAS ou EM ANÁLISE no mesmo curso
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_tenant_active_student_course
    ON public.enrollments(tenant_id, student_id, course_id)
    WHERE status IN ('ativa', 'em_analise', 'pre_matricula');

-- Índices de busca e auditoria
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_student ON public.enrollments(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_course ON public.enrollments(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_class ON public.enrollments(tenant_id, class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_status ON public.enrollments(tenant_id, status);

-- Trigger de Imutabilidade do tenant_id
CREATE TRIGGER trg_enrollments_tenant_immutable
    BEFORE UPDATE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================

-- Habilitação RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. COURSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS courses_select_policy ON public.courses;
DROP POLICY IF EXISTS courses_insert_policy ON public.courses;
DROP POLICY IF EXISTS courses_update_policy ON public.courses;
DROP POLICY IF EXISTS courses_delete_policy ON public.courses;

-- SELECT: Qualquer membro autenticado do tenant pode ver os cursos ativos/gerais
CREATE POLICY courses_select_policy ON public.courses
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

-- INSERT: Apenas admin e secretaria
CREATE POLICY courses_insert_policy ON public.courses
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = courses.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- UPDATE: Apenas admin e secretaria (mesmo tenant)
CREATE POLICY courses_update_policy ON public.courses
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = courses.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = courses.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- DELETE: Apenas admin
CREATE POLICY courses_delete_policy ON public.courses
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = courses.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- B. CLASSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS classes_select_policy ON public.classes;
DROP POLICY IF EXISTS classes_insert_policy ON public.classes;
DROP POLICY IF EXISTS classes_update_policy ON public.classes;
DROP POLICY IF EXISTS classes_delete_policy ON public.classes;

-- SELECT: Membros do tenant
CREATE POLICY classes_select_policy ON public.classes
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

-- INSERT: Admin e secretaria
CREATE POLICY classes_insert_policy ON public.classes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = classes.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- UPDATE: Admin e secretaria
CREATE POLICY classes_update_policy ON public.classes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = classes.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = classes.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- DELETE: Admin
CREATE POLICY classes_delete_policy ON public.classes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = classes.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- C. ENROLLMENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS enrollments_select_policy ON public.enrollments;
DROP POLICY IF EXISTS enrollments_insert_policy ON public.enrollments;
DROP POLICY IF EXISTS enrollments_update_policy ON public.enrollments;
DROP POLICY IF EXISTS enrollments_delete_policy ON public.enrollments;

-- SELECT:
-- - Staff (admin, secretaria, professor, financeiro) vê todas do tenant
-- - Aluno vê estritamente suas próprias matrículas via vínculo explícito e seguro (students.user_id = auth.uid())
CREATE POLICY enrollments_select_policy ON public.enrollments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = enrollments.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria', 'professor', 'financeiro')
                  OR (
                      tu.role = 'aluno'
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.id = enrollments.student_id
                            AND s.tenant_id = enrollments.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

-- INSERT: Admin e secretaria
CREATE POLICY enrollments_insert_policy ON public.enrollments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = enrollments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- UPDATE: Admin e secretaria
CREATE POLICY enrollments_update_policy ON public.enrollments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = enrollments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = enrollments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

-- DELETE: Admin (exclusivo para expurgos cadastrais autorizados)
CREATE POLICY enrollments_delete_policy ON public.enrollments
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = enrollments.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );
