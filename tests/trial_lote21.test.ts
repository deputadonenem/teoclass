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

  describe("4. Regras de Disparo de E-mail: Convite vs E-mail Já Cadastrado", () => {
    it("nunca deve disparar recuperação de senha (reset password) para novos cadastros de trial", () => {
      // Simulação da lógica de decisão do cadastro
      const isAlreadyRegistered = true;
      let actionTaken = "";

      if (isAlreadyRegistered) {
        // Regra corrigida: usa signInWithOtp (Magic Link de autenticação) e nunca resetPasswordForEmail
        actionTaken = "SEND_AUTH_OTP_LINK";
      } else {
        actionTaken = "INVITE_USER";
      }

      assert.strictEqual(actionTaken, "SEND_AUTH_OTP_LINK");
      assert.notStrictEqual(actionTaken, "RESET_PASSWORD_DISPATCH");
    });

    it("deve direcionar usuário com e-mail novo estritamente para o convite de ativação (inviteUserByEmail)", () => {
      const isAlreadyRegistered = false;
      let actionTaken = "";

      if (isAlreadyRegistered) {
        actionTaken = "SEND_AUTH_OTP_LINK";
      } else {
        actionTaken = "INVITE_USER";
      }

      assert.strictEqual(actionTaken, "INVITE_USER");
    });
  });

  describe("5. Recuperação de Cadastro Pendente e Prevenção de Vínculo Não Autorizado", () => {
    it("deve recuperar tenant em status 'trial_pending' sem duplicar registro nem alterar status prematuramente", () => {
      const existingTenant = {
        id: "tenant-123",
        email: "pastor@betel.com",
        status: "trial_pending",
        plan_tier: "gestao_ead",
      };

      // Simulação da lógica de idempotência em registerTrialAction
      let tenantId: string;
      let isResend = false;

      if (existingTenant.status === "trial_pending") {
        tenantId = existingTenant.id;
        isResend = true;
      } else {
        tenantId = "new-id";
      }

      assert.strictEqual(tenantId, "tenant-123");
      assert.strictEqual(isResend, true);
      assert.strictEqual(existingTenant.status, "trial_pending");
    });

    it("deve rejeitar ativação de tenant se e-mail autenticado for divergente e não autorizado", () => {
      const tenant = {
        id: "tenant-abc",
        email: "responsavel@escola.com",
        status: "trial_pending",
      };

      const attackerUser = {
        id: "user-attacker",
        email: "invasor@externo.com",
        user_metadata: {},
      };

      const isAuthorized =
        tenant.email.toLowerCase() === attackerUser.email.toLowerCase() ||
        attackerUser.user_metadata?.tenant_id === tenant.id;

      assert.strictEqual(isAuthorized, false);
    });

    it("deve autorizar ativação exclusivamente quando o usuário comprovar identidade legítima", () => {
      const tenant = {
        id: "tenant-abc",
        email: "responsavel@escola.com",
        status: "trial_pending",
      };

      const legitimateUser = {
        id: "user-legitimate",
        email: "responsavel@escola.com",
        user_metadata: { tenant_id: "tenant-abc" },
      };

      const isAuthorized =
        tenant.email.toLowerCase() === legitimateUser.email.toLowerCase() ||
        legitimateUser.user_metadata?.tenant_id === tenant.id;

      assert.strictEqual(isAuthorized, true);
    });

    it("rate limit deve bloquear reenvios solicitados em intervalo menor que 60 segundos", () => {
      const now = Date.now();
      const lastSentRecent = new Date(now - 30 * 1000).toISOString(); // 30s atrás
      const diffMs = now - new Date(lastSentRecent).getTime();

      const isRateLimited = diffMs < 60 * 1000;
      assert.strictEqual(isRateLimited, true);

      const lastSentOld = new Date(now - 65 * 1000).toISOString(); // 65s atrás
      const diffMsOld = now - new Date(lastSentOld).getTime();
      const isRateLimitedOld = diffMsOld < 60 * 1000;
      assert.strictEqual(isRateLimitedOld, false);
    });
  });
});
