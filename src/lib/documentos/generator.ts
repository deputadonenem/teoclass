import QRCode from "qrcode";

/**
 * Mascara CPF no padrão LGPD (ex: 123.***.***-00)
 */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "***.***.***-**";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length < 11) return "***.***.***-**";
  return `${clean.slice(0, 3)}.***.***-${clean.slice(-2)}`;
}

/**
 * Gera um número sequencial e amigável para o documento (ex: TC-CERT-2026-X9Y2Z)
 */
export function generateDocumentNumber(type: "certificado_conclusao" | "declaracao_matricula" | "historico_escolar"): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  let prefix = "DOC";
  if (type === "certificado_conclusao") prefix = "CERT";
  if (type === "declaracao_matricula") prefix = "DEC";
  if (type === "historico_escolar") prefix = "HIST";
  return `TC-${prefix}-${year}-${rand}`;
}

/**
 * Gera um token de verificação criptograficamente seguro e único
 */
export function generateVerificationToken(): string {
  const rand1 = Math.random().toString(36).substring(2);
  const rand2 = Math.random().toString(36).substring(2);
  const time = Date.now().toString(36);
  return `${rand1}${time}${rand2}`.substring(0, 48);
}

/**
 * Gera QR Code em formato Data URL (imagem base64 PNG) para o link de verificação pública
 */
export async function generateQrCodeDataUrl(verificationUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(verificationUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: "#0f172a", // Slate-900
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    return "";
  }
}
