/**
 * Cliente HTTP Tipado do Asaas (Server-Side)
 * 
 * Invariantes de Segurança e Arquitetura:
 * 1. Executa exclusivamente no servidor Next.js / Server Actions.
 * 2. Separação estrita de ambientes (Sandbox vs Produção).
 * 3. Timeout rigoroso (10 segundos) com AbortController.
 * 4. Tratamento seguro de erros sanitizando mensagens sem vazar o token em logs ou exceções.
 * 5. Teste de conexão não-destrutivo: consulta perfil/conta do Asaas (GET /v3/myAccount ou GET /v3/finance/balance).
 * 6. ZERO emissão de cobranças ou movimentação financeira durante testes de conexão.
 */

export type AsaasEnvironment = "sandbox" | "production";

export interface AsaasClientOptions {
  apiKey: string;
  environment: AsaasEnvironment;
  timeoutMs?: number;
}

export interface AsaasAccountSummary {
  id?: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  walletId?: string;
  accountNumber?: string;
}

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  externalReference?: string | null;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
}

export type AsaasBillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasCreatePaymentInput {
  customer: string; // Asaas Customer ID (cus_...)
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string; // receivable_id local
  postalService?: boolean;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  externalReference?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 da imagem QR Code
  payload: string; // Linha cópia e cola
  expirationDate?: string;
}

export interface AsaasPingResult {
  success: boolean;
  environment: AsaasEnvironment;
  account?: AsaasAccountSummary;
  error?: string;
}

const ASAAS_URLS: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

export class AsaasClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly environment: AsaasEnvironment;
  private readonly timeoutMs: number;

  constructor(options: AsaasClientOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new Error("Chave de API do Asaas não fornecida.");
    }

    this.apiKey = options.apiKey.trim();
    this.environment = options.environment || "sandbox";
    this.baseUrl = ASAAS_URLS[this.environment];
    this.timeoutMs = options.timeoutMs || 10000;
  }

  /**
   * Sanitiza mensagens de erro para garantir que a chave de API nunca apareça em logs.
   */
  private sanitizeError(err: any): string {
    if (!err) return "Erro desconhecido na comunicação com o Asaas.";
    let msg = typeof err === "string" ? err : err.message || JSON.stringify(err);
    if (this.apiKey && this.apiKey.length > 5) {
      msg = msg.split(this.apiKey).join("[PROTECTED_KEY]");
    }
    return msg;
  }

  /**
   * Executa requisição autenticada genérica ao Asaas.
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TeoClass-Platform/1.0",
          access_token: this.apiKey,
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        let errorDescription = `Erro HTTP ${response.status}`;
        if (data && data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          errorDescription = data.errors.map((e: any) => e.description || e.code).join("; ");
        } else if (data && data.message) {
          errorDescription = data.message;
        }

        throw new Error(this.sanitizeError(errorDescription));
      }

      return data as T;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Tempo limite esgotado (${this.timeoutMs / 1000}s) ao comunicar com a API do Asaas.`);
      }
      throw new Error(this.sanitizeError(err.message || err));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Testa a conexão e autenticação com o Asaas de forma 100% não-destrutiva.
   * Não emite cobranças nem move fundos. Apenas consulta os dados da conta da instituição.
   */
  async ping(): Promise<AsaasPingResult> {
    try {
      // Consulta a identificação cadastral da conta institucional
      const accountData = await this.request<any>("/myAccount");

      return {
        success: true,
        environment: this.environment,
        account: {
          id: accountData?.id,
          name: accountData?.name || accountData?.tradingName,
          email: accountData?.email,
          cpfCnpj: accountData?.cpfCnpj,
          walletId: accountData?.walletId,
          accountNumber: accountData?.accountNumber ? `${accountData.accountNumber.agency}/${accountData.accountNumber.account}` : undefined,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        environment: this.environment,
        error: this.sanitizeError(err.message || err),
      };
    }
  }

  /**
   * Cria ou busca cliente no Asaas pelo CPF/CNPJ.
   */
  async createOrFindCustomer(input: AsaasCustomerInput): Promise<AsaasCustomerResponse> {
    if (input.cpfCnpj) {
      const cleanCpfCnpj = input.cpfCnpj.replace(/\D/g, "");
      const searchRes = await this.request<{ data: AsaasCustomerResponse[] }>(
        `/customers?cpfCnpj=${cleanCpfCnpj}`
      );
      if (searchRes && searchRes.data && searchRes.data.length > 0) {
        return searchRes.data[0];
      }
    }

    // Se não encontrou, cria novo cliente no Asaas
    return this.request<AsaasCustomerResponse>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        cpfCnpj: input.cpfCnpj ? input.cpfCnpj.replace(/\D/g, "") : undefined,
        email: input.email || undefined,
        phone: input.phone || undefined,
        mobilePhone: input.mobilePhone || undefined,
        externalReference: input.externalReference || undefined,
      }),
    });
  }

  /**
   * Emite cobrança no Asaas (Pix, Boleto ou Cartão).
   */
  async createPayment(input: AsaasCreatePaymentInput): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: input.customer,
        billingType: input.billingType,
        value: input.value,
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        postalService: input.postalService ?? false,
      }),
    });
  }

  /**
   * Obtém QR Code e linha copia-e-cola Pix de uma cobrança existente.
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
    return this.request<AsaasPixQrCodeResponse>(`/payments/${paymentId}/pixQrCode`);
  }

  /**
   * Consulta cobranças existentes com filtro por externalReference.
   * Usado para garantir idempotência efetiva antes de emitir nova cobrança,
   * prevenindo duplicidades mesmo em cenários de concorrência ou retries.
   */
  async findPaymentByExternalReference(
    externalReference: string
  ): Promise<AsaasPaymentResponse | null> {
    if (!externalReference) return null;
    const res = await this.request<{ data: AsaasPaymentResponse[] }>(
      `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`
    );
    if (res && res.data && res.data.length > 0) {
      return res.data[0];
    }
    return null;
  }
}
