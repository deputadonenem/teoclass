// ==============================================================================
// TeoClass — Tipos de Captação, Página Pública e Atendimento com IA (Lote 12)
// ==============================================================================

export type LeadSource = "pagina_publica" | "chat_ia" | "indicacao" | "secretaria" | "evento";
export type LeadStatus = "novo" | "em_contato" | "matriculado" | "descartado";

export interface PublicPageSettings {
  id?: string;
  tenant_id: string;
  is_published: boolean;
  show_financial_values: boolean;
  headline: string;
  subheadline: string | null;
  about_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  address_display: string | null;
  ai_agent_enabled: boolean;
  ai_agent_name: string;
  ai_agent_welcome_message: string;
  ai_agent_instructions: string;
  ai_daily_limit_messages: number;
  created_at?: string;
  updated_at?: string;
}

export interface PublicCourseSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  modality: string;
  workload_hours: number;
  duration_months: number | null;
  format: string;
  price_info?: {
    installment_value: number;
    installments_count: number;
    enrollment_fee: number;
  } | null;
}

export interface PublicSchoolInfo {
  tenant_id: string;
  name: string;
  trade_name: string | null;
  slug: string;
  settings: PublicPageSettings;
  courses: PublicCourseSummary[];
}

export interface Lead {
  id: string;
  tenant_id: string;
  course_id: string | null;
  course_name?: string;
  full_name: string;
  email: string;
  phone: string | null;
  church_name: string | null;
  notes: string | null;
  source: LeadSource;
  status: LeadStatus;
  lgpd_consent: boolean;
  lgpd_consent_at: string;
  created_at: string;
}

export interface SubmitLeadDTO {
  school_slug: string; // Resolução segura por slug
  course_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  church_name?: string | null;
  notes?: string | null;
  source?: LeadSource;
  lgpd_consent: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface ChatRequestDTO {
  school_slug: string; // Resolução segura por slug
  session_token: string;
  message: string;
}
