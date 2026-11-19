-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0012_1: BLINDAGEM DE EXECUÇÃO DA RPC DE RATE LIMITING
-- ==============================================================================
-- Motivação da Auditoria de Segurança:
-- A função check_and_increment_rate_limit foi criada com SECURITY DEFINER para
-- permitir incrementos atômicos e consistentes na tabela rate_limit_buckets.
-- Como o PostgreSQL por padrão concede EXECUTE em novas funções para PUBLIC
-- (incluindo anon e authenticated), um visitante malicioso munido da chave anon
-- poderia invocar a RPC diretamente via HTTP PostgREST (/rest/v1/rpc/check_and_increment_rate_limit)
-- passando um tenant_id de terceiros e uma bucket_key previsível (ex: cota diária),
-- esgotando arbitrariamente os tokens da instituição vítima.
--
-- Correção Adotada (Princípio do Menor Privilégio):
-- 1. REVOKE EXECUTE ON FUNCTION check_and_increment_rate_limit FROM PUBLIC, anon, authenticated;
-- 2. GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit TO service_role;
--
-- Dessa forma:
-- - Apenas o backend confiável da aplicação (Server Actions / API Routes via createAdminClient / service_role)
--   consegue invocar a RPC de rate limiting.
-- - Nenhum cliente anon ou discente/terceiro consegue invocar ou manipular cotas diretamente via PostgREST.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INT, INT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, VARCHAR, INT, INT) TO service_role;
