import crypto from "crypto";

/**
 * Utilitários criptográficos para tokens de ativação de trial.
 * Mantido fora das Server Actions para evitar exigência de 'async' do Next.js.
 */
export function hashActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSecureRandomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
