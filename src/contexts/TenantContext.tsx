"use client";

import React, { createContext, useContext, useState } from "react";
import { Tenant, TenantUser, Profile, TeoClassRole } from "@/types/database";
import { TEOCLASS_ACTIVE_TENANT_COOKIE } from "@/lib/tenant/constants";

export interface TenantContextState {
  tenant: Tenant | null;
  tenantUser: TenantUser | null;
  profile: Profile | null;
  role: TeoClassRole | null;
  isLoading: boolean;
  userTenants: Array<{ tenant: Tenant; role: TeoClassRole }>;
  switchTenant: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialTenant: Tenant;
  initialProfile: Profile;
  initialRole: TeoClassRole;
  initialUserTenants?: Array<{ tenant: Tenant; role: TeoClassRole }>;
}

export function TenantProvider({
  children,
  initialTenant,
  initialProfile,
  initialRole,
  initialUserTenants = [],
}: TenantProviderProps) {
  const [tenant] = useState<Tenant | null>(initialTenant);
  const [profile] = useState<Profile | null>(initialProfile);
  const [role] = useState<TeoClassRole | null>(initialRole);
  const [userTenants] = useState<Array<{ tenant: Tenant; role: TeoClassRole }>>(initialUserTenants);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true);
      // Salva preferência no cookie seguro exclusivo do TeoClass
      document.cookie = `${TEOCLASS_ACTIVE_TENANT_COOKIE}=${tenantId}; path=/; max-age=31536000; SameSite=Lax`;
      window.location.reload();
    } catch (err) {
      console.error("Erro ao alternar instituição:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantUser: null,
        profile,
        role,
        isLoading,
        userTenants,
        switchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser utilizado dentro de um TenantProvider");
  }
  return context;
}
