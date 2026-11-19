import type { Tenant, TeoClassRole, PlanTier } from "@/types/database";

export interface UpdateInstitutionInput {
  name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
}

export interface TeamMemberDTO {
  id: string; // tenant_user.id
  user_id: string;
  email: string;
  full_name: string;
  role: TeoClassRole;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
}

export interface InviteTeamMemberInput {
  email: string;
  full_name: string;
  role: "secretaria" | "financeiro" | "professor";
  initial_password?: string;
}

export interface UpdateTeamMemberRoleInput {
  membership_id: string;
  role: "admin" | "secretaria" | "financeiro" | "professor";
}

export interface ToggleTeamMemberStatusInput {
  membership_id: string;
  is_active: boolean;
}

export interface InstitutionSettingsDTO {
  tenant: Tenant;
  team_members: TeamMemberDTO[];
  plan_entitlements: {
    plan_tier: PlanTier;
    features: {
      ead: boolean;
      provas: boolean;
      financeiro: boolean;
      certificados: boolean;
      captacao_ia: boolean;
    };
  };
}
