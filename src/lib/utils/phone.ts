/**
 * Utilitários para validação e formatação de Telefones Brasileiros
 */

export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatPhone(phone: string): string {
  const cleaned = cleanPhone(phone);

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
}

export function isValidPhone(phone: string): boolean {
  const cleaned = cleanPhone(phone);
  return cleaned.length === 10 || cleaned.length === 11;
}
