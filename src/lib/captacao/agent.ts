// ==============================================================================
// TeoClass — Motor de Atendimento com IA & Proteção contra Abuso (Lote 12)
// ==============================================================================

import type { PublicCourseSummary } from "@/types/captacao";

/**
 * Sanitiza a entrada do visitante para neutralizar tentativas de prompt injection
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return "";
  let clean = input.trim();
  // Limite razoável de caracteres por mensagem
  if (clean.length > 1000) {
    clean = clean.substring(0, 1000);
  }
  // Normaliza tags e sequências potencialmente perigosas
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return clean;
}

/**
 * Detecta padrões de Prompt Injection conhecidos
 */
export function detectPromptInjection(text: string): boolean {
  const patterns = [
    /ignore previous instructions/i,
    /ignore all previous/i,
    /desconsidere as instruções anteriores/i,
    /esqueça as instruções anteriores/i,
    /system prompt/i,
    /você agora é/i,
    /you are now/i,
    /dan mode/i,
    /developer mode/i,
    /modo desenvolvedor/i,
    /reveal your secret/i,
    /mostre seu prompt/i,
    /qual é a sua chave/i,
    /api key/i,
    /bypass rules/i,
    /eval\(/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Monta o Prompt de Sistema com base estrita nos dados autorizados da escola
 */
export function buildInstitutionalSystemPrompt(params: {
  schoolName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  courses: PublicCourseSummary[];
  customInstructions?: string;
}): string {
  const { schoolName, contactEmail, contactPhone, courses, customInstructions } = params;

  const coursesList = courses.map((c) => {
    let priceText = "Consulte nossos planos e bolsas no formulário de interesse.";
    if (c.price_info && c.price_info.installment_value > 0) {
      priceText = `${c.price_info.installments_count}x de R$ ${c.price_info.installment_value.toFixed(2)}`;
      if (c.price_info.enrollment_fee > 0) {
        priceText += ` (Taxa de matrícula: R$ ${c.price_info.enrollment_fee.toFixed(2)})`;
      }
    }
    return `- **${c.name}** (${c.modality.toUpperCase()}): Carga horária de ${c.workload_hours}h${c.duration_months ? `, duração média de ${c.duration_months} meses` : ""}. ${c.description || "Formação teológica sólida."} Valor estimado: ${priceText}`;
  }).join("\n");

  return `Você é o assistente virtual oficial da instituição teológica "${schoolName}".
Sua missão é atender interessados e vocacionados que acessam a página pública da instituição, tirando dúvidas sobre nossos cursos, duração, metodologia e processo de inscrição.

DIRETRIZES DE SEGURANÇA E CONDUTA (INVIOLÁVEIS):
1. Use EXCLUSIVAMENTE as informações institucionais listadas abaixo.
2. NUNCA invente preços, descontos, bolsas, vagas, datas ou promessas que não estejam explicitamente detalhadas neste catálogo.
3. Se o interessado perguntar sobre algo que não consta nas informações autorizadas, responda cordialmente que não possui essa confirmação no momento e oriente-o a preencher o formulário de contato/interesse na página para que a Secretaria Acadêmica o atenda diretamente.
4. NUNCA ofereça aconselhamento pastoral pessoal, direção espiritual privativa, julgamentos eclesiásticos ou diagnósticos psicológicos.
5. NUNCA acesse ou mencione dados de outros alunos, notas, matrículas internas, sistema financeiro ou outras escolas.
6. Mantenha tom cristão, acolhedor, transparente, educado e profissional.

CONTATOS OFICIAIS:
- E-mail: ${contactEmail || "Consulte a secretaria na página"}
- Telefone/WhatsApp: ${contactPhone || "Consulte a secretaria na página"}

CATÁLOGO DE CURSOS AUTORIZADOS:
${coursesList || "No momento os cursos estão em processo de atualização pela secretaria acadêmica."}

${customInstructions ? `INSTRUÇÕES ADICIONAIS DA ESCOLA:\n${customInstructions}` : ""}`;
}

/**
 * Executa a chamada à OpenAI API ou devolve fallback gracioso
 */
export async function callOpenAIAgent(params: {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}): Promise<{ reply: string; usedFallback: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Fallback caso a chave não esteja configurada ou seja provisória
  if (!apiKey || apiKey.includes("sua-chave") || apiKey.trim() === "") {
    return {
      reply: "Olá! Agradecemos seu contato. No momento nosso atendimento interativo com inteligência artificial está temporariamente offline. Por favor, utilize o formulário de interesse abaixo nesta página para que nossa Secretaria Acadêmica entre em contato direto com você!",
      usedFallback: true,
    };
  }

  try {
    const payloadMessages = [
      { role: "system", content: params.systemPrompt },
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: payloadMessages,
        max_tokens: 350,
        temperature: 0.3, // Baixa temperatura para respostas determinísticas e sem alucinação
      }),
    });

    if (!response.ok) {
      console.warn(`[OpenAI Call Failed]: HTTP ${response.status}`);
      return {
        reply: "Estamos com alta demanda no momento. Para garantir seu atendimento, sugerimos preencher o formulário de contato nesta página!",
        usedFallback: true,
      };
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content?.trim();

    return {
      reply: replyText || "Paz! Como posso auxiliá-lo com nossos cursos teológicos?",
      usedFallback: false,
    };
  } catch (err: any) {
    console.error("[OpenAI Agent Error]:", err.message);
    return {
      reply: "Nosso assistente está indisponível no momento. Por favor, envie sua mensagem através do formulário de contato que retornaremos em breve!",
      usedFallback: true,
    };
  }
}
