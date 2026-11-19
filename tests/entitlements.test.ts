import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasPlanModuleAccess,
  hasPlanActionAccess,
  assertPlanEntitlement,
  PLAN_MODULE_ENTITLEMENTS,
} from "../src/lib/rbac/entitlements.ts";
import { hasModuleAccess, hasActionAccess, assertPermission } from "../src/lib/rbac/permissions.ts";

describe("TeoClass — Lote 13: Entitlements de Planos SaaS & RBAC Institucional", () => {
  describe("1. Entitlements por Plano Comercial (gestao vs gestao_ead vs institucional)", () => {
    it("Plano 'gestao' NÃO deve possuir acesso aos módulos EAD e Provas", () => {
      assert.equal(hasPlanModuleAccess("gestao", "ead"), false, "Plano gestao não deve ter EAD");
      assert.equal(hasPlanModuleAccess("gestao", "provas"), false, "Plano gestao não deve ter Provas");
      assert.equal(hasPlanActionAccess("gestao", "ead:access_lessons"), false);
      assert.equal(hasPlanActionAccess("gestao", "provas:attempt"), false);
      assert.equal(hasPlanActionAccess("gestao", "provas:manage_bank"), false);
    });

    it("Plano 'gestao' DEVE possuir acesso a secretaria, acadêmico, financeiro e certificados", () => {
      assert.equal(hasPlanModuleAccess("gestao", "secretaria"), true);
      assert.equal(hasPlanModuleAccess("gestao", "academico"), true);
      assert.equal(hasPlanModuleAccess("gestao", "financeiro"), true);
      assert.equal(hasPlanModuleAccess("gestao", "certificados"), true);
      assert.equal(hasPlanModuleAccess("gestao", "captacao"), true);
      assert.equal(hasPlanModuleAccess("gestao", "configuracoes"), true);
    });

    it("Plano 'gestao_ead' DEVE possuir acesso integral ao EAD e Provas", () => {
      assert.equal(hasPlanModuleAccess("gestao_ead", "ead"), true);
      assert.equal(hasPlanModuleAccess("gestao_ead", "provas"), true);
      assert.equal(hasPlanActionAccess("gestao_ead", "ead:access_lessons"), true);
      assert.equal(hasPlanActionAccess("gestao_ead", "provas:attempt"), true);
    });

    it("assertPlanEntitlement deve lançar erro cordial com sugestão de upgrade no plano gestao", () => {
      assert.throws(
        () => assertPlanEntitlement("gestao", "ead"),
        /não faz parte do plano contratado.*upgrade para Gestão \+ EAD/i
      );
      assert.throws(
        () => assertPlanEntitlement("gestao", "ead:manage_content"),
        /Operação não permitida no plano 'GESTAO'/i
      );
    });

    it("assertPlanEntitlement NÃO deve lançar erro no plano gestao_ead ou institucional", () => {
      assert.doesNotThrow(() => assertPlanEntitlement("gestao_ead", "ead"));
      assert.doesNotThrow(() => assertPlanEntitlement("gestao_ead", "provas:attempt"));
      assert.doesNotThrow(() => assertPlanEntitlement("institucional", "ead"));
    });
  });

  describe("2. RBAC de Configurações e Gestão de Equipe", () => {
    it("Admin deve possuir ações de gestão da instituição e equipe", () => {
      assert.equal(hasModuleAccess("admin", "configuracoes"), true);
      assert.equal(hasActionAccess("admin", "config:manage_institution"), true);
      assert.equal(hasActionAccess("admin", "config:manage_team"), true);
    });

    it("Secretaria, Financeiro, Professor e Aluno NÃO devem acessar configurações da escola", () => {
      const nonAdminRoles = ["secretaria", "financeiro", "professor", "aluno"] as const;
      for (const role of nonAdminRoles) {
        assert.equal(hasModuleAccess(role, "configuracoes"), false, `${role} não pode acessar configuracoes`);
        assert.equal(hasActionAccess(role, "config:manage_institution"), false);
        assert.equal(hasActionAccess(role, "config:manage_team"), false);
        assert.throws(() => assertPermission(role, "config:manage_institution"));
      }
    });
  });
});
