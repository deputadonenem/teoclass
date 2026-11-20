import { NextRequest, NextResponse } from "next/server";
import { processAsaasWebhook } from "@/lib/financeiro/asaas_webhook";

/**
 * Route Handler para Webhooks Asaas com TenantId explícito na URL
 * 
 * Suporta:
 * - POST /api/webhooks/asaas/[tenantId]
 * - Header de validação oficial: 'asaas-access-token'
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await context.params;
    const receivedHeaderToken = req.headers.get("asaas-access-token");
    const payload = await req.json().catch(() => null);

    if (!payload) {
      return NextResponse.json(
        { error: "Payload JSON inválido ou ausente." },
        { status: 400 }
      );
    }

    const result = await processAsaasWebhook(payload, receivedHeaderToken, tenantId);

    return NextResponse.json(
      { message: result.message, isDuplicate: result.isDuplicate },
      { status: result.statusCode }
    );
  } catch (err: any) {
    console.error("Erro interno no processamento do webhook Asaas parametrizado:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor de webhooks." },
      { status: 500 }
    );
  }
}
