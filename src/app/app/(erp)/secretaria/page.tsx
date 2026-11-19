import React from "react";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getStudentsAction } from "@/app/actions/secretaria";
import { SecretariaClient } from "@/components/secretaria/SecretariaClient";

export default async function SecretariaPage() {
  const session = await requireTenantSession();

  // Guarda de permissão centralizada no servidor
  assertPermission(session.role, "secretaria:view");

  const students = await getStudentsAction({ status: "all" });

  return (
    <div className="max-w-7xl mx-auto">
      <SecretariaClient
        initialStudents={students}
        tenantName={session.tenant.name}
      />
    </div>
  );
}
