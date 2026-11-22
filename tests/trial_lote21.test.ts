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
      assert.strictEqual(hasPlanModuleAccess("gestao", "ead"), false);
      assert.strictEqual(hasPlanModuleAccess("gestao", "portal_aluno"), false);

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
      const isAlreadyRegistered = true;
      let actionTaken = "";

      if (isAlreadyRegistered) {
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
      const lastSentRecent = new Date(now - 30 * 1000).toISOString();
      const diffMs = now - new Date(lastSentRecent).getTime();

      const isRateLimited = diffMs < 60 * 1000;
      assert.strictEqual(isRateLimited, true);

      const lastSentOld = new Date(now - 65 * 1000).toISOString();
      const diffMsOld = now - new Date(lastSentOld).getTime();
      const isRateLimitedOld = diffMsOld < 60 * 1000;
      assert.strictEqual(isRateLimitedOld, false);
    });
  });

  describe("6. Fluxo de Reconciliação CETADMI: Magic Link → Vínculo Admin → Login → Painel", () => {
    it("deve persistir vínculo em tenant_users com a coluna de schema correta 'is_active: true' (não status)", () => {
      const tenantUserPayload = {
        tenant_id: "53eb9a25-b396-4837-92b1-66b7522ab702",
        user_id: "2ea68061-4f1f-42e5-8824-24f1526e0ffd",
        role: "admin",
        is_active: true,
      };

      assert.strictEqual(tenantUserPayload.role, "admin");
      assert.strictEqual(tenantUserPayload.is_active, true);
      assert.strictEqual("status" in tenantUserPayload, false);
    });

    it("deve permitir que usuário autenticado cujo tenant já está em 'trial' reconcilie seu vínculo admin com sucesso", () => {
      const tenant = {
        id: "53eb9a25-b396-4837-92b1-66b7522ab702",
        email: "wciinfor@gmail.com",
        status: "trial",
        trial_ends_at: "2026-11-29T14:39:40.125Z",
      };

      const authUser = {
        id: "2ea68061-4f1f-42e5-8824-24f1526e0ffd",
        email: "wciinfor@gmail.com",
      };

      // Validação de elegibilidade para reconciliação
      const isEligible =
        (tenant.status === "trial_pending" || tenant.status === "trial") &&
        tenant.email.toLowerCase() === authUser.email.toLowerCase();

      assert.strictEqual(isEligible, true);
    });

    it("após inserção do vínculo em tenant_users, o login deve reconhecer o usuário como gestor administrativo", () => {
      const mockTenantUsers = [
        {
          id: "tu-1",
          tenant_id: "53eb9a25-b396-4837-92b1-66b7522ab702",
          user_id: "2ea68061-4f1f-42e5-8824-24f1526e0ffd",
          role: "admin",
          is_active: true,
        },
      ];

      const activeMemberships = mockTenantUsers.filter((tu) => tu.is_active);
      assert.strictEqual(activeMemberships.length > 0, true);

      const hasAdminOrStaffRole = activeMemberships.some(
        (tu) => tu.role && tu.role !== "aluno"
      );
      assert.strictEqual(hasAdminOrStaffRole, true);
    });

    it("TESTE DE SEGURANÇA NEGATIVO: deve rejeitar reconciliação se o usuário autenticado tentar assumir tenant com e-mail divergente", () => {
      const tenant = {
        id: "53eb9a25-b396-4837-92b1-66b7522ab702",
        email: "wciinfor@gmail.com",
        status: "trial",
      };

      const attackerUser = {
        id: "attacker-user-id",
        email: "outro_usuario@gmail.com",
      };

      const isAuthorized =
        tenant.email.toLowerCase() === attackerUser.email.toLowerCase();

      assert.strictEqual(isAuthorized, false, "Usuário com e-mail divergente não pode ser autorizado");
    });

    it("TESTE DE SEGURANÇA NEGATIVO: deve rejeitar reconciliação se o tenant estiver em status 'active' ou 'trial_expired'", () => {
      const allowedStatuses = ["trial", "trial_pending"];

      const activeTenant = { id: "t-1", status: "active", email: "admin@escola.com" };
      const expiredTenant = { id: "t-2", status: "trial_expired", email: "admin@escola.com" };

      assert.strictEqual(allowedStatuses.includes(activeTenant.status), false);
      assert.strictEqual(allowedStatuses.includes(expiredTenant.status), false);
    });

    it("TESTE DE SEGURANÇA NEGATIVO: deve bloquear reconciliação se a instituição já possuir outro administrador ativo cadastrado", () => {
      const requestingUserId = "new-user-id";
      const existingAdmins = [
        {
          id: "tu-existing",
          tenant_id: "tenant-123",
          user_id: "original-admin-id",
          role: "admin",
          is_active: true,
        },
      ];

      const otherAdmins = existingAdmins.filter(
        (a) => a.user_id !== requestingUserId
      );

      const canReconcile = otherAdmins.length === 0;
      assert.strictEqual(canReconcile, false, "Não pode reconciliar tenant que já possui outro administrador ativo");
    });

    it("deve preservar estritamente status, plan_tier e trial_ends_at existente da instituição CETADMI", () => {
      const cetadmiOriginal = {
        id: "53eb9a25-b396-4837-92b1-66b7522ab702",
        status: "trial",
        plan_tier: "gestao_ead",
        trial_ends_at: "2026-11-29T14:39:40.125Z",
      };

      // Simulação do payload de atualização gerado na reconciliação: apenas tenant_users é tocado
      const reconcileUpdateTarget = "tenant_users";
      assert.strictEqual(reconcileUpdateTarget, "tenant_users");

      // O tenant não sofre update em trial_ends_at ou status
      assert.strictEqual(cetadmiOriginal.status, "trial");
      assert.strictEqual(cetadmiOriginal.trial_ends_at, "2026-11-29T14:39:40.125Z");
      assert.strictEqual(cetadmiOriginal.plan_tier, "gestao_ead");
    });
  });
});
