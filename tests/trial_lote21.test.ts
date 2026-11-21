import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isTenantTrialActive,
  isTenantTrialExpired,
  hasPlanModuleAccess,
  hasPlanActionAccess,
  assertPlanEntitlement,
} from "@/lib/rbac/entitlements";
import { assertPermission } from "@/lib/rbac/permissions";
import { hashActivationToken } from "@/lib/utils/token_hash";

describe("TeoClass Lote 21 — Homologação de Trial de 7 Dias, Expiração e Segurança", () => {
  const futureTrialDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastTrialDate = new Date(Date.now() - 1000 * 60).toISOString();

  describe("1. Entitlements e Acesso Completo Durante o Trial Ativo", () => {
    it("deve confirmar que trial com data futura está ativo", () => {
      assert.strictEqual(isTenantTrialActive("trial", futureTrialDate), true);
    });

    it("não deve considerar trial ativo se status não for 'trial'", () => {
      assert.strictEqual(isTenantTrialActive("trial_pending", futureTrialDate), false);
      assert.strictEqual(isTenantTrialActive("active", futureTrialDate), false);
      assert.strictEqual(isTenantTrialActive("trial_expired", futureTrialDate), false);
    });

    it("deve liberar EAD, Provas e Portal do Aluno mesmo para plano 'gestao' durante o trial ativo", () => {
      // Plano gestao normalmente tem ead=false e portal_aluno=false
      assert.strictEqual(hasPlanModuleAccess("gestao", "ead"), false);
      assert.strictEqual(hasPlanModuleAccess("gestao", "portal_aluno"), false);

      // Com trial ativo passado como status e vigência
      assert.strictEqual(
        hasPlanModuleAccess("gestao", "ead", "trial", futureTrialDate),
        true
      );
      assert.strictEqual(
        hasPlanModuleAccess("gestao", "portal_aluno", "trial", futureTrialDate),
        true
      );
      assert.strictEqual(
        hasPlanActionAccess("gestao", "ead:access_lessons", "trial", futureTrialDate),
        true
      );
    });

    it("assertPlanEntitlement não deve lançar erro durante o trial ativo", () => {
      assert.doesNotThrow(() => {
        assertPlanEntitlement("gestao", "ead", "trial", futureTrialDate);
        assertPlanEntitlement("gestao", "portal_aluno", "trial", futureTrialDate);
      });
    });
  });

  describe("2. Expiração de Trial e Bloqueio de Operações", () => {
    it("deve detectar corretamente que trial com data no passado expirou", () => {
      assert.strictEqual(isTenantTrialExpired("trial", pastTrialDate), true);
    });

    it("deve confirmar que status 'trial_expired' é sempre tratado como expirado", () => {
      assert.strictEqual(isTenantTrialExpired("trial_expired"), true);
    });

    it("assertPermission deve bloquear operações ativas quando status for trial_expired", () => {
      assert.throws(
        () => {
          assertPermission("admin", "secretaria:manage_students", "trial_expired");
        },
        /Período de teste grátis encerrado/
      );
    });

    it("assertPermission deve bloquear operações quando status for trial_pending (ainda não ativado)", () => {
      assert.throws(
        () => {
          assertPermission("admin", "academico:manage_courses", "trial_pending");
        },
        /Instituição pendente de ativação por e-mail/
      );
    });

    it("deve permitir operação normalmente se status for 'active' ou 'trial' vigente", () => {
      assert.doesNotThrow(() => {
        assertPermission("admin", "secretaria:manage_students", "active");
        assertPermission("admin", "secretaria:manage_students", "trial");
      });
    });
  });

  describe("3. Criptografia de Tokens e Prevenção de Violações", () => {
    it("deve produzir hash SHA-256 consistente e com 64 caracteres hexadecimais", () => {
      const token = "b3c8f8a192837465abcde98765432100";
      const hash1 = hashActivationToken(token);
      const hash2 = hashActivationToken(token);

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 64);
      assert.match(hash1, /^[a-f0-9]{64}$/);
    });

    it("tokens distintos devem produzir hashes completamente diferentes", () => {
      const h1 = hashActivationToken("token_a_123456789");
      const h2 = hashActivationToken("token_b_123456789");
      assert.notStrictEqual(h1, h2);
    });
  });
});
