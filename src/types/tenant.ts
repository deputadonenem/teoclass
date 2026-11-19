import { Tenant, Profile, TeoClassRole } from "./database";

export interface AuthenticatedTenantSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  tenant: Tenant;
  role: TeoClassRole;
  isPlatformOperator: boolean;
  availableTenants: Array<{
    tenant: Tenant;
    role: TeoClassRole;
  }>;
}

export type TenantResolutionResult =
  | { success: true; session: AuthenticatedTenantSession }
  | { success: false; reason: "UNAUTHENTICATED" | "NO_TENANT_MEMBERSHIP" | "TENANT_NOT_FOUND" | "TENANT_INACTIVE" | "CONFIGURATION_MISSING"; message: string };
