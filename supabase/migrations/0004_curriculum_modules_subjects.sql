-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0004: ESTRUTURA CURRICULAR E DISCIPLINAS
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Imutabilidade de tenant_id em course_modules e subjects via trigger nativo prevent_tenant_id_change().
-- 2. FKs compostas (tenant_id, course_id) e (tenant_id, module_id) impedindo cruzamento entre instituições.
-- 3. Ordenação flexível (order_index) e suporte integral a cursos simples ou estruturados.
-- 4. RLS estrito default-deny com USING e WITH CHECK rigorosamente sincronizados.
-- 5. Sem obrigatoriedade de séries, 4 bimestres ou controle rígido de dias letivos da educação básica.
-- ==============================================================================

-- 1. TABELA DE MÓDULOS / PERÍODOS CURRICULARES (course_modules)
-- Opcional: Usada em cursos estruturados (ex: Módulo Básico, Módulo Avançado, 1º Semestre, etc.)
CREATE TABLE IF NOT EXISTS public.course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta com courses para blindagem de tenant
    CONSTRAINT fk_course_modules_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    -- Candidata a chave composta para FK de subjects
    CONSTRAINT uq_course_modules_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_course_modules_tenant_id ON public.course_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_order ON public.course_modules(course_id, order_index);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_course_modules_tenant_immutable ON public.course_modules;
CREATE TRIGGER trg_course_modules_tenant_immutable
    BEFORE UPDATE ON public.course_modules
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 2. TABELA DE DISCIPLINAS TEOLÓGICAS (subjects)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    module_id UUID,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    syllabus TEXT, -- Ementa teológica, objetivos e referências
    workload_hours INT NOT NULL DEFAULT 40 CHECK (workload_hours > 0),
    order_index INT NOT NULL DEFAULT 1 CHECK (order_index >= 0),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Professor titular responsável
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta para course
    CONSTRAINT fk_subjects_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    -- FK composta para module (quando informado)
    CONSTRAINT fk_subjects_module
        FOREIGN KEY (tenant_id, module_id)
        REFERENCES public.course_modules(tenant_id, id)
        ON DELETE SET NULL,

    CONSTRAINT uq_subjects_tenant_id UNIQUE (tenant_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subjects_tenant_id ON public.subjects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON public.subjects(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS idx_subjects_module ON public.subjects(tenant_id, module_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON public.subjects(tenant_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_order ON public.subjects(course_id, order_index);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_subjects_tenant_immutable ON public.subjects;
CREATE TRIGGER trg_subjects_tenant_immutable
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. COURSE_MODULES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS course_modules_select_policy ON public.course_modules;
CREATE POLICY course_modules_select_policy ON public.course_modules
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS course_modules_insert_policy ON public.course_modules;
CREATE POLICY course_modules_insert_policy ON public.course_modules
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = course_modules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS course_modules_update_policy ON public.course_modules;
CREATE POLICY course_modules_update_policy ON public.course_modules
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = course_modules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = course_modules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS course_modules_delete_policy ON public.course_modules;
CREATE POLICY course_modules_delete_policy ON public.course_modules
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = course_modules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- B. SUBJECTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS subjects_select_policy ON public.subjects;
CREATE POLICY subjects_select_policy ON public.subjects
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS subjects_insert_policy ON public.subjects;
CREATE POLICY subjects_insert_policy ON public.subjects
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = subjects.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS subjects_update_policy ON public.subjects;
CREATE POLICY subjects_update_policy ON public.subjects
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = subjects.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = subjects.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS subjects_delete_policy ON public.subjects;
CREATE POLICY subjects_delete_policy ON public.subjects
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = subjects.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role = 'admin'
        )
    );
