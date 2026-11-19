// ==============================================================================
// TeoClass — Tipos do Módulo Financeiro Escolar Acadêmico (Lote 10)
// ==============================================================================

export type ChargeType = "matricula" | "mensalidade" | "taxa_material" | "avulso";
export type ReceivableStatus = "em_aberto" | "pago" | "vencido" | "cancelado" | "estornado";
export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "boleto_manual"
  | "cartao_debito"
  | "cartao_credito"
  | "transferencia"
  | "outro";

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  matricula: "Taxa de Matrícula",
  mensalidade: "Mensalidade Escolar",
  taxa_material: "Material Didático",
  avulso: "Cobrança Avulsa",
};

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  em_aberto: "Em Aberto",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro / Espécie",
  boleto_manual: "Boleto Bancário (Baixa Manual)",
  cartao_debito: "Cartão de Débito",
  cartao_credito: "Cartão de Crédito",
  transferencia: "Transferência / TED / DOC",
  outro: "Outro Método",
};

/**
 * Plano Financeiro (Regra de cobrança por curso/turma)
 */
export interface FinancialPlan {
  id: string;
  tenant_id: string;
  course_id: string;
  class_id: string | null;
  name: string;
  description: string | null;
  enrollment_fee: number;
  installment_value: number;
  installments_count: number;
  default_due_day: number;
  discount_percentage: number;
  scholarship_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relações
  course?: { id: string; name: string };
  school_class?: { id: string; name: string } | null;
}

export interface FinancialPlanInput {
  course_id: string;
  class_id?: string | null;
  name: string;
  description?: string | null;
  enrollment_fee: number;
  installment_value: number;
  installments_count: number;
  default_due_day: number;
  discount_percentage?: number;
  scholarship_notes?: string | null;
  is_active?: boolean;
}

/**
 * Conta a Receber / Parcela
 */
export interface Receivable {
  id: string;
  tenant_id: string;
  student_id: string;
  enrollment_id: string;
  financial_plan_id: string | null;
  title: string;
  charge_type: ChargeType;
  installment_number: number;
  total_installments: number;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  due_date: string;
  status: ReceivableStatus;
  paid_amount: number;
  paid_at: string | null;
  notes: string | null;
  // Campos de Gateway Asaas (Opcionais - Migration 0014)
  gateway_provider?: "asaas" | null;
  gateway_charge_id?: string | null;
  gateway_invoice_url?: string | null;
  gateway_pix_qrcode?: string | null;
  gateway_pix_image_url?: string | null;
  gateway_payment_method?: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED" | null;
  gateway_synced_at?: string | null;
  created_at: string;
  updated_at: string;
  // Relações carregadas
  student?: {
    id: string;
    full_name: string;
    cpf: string | null;
    email: string | null;
  };
  enrollment?: {
    id: string;
    enrollment_number: string;
    course_name?: string;
  };
  payments?: PaymentRecord[];
}

/**
 * Registro de Pagamento / Baixa Manual
 */
export interface PaymentRecord {
  id: string;
  tenant_id: string;
  receivable_id: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  paid_at: string;
  received_by: string | null;
  receipt_number: string;
  is_reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateInstallmentsInput {
  enrollment_id: string;
  financial_plan_id: string;
  first_due_date: string;
  custom_discount_percentage?: number;
}

export interface RecordPaymentInput {
  receivable_id: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  paid_at?: string;
}

export interface ReversePaymentInput {
  payment_id: string;
  reason: string;
}

/**
 * Indicadores Financeiros da Escola
 */
export interface SchoolFinancialMetrics {
  totalReceivable: number;      // Total geral a receber
  totalReceived: number;        // Total pago / arrecadado
  totalOverdue: number;         // Total vencido / inadimplência
  totalPending: number;         // Total a vencer
  defaultRatePercentage: number;// Taxa de inadimplência
  totalChargesCount: number;
  paidChargesCount: number;
  overdueChargesCount: number;
}

// ==============================================================================
// TIPOS DE GATEWAY ESCOLAR (ASAAS) — FUNDAÇÃO SEGURA (LOTE 15 - FASE 1)
// ==============================================================================

export type GatewayProvider = "asaas";
export type GatewayEnvironment = "sandbox" | "production";
export type GatewayEventStatus = "received" | "processed" | "ignored" | "failed";

export interface TenantGatewayConfig {
  id: string;
  tenant_id: string;
  provider: GatewayProvider;
  is_active: boolean;
  environment: GatewayEnvironment;
  api_key_last_four: string;
  account_number: string | null;
  wallet_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantGatewayConfigInput {
  provider?: GatewayProvider;
  is_active?: boolean;
  environment: GatewayEnvironment;
  api_key: string;
  webhook_access_token?: string;
}

export interface GatewayEventRecord {
  id: string;
  tenant_id: string;
  provider: GatewayProvider;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: GatewayEventStatus;
  error_message?: string | null;
  processed_at: string;
  created_at: string;
}
