-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0002: SECRETARIA E ALUNOS (ESCOLA TEOLÓGICA) - REVISADA
-- ==============================================================================
-- Correções de Segurança e Integridade Incorporadas:
-- 1. Imutabilidade de tenant_id em todas as tabelas via trigger nativo.
-- 2. FKs compostas (tenant_id, id) em student_guardians, impedindo vínculos entre tenants distintos.
-- 3. Índice único parcial de CPF por tenant para alunos e responsáveis (evita duplicidade).
-- 4. RLS estrito: USING e WITH CHECK rigorosamente sincronizados contra escalonamento de privilégios.
-- ==============================================================================

-- 1. Trigger e Função de Imutabilidade de tenant_id
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
        RAISE EXCEPTION 'Operação proibida: o tenant_id é imutável após a criação do registro.';
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Tabela de Alunos (students)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    full_name VARCHAR(255) GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED,
    cpf VARCHAR(14),
    rg VARCHAR(20),
    rg_issuer VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'uninformed')),
    photo_url TEXT,
    email VARCHAR(255),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    postal_code VARCHAR(10),
    street VARCHAR(255),
    number VARCHAR(30),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    -- Dados Eclesiásticos / Pastorais (Opcionais)
    church_name VARCHAR(200),
    pastor_name VARCHAR(150),
    ministry_role VARCHAR(100),
    -- Observações gerais
    general_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Chave composta candidata para integridade relacional multi-tenant
    CONSTRAINT uq_students_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON public.students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(tenant_id, first_name, last_name);

-- Índice único parcial de CPF por tenant para alunos (impede duplicações acidentais no mesmo seminário)
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_tenant_cpf 
ON public.students(tenant_id, cpf) 
WHERE cpf IS NOT NULL AND cpf <> '';

-- Trigger de imutabilidade de tenant_id em students
DROP TRIGGER IF EXISTS trg_students_tenant_immutable ON public.students;
CREATE TRIGGER trg_students_tenant_immutable
    BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 3. Tabela de Responsáveis (guardians) — Opcional
CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    rg VARCHAR(20),
    kinship VARCHAR(50) DEFAULT 'outro',
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    email VARCHAR(255),
    profession VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_guardians_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant ON public.guardians(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guardians_active ON public.guardians(tenant_id, is_active);

-- Índice único de CPF por tenant para responsáveis
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_tenant_cpf 
ON public.guardians(tenant_id, cpf) 
WHERE cpf IS NOT NULL AND cpf <> '';

-- Trigger de imutabilidade de tenant_id em guardians
DROP TRIGGER IF EXISTS trg_guardians_tenant_immutable ON public.guardians;
CREATE TRIGGER trg_guardians_tenant_immutable
    BEFORE UPDATE ON public.guardians
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 4. Tabela Associativa Aluno-Responsável (student_guardians) com Chave Composta Blindada
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    guardian_id UUID NOT NULL,
    kinship VARCHAR(50) NOT NULL DEFAULT 'outro',
    is_financial BOOLEAN NOT NULL DEFAULT FALSE,
    is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade referencial hermética: garante que student e guardian pertencem OBRIGATORIAMENTE ao mesmo tenant_id
    CONSTRAINT fk_student_guardians_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_student_guardians_guardian FOREIGN KEY (tenant_id, guardian_id)
        REFERENCES public.guardians(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_tenant_student_guardian UNIQUE (tenant_id, student_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_std_guard_student ON public.student_guardians(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_std_guard_guardian ON public.student_guardians(tenant_id, guardian_id);

-- Trigger de imutabilidade de tenant_id em student_guardians
DROP TRIGGER IF EXISTS trg_student_guardians_tenant_immutable ON public.student_guardians;
CREATE TRIGGER trg_student_guardians_tenant_immutable
    BEFORE UPDATE ON public.student_guardians
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- ==============================================================================
-- 5. Row-Level Security (RLS) - Isolamento Hermético e Políticas Revisadas
-- ==============================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

-- A) Policies para Students
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy"
ON public.students FOR SELECT
USING (
    public.is_platform_operator()
    OR tenant_id IN (SELECT get_auth_tenant_ids())
);

DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
CREATE POLICY "students_insert_policy"
ON public.students FOR INSERT
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "students_update_policy" ON public.students;
CREATE POLICY "students_update_policy"
ON public.students FOR UPDATE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
)
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
CREATE POLICY "students_delete_policy"
ON public.students FOR DELETE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

-- B) Policies para Guardians
DROP POLICY IF EXISTS "guardians_select_policy" ON public.guardians;
CREATE POLICY "guardians_select_policy"
ON public.guardians FOR SELECT
USING (
    public.is_platform_operator()
    OR tenant_id IN (SELECT get_auth_tenant_ids())
);

DROP POLICY IF EXISTS "guardians_insert_policy" ON public.guardians;
CREATE POLICY "guardians_insert_policy"
ON public.guardians FOR INSERT
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "guardians_update_policy" ON public.guardians;
CREATE POLICY "guardians_update_policy"
ON public.guardians FOR UPDATE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
)
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "guardians_delete_policy" ON public.guardians;
CREATE POLICY "guardians_delete_policy"
ON public.guardians FOR DELETE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

-- C) Policies para Student_Guardians
DROP POLICY IF EXISTS "student_guardians_select_policy" ON public.student_guardians;
CREATE POLICY "student_guardians_select_policy"
ON public.student_guardians FOR SELECT
USING (
    public.is_platform_operator()
    OR tenant_id IN (SELECT get_auth_tenant_ids())
);

DROP POLICY IF EXISTS "student_guardians_insert_policy" ON public.student_guardians;
CREATE POLICY "student_guardians_insert_policy"
ON public.student_guardians FOR INSERT
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "student_guardians_update_policy" ON public.student_guardians;
CREATE POLICY "student_guardians_update_policy"
ON public.student_guardians FOR UPDATE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
)
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "student_guardians_delete_policy" ON public.student_guardians;
CREATE POLICY "student_guardians_delete_policy"
ON public.student_guardians FOR DELETE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);
