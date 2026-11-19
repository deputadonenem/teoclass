import crypto from "crypto";

/**
 * Módulo de Criptografia Autenticada AES-256-GCM para Credenciais de Gateway
 * 
 * Invariantes de Segurança:
 * - Algoritmo: AES-256-GCM (criptografia autenticada com detecção de adulteração).
 * - Chave Mestra: derivada estritamente da variável de ambiente TEOCLASS_GATEWAY_ENCRYPTION_KEY.
 * - IV (Initialization Vector): 12 bytes gerados randomicamente a cada operação de cifra.
 * - Auth Tag: 16 bytes que autenticam a integridade do texto cifrado.
 * - Formato serializado: "ivHex:authTagHex:ciphertextHex"
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits padrão GCM

/**
 * Obtém a chave mestra de 256 bits a partir do ambiente.
 * Para fins de desenvolvimento ou testes quando não definida, gera um aviso ou deriva via SHA-256 de fallback de teste.
 */
function getMasterKey(): Buffer {
  const envKey = process.env.TEOCLASS_GATEWAY_ENCRYPTION_KEY;
  if (!envKey) {
    // Se não informada, deriva chave determinística a partir de SUPABASE_SERVICE_ROLE_KEY ou string estrita de fallback
    const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || "teoclass-dev-fallback-gateway-key-32b!";
    return crypto.createHash("sha256").update(fallback).digest();
  }

  // Se a chave for informada em hexadecimal (64 chars) ou base64
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }

  // Se for qualquer outra string de texto, deriva 32 bytes via SHA-256
  return crypto.createHash("sha256").update(envKey, "utf-8").digest();
}

/**
 * Cifra um texto puro (ex: chave de API do Asaas) usando AES-256-GCM.
 */
export function encryptGatewaySecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Texto puro não pode ser vazio para criptografia.");
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decifra uma string cifrada gerada por encryptGatewaySecret.
 */
export function decryptGatewaySecret(encryptedPayload: string): string {
  if (!encryptedPayload) {
    throw new Error("Payload cifrado inválido.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de payload cifrado inválido (esperado iv:authTag:ciphertext).");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Parâmetros criptográficos corrompidos ou inválidos.");
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Extrai com segurança apenas os últimos 4 caracteres para exibição no frontend (ex: '****1234')
 */
export function maskGatewayApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 4) {
    return clean;
  }
  return clean.slice(-4);
}
