import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";

/**
 * Route Handler para confirmação de Auth do Supabase (Email invite, signup, recovery, magiclink).
 * Processa tanto o fluxo PKCE ('code') quanto o fluxo OTP de e-mail ('token_hash' + 'type').
 * Estabelece os cookies de sessão de forma segura via SSR e redireciona para a página de destino.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/app/ativar";
  const tenant_id = searchParams.get("tenant_id");

  // Constrói a URL de redirecionamento final preservando tenant_id se existir
  const redirectUrl = new URL(next, origin);
  if (tenant_id) {
    redirectUrl.searchParams.set("tenant_id", tenant_id);
  }

  // Prepara resposta com tratamento de cookies SSR
  let response = NextResponse.redirect(redirectUrl);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    redirectUrl.searchParams.set("error", "missing_config");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(redirectUrl);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 1. Fluxo PKCE (código de autorização)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error("[AUTH_CONFIRM_PKCE_ERROR]", error.message);
    redirectUrl.searchParams.set("error", "invalid_or_expired_code");
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Fluxo OTP / Token Hash (usado pelo verifyOtp em links de e-mail)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return response;
    }
    console.error("[AUTH_CONFIRM_OTP_ERROR]", error.message);
    redirectUrl.searchParams.set("error", "invalid_or_expired_token");
    return NextResponse.redirect(redirectUrl);
  }

  // Se nenhum parâmetro de auth estiver presente, redireciona para o destino
  return response;
}
