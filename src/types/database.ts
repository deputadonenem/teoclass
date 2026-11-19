// ==============================================================================
// TeoClass — Tipos Fundamentais de Banco de Dados, Multi-Tenancy e RBAC
// ==============================================================================

export type TeoClassRole =
  | "admin"       // Administrador institucional
  | "secretaria"  // Secretaria acadêmica e matrículas
  | "financeiro"  // Gestão financeira escolar
  | "professor"   // Corpo docente
  | "aluno";      // Discente

export type TenantStatus = "active" | "suspended" | "trial" | "inactive";
export type PlanTier = "gestao" | "gestao_ead" | "institucional";

export interface Tenant {
  id: string;
  name: string;
  trade_name: string | null;
  slug: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  plan_tier: PlanTier;
  logo_url?: string | null;
  primary_color?: string | null;
  website?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_platform_operator: boolean; // Operador central TeoClass (com auditoria reforçada)
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TeoClassRole;
  is_active: boolean;
  custom_permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Partial<Tenant> & Pick<Tenant, "name" | "slug">;
        Update: Partial<Tenant>;
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email" | "full_name">;
        Update: Partial<Profile>;
      };
      tenant_users: {
        Row: TenantUser;
        Insert: Partial<TenantUser> & Pick<TenantUser, "tenant_id" | "user_id" | "role">;
        Update: Partial<TenantUser>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & Pick<AuditLog, "tenant_id" | "action" | "resource_type">;
        Update: Partial<AuditLog>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_auth_tenant_ids: {
        Args: Record<string, never>;
        Returns: { tenant_id: string }[];
      };
      get_auth_role_in_tenant: {
        Args: { p_tenant_id: string };
        Returns: TeoClassRole | null;
      };
      is_platform_operator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      teoclass_role: TeoClassRole;
      tenant_status: TenantStatus;
    };
  };
}
