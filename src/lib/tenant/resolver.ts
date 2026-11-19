import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthenticatedTenantSession, TenantResolutionResult } from "@/types/tenant";
import { Tenant, Profile, TenantUser, TeoClassRole } from "@/types/database";
import { cookies } from "next/headers";
import { TEOCLASS_ACTIVE_TENANT_COOKIE } from "./constants";

export { TEOCLASS_ACTIVE_TENANT_COOKIE };

interface TenantUserWithTenant extends TenantUser {
  tenant: Tenant;
}

/**
 * Resolução Segura de Tenant no Servidor.
 * - Identifica o usuário autenticado via Supabase Auth.
 * - Busca todos os vínculos de tenant ativos do usuário.
 * - Valida a preferência de tenant via cookie 'teoclass_active_tenant'.
 * - Garante que o usuário só consiga operar em tenants para os quais possui vínculo legítimo e ativo.
 * - Trata de forma segura o caso de ausência de variáveis de infraestrutura.
 */
export async function resolveTenantSession(): Promise<TenantResolutionResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      reason: "CONFIGURATION_MISSING",
      message: "Serviço de banco de dados e autenticação TeoClass ainda não configurado neste ambiente.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      reason: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    };
  }

  // Buscar perfil do usuário
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = (profileData as unknown as Profile) || {
    id: user.id,
    email: user.email || "",
    full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
    avatar_url: null,
    phone: null,
    is_platform_operator: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Buscar todos os vínculos do usuário com instituições
  const { data: memberships, error: membershipsError } = await supabase
    .from("tenant_users")
    .select(`
      id,
      tenant_id,
      user_id,
      role,
      is_active,
      custom_permissions,
      created_at,
      updated_at,
      tenant:tenants (
        id,
        name,
        trade_name,
        slug,
        cnpj,
        email,
        phone,
        status,
        plan_tier,
        settings,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (membershipsError || !memberships || memberships.length === 0) {
    return {
      success: false,
      reason: "NO_TENANT_MEMBERSHIP",
      message: "Usuário não possui vínculo ativo com nenhuma instituição cadastrada.",
    };
  }

  const typedMemberships = memberships as unknown as TenantUserWithTenant[];

  // Filtra tenants válidos (não inativos)
  const validTenants = typedMemberships
    .filter((m) => m.tenant && m.tenant.status !== "inactive")
    .map((m) => ({
      tenant: m.tenant,
      role: m.role as TeoClassRole,
    }));

  if (validTenants.length === 0) {
    return {
      success: false,
      reason: "TENANT_INACTIVE",
      message: "As instituições vinculadas a este usuário estão inativas ou suspensas.",
    };
  }

  // Verificar preferência de tenant via cookie
  const cookieStore = await cookies();
  const preferredTenantId = cookieStore.get(TEOCLASS_ACTIVE_TENANT_COOKIE)?.value;

  let activeMembership = preferredTenantId
    ? typedMemberships.find((m) => m.tenant_id === preferredTenantId)
    : null;

  // Fallback para o primeiro tenant válido caso o preferencial não exista ou não pertença ao usuário
  if (!activeMembership || !activeMembership.tenant || activeMembership.tenant.status === "inactive") {
    activeMembership = typedMemberships.find((m) => m.tenant && m.tenant.status !== "inactive")!;
  }

  const session: AuthenticatedTenantSession = {
    user: {
      id: user.id,
      email: user.email || "",
    },
    profile,
    tenant: activeMembership.tenant,
    role: activeMembership.role,
    isPlatformOperator: Boolean(profile.is_platform_operator),
    availableTenants: validTenants,
  };

  return {
    success: true,
    session,
  };
}

/**
 * Obtém a sessão de tenant garantida para uso em Server Actions.
 * Lança exceção caso a autenticação ou vínculo não sejam válidos.
 */
export async function requireTenantSession(): Promise<AuthenticatedTenantSession> {
  const result = await resolveTenantSession();
  if (!result.success) {
    throw new Error(`Falha na autorização do tenant: ${result.message} (${result.reason})`);
  }
  return result.session;
}
