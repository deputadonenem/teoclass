-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0010: FINANCEIRO ACADÊMICO ESCOLAR
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Separação Estrita de Domínios Financeiros:
--    - Este módulo governa exclusivamente o financeiro escolar INTERNO das instituições
--      (mensalidades, matrículas, descontos/bolsas e pagamentos manuais dos alunos).
--    - NÃO se mistura com as assinaturas SaaS corporativas da Alcântara Sistemas (Hub).
-- 2. Planos Financeiros (financial_plans):
--    - Vinculados a cursos e/ou turmas, com valor da taxa de matrícula, valor da mensalidade,
--      quantidade de parcelas, dia de vencimento padrão e descontos/bolsas.
-- 3. Contas a Receber / Parcelas de Cobrança (receivables):
--    - Vinculadas a matrícula (enrollment_id), aluno (student_id) e tenant (tenant_id).
--    - Controle de unicidade por (tenant_id, enrollment_id, installment_number) para evitar duplicação.
--    - Valores monetários precisos em NUMERIC(10,2) com constraints de não-negatividade.
--    - Situações: 'em_aberto', 'pago', 'vencido', 'cancelado', 'estornado'.
-- 4. Registro de Pagamentos (payment_records):
--    - Registra baixa manual com método (dinheiro, pix, boleto_manual, cartao_manual, transferencia),
--      valor pago, data do pagamento, observações e comprovante auditado.
-- 5. Imutabilidade e RLS Default-Deny:
--    - Imutabilidade de tenant_id via prevent_tenant_id_change().
--    - Trigger de blindagem: impede alteração direta de valor_pago e status por discentes.
--    - Admin e Financeiro: gestão completa de planos, contas e pagamentos.
--    - Secretaria: consulta e registro de pagamentos conforme permissão.
--    - Aluno: consulta estritamente suas próprias contas a receber e recibos.
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA DE PLANOS FINANCEIROS (financial_plans)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.financial_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    class_id UUID,
    
    name VARCHAR(150) NOT NULL,
    description TEXT,
    
    enrollment_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (enrollment_fee >= 0),
    installment_value NUMERIC(10,2) NOT NULL CHECK (installment_value >= 0),
    installments_count INT NOT NULL DEFAULT 1 CHECK (installments_count > 0),
    default_due_day INT NOT NULL DEFAULT 10 CHECK (default_due_day BETWEEN 1 AND 31),
    
    discount_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (discount_percentage BETWEEN 0 AND 100),
    scholarship_notes TEXT,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FKs compostas
    CONSTRAINT fk_financial_plans_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_financial_plans_class
        FOREIGN KEY (tenant_id, class_id)
        REFERENCES public.classes(tenant_id, id)
        ON DELETE SET NULL,

    CONSTRAINT uq_financial_plans_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_financial_plans_tenant ON public.financial_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_plans_course ON public.financial_plans(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS idx_financial_plans_class ON public.financial_plans(tenant_id, class_id);

DROP TRIGGER IF EXISTS trg_financial_plans_tenant_immutable ON public.financial_plans;
CREATE TRIGGER trg_financial_plans_tenant_immutable
    BEFORE UPDATE ON public.financial_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 2. TABELA DE CONTAS A RECEBER / PARCELAS (receivables)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    financial_plan_id UUID,
    
    title VARCHAR(200) NOT NULL,
    charge_type VARCHAR(50) NOT NULL DEFAULT 'mensalidade'
        CHECK (charge_type IN ('matricula', 'mensalidade', 'taxa_material', 'avulso')),
    
    installment_number INT NOT NULL DEFAULT 1 CHECK (installment_number > 0),
    total_installments INT NOT NULL DEFAULT 1 CHECK (total_installments >= installment_number),
    
    original_amount NUMERIC(10,2) NOT NULL CHECK (original_amount >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    final_amount NUMERIC(10,2) NOT NULL CHECK (final_amount >= 0),
    
    due_date DATE NOT NULL,
    
    status VARCHAR(30) NOT NULL DEFAULT 'em_aberto'
        CHECK (status IN ('em_aberto', 'pago', 'vencido', 'cancelado', 'estornado')),
    
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    paid_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FKs compostas
    CONSTRAINT fk_receivables_student
        FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_receivables_enrollment
        FOREIGN KEY (tenant_id, enrollment_id)
        REFERENCES public.enrollments(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_receivables_financial_plan
        FOREIGN KEY (tenant_id, financial_plan_id)
        REFERENCES public.financial_plans(tenant_id, id)
        ON DELETE SET NULL,

    CONSTRAINT uq_receivables_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_receivables_enrollment_installment UNIQUE (tenant_id, enrollment_id, charge_type, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_receivables_tenant ON public.receivables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receivables_student ON public.receivables(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_receivables_enrollment ON public.receivables(tenant_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(tenant_id, status);

DROP TRIGGER IF EXISTS trg_receivables_tenant_immutable ON public.receivables;
CREATE TRIGGER trg_receivables_tenant_immutable
    BEFORE UPDATE ON public.receivables
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 3. TABELA DE REGISTROS DE PAGAMENTO E BAIXA (payment_records)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    receivable_id UUID NOT NULL,
    
    amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid > 0),
    payment_method VARCHAR(50) NOT NULL
        CHECK (payment_method IN ('dinheiro', 'pix', 'boleto_manual', 'cartao_debito', 'cartao_credito', 'transferencia', 'outro')),
    
    paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    receipt_number VARCHAR(100) NOT NULL,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reversal_reason TEXT,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FK composta
    CONSTRAINT fk_payment_records_receivable
        FOREIGN KEY (tenant_id, receivable_id)
        REFERENCES public.receivables(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_payment_records_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_payment_records_receipt UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_tenant ON public.payment_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_receivable ON public.payment_records(tenant_id, receivable_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON public.payment_records(tenant_id, paid_at);

DROP TRIGGER IF EXISTS trg_payment_records_tenant_immutable ON public.payment_records;
CREATE TRIGGER trg_payment_records_tenant_immutable
    BEFORE UPDATE ON public.payment_records
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 4. TRIGGER DE SEGURANÇA: BLINDAGEM DE RECEBÍVEIS (ANTI-ADULTERAÇÃO)
-- ==============================================================================
-- Impede que alunos atualizem pagamentos ou status diretamente via UPDATE
CREATE OR REPLACE FUNCTION public.protect_receivable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        -- Alunos jamais podem alterar contas a receber
        IF NOT (
            public.is_platform_operator()
            OR (
                NEW.tenant_id IN (SELECT get_auth_tenant_ids())
                AND public.get_auth_role_in_tenant(NEW.tenant_id) IN ('admin', 'financeiro', 'secretaria')
            )
        ) THEN
            RAISE EXCEPTION 'Operação proibida: você não possui permissão para gerenciar cobranças escolares.';
        END IF;

        -- Impede alteração de student_id e enrollment_id após inserção
        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Operação proibida: o aluno vinculado à cobrança é imutável.';
        END IF;

        IF NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id THEN
            RAISE EXCEPTION 'Operação proibida: a matrícula vinculada à cobrança é imutável.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_receivable_fields ON public.receivables;
CREATE TRIGGER trg_protect_receivable_fields
    BEFORE UPDATE ON public.receivables
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_receivable_fields();


-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================
ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. FINANCIAL_PLANS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS financial_plans_select_policy ON public.financial_plans;
CREATE POLICY financial_plans_select_policy ON public.financial_plans
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = financial_plans.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro', 'secretaria')
        )
    );

DROP POLICY IF EXISTS financial_plans_write_policy ON public.financial_plans;
CREATE POLICY financial_plans_write_policy ON public.financial_plans
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = financial_plans.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = financial_plans.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro')
        )
    );

-- ------------------------------------------------------------------------------
-- B. RECEIVABLES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS receivables_select_policy ON public.receivables;
CREATE POLICY receivables_select_policy ON public.receivables
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = receivables.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'financeiro', 'secretaria')
                  OR (
                      tu.role = 'aluno'
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.id = receivables.student_id
                            AND s.tenant_id = receivables.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS receivables_write_policy ON public.receivables;
CREATE POLICY receivables_write_policy ON public.receivables
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = receivables.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = receivables.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro', 'secretaria')
        )
    );

-- ------------------------------------------------------------------------------
-- C. PAYMENT_RECORDS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_records_select_policy ON public.payment_records;
CREATE POLICY payment_records_select_policy ON public.payment_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = payment_records.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'financeiro', 'secretaria')
                  OR (
                      tu.role = 'aluno'
                      AND EXISTS (
                          SELECT 1 FROM public.receivables r
                          JOIN public.students s ON s.id = r.student_id AND s.tenant_id = r.tenant_id
                          WHERE r.id = payment_records.receivable_id
                            AND r.tenant_id = payment_records.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS payment_records_write_policy ON public.payment_records;
CREATE POLICY payment_records_write_policy ON public.payment_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = payment_records.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = payment_records.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'financeiro')
        )
    );
