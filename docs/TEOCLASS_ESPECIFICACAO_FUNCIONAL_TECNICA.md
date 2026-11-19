# TeoClass — Especificação Funcional e Técnica

**Versão:** 1.0 — planejamento consolidado  
**Data:** 16/11/2026  
**Organização:** Alcântara Sistemas  
**Situação:** documento de planejamento; **não autoriza implementação**.  
**Origem técnica candidata:** Educar360, mediante cópia controlada e independente.

## 1. Objetivo e princípios

TeoClass é um SaaS multi-tenant para escolas teológicas, seminários e instituições cristãs, com gestão acadêmica, financeira e, conforme o plano, EAD. Priorizar experiência simples, rápida e intuitiva para pequenas e médias instituições. Evitar funcionalidades de educação básica não aplicáveis, complexidade administrativa, LMS avançado, apps nativos e infraestrutura própria de vídeo.

**Regra de produto:** nenhuma função deve aparecer para quem não a utiliza ou não tem permissão. Toda decisão de implementação deve privilegiar clareza, segurança, baixo custo operacional e capacidade de expansão gradual.

## 2. Planos e modelo comercial

- **Gestão:** secretaria, alunos, cursos, turmas, equipe, financeiro escolar, calendário e certificados conforme regras do produto; sem sala de aula EAD.
- **Gestão + EAD:** tudo do plano Gestão, acrescido de aulas online, materiais, progresso, banco de questões e provas rotativas.
- **Institucional:** contratação personalizada para instituições com requisitos específicos, sem transformar a experiência padrão em produto complexo.
- Cobrança mensal fixa por faixa de alunos ativos; cada aluno é contado uma única vez se possuir ao menos uma matrícula vigente. Alunos apenas históricos/inativos não consomem faixa.
- Faixas e valores **hipotéticos, sujeitos à validação financeira**:

| Alunos ativos | Gestão | Gestão + EAD |
|---|---:|---:|
| Até 50 | R$ 59,90 | R$ 99,90 |
| 51–150 | R$ 89,90 | R$ 149,90 |
| 151–300 | R$ 129,90 | R$ 219,90 |
| 301–500 | R$ 189,90 | R$ 299,90 |
| Acima de 500 | Sob consulta | Sob consulta |

- Exceder faixa gera alerta e proposta de ajuste para ciclo futuro, sem bloqueio abrupto.
- Onboarding autônomo gratuito nos planos padrão; implantação assistida e importações especiais podem ser cobradas separadamente.
- **Assinaturas SaaS:** governadas pelo Alcântara Hub, com conta Asaas corporativa. TeoClass consome estado e direitos contratados por integração M2M autenticada, idempotente, com proteção contra replay e atualização fora de ordem. Não duplicar lógica de cobrança corporativa do Educar360.
- **Financeiro escolar:** cada instituição recebe de seus próprios alunos; operação manual e integração opcional com **Asaas próprio da escola**, nunca com a conta corporativa do Hub.

## 3. Perfis e permissões

Cinco perfis visíveis: **Administrador, Secretaria, Financeiro, Professor e Aluno**. Um usuário pode ter múltiplos papéis e vínculos com mais de uma instituição; permissões sempre avaliadas no contexto do tenant e, quando necessário, da turma/matrícula.

- Administrador: configura instituição e autoriza operações institucionais.
- Secretaria: cadastros, matrículas, turmas, documentação e registros acadêmicos.
- Financeiro: lançamentos, cobranças e conciliação do financeiro escolar.
- Professor: somente suas turmas, presença, conteúdos e avaliações atribuídas.
- Aluno: somente seus cursos, progresso, notas, documentos e obrigações financeiras.

A plataforma dispõe separadamente de operador central autorizado, com auditoria reforçada. Nunca conceder acesso transversal apenas com base em parâmetro enviado pelo navegador.

## 4. Módulos e requisitos funcionais

### 4.1 Início

Painel com alunos ativos, matrículas recentes, recebimentos/pendências, aulas próximas e avisos relevantes. Sem gráficos excessivos. Respeitar papel e módulos contratados.

### 4.2 Alunos e secretaria

Cadastro enxuto: identificação, contato, documentos necessários e dados institucionais opcionais. Dados de igreja local, pastor e atuação ministerial **opcionais**, sem exigir testemunho pessoal ou informações sensíveis. Responsável legal opcional quando aplicável, inclusive para menores. Pré-inscrição, matrícula, transferência de turma, trancamento, cancelamento, histórico e documentos; auditoria de alterações. Prevenir duplicações sem impedir matrículas distintas.

### 4.3 Cursos e turmas

Dois formatos por curso:
1. **Simples:** curso → aulas → conclusão.
2. **Estruturado:** curso → módulos opcionais → disciplinas opcionais → aulas/avaliações → conclusão.

Suportar presencial, híbrido e EAD assíncrono; turmas com calendário ou cursos em ritmo próprio. Professor vinculado a curso/turma/disciplina. Não impor séries, quatro bimestres, 200 dias letivos, horários escolares rígidos ou exigências de educação básica.

### 4.4 Financeiro da instituição

Mensalidades, matrícula e curso de pagamento único, contas a receber/pagar, descontos, bolsas, registros de pagamento manual, estornos/cancelamentos auditados e visão simples de inadimplência. Integração Asaas opcional por tenant, com credenciais protegidas e webhooks validados. Não suspender automaticamente acesso acadêmico por inadimplência de aluno; qualquer restrição requer análise legal e regra institucional explícita.

### 4.5 Portal do aluno

Área responsiva com cursos matriculados, calendário, aulas EAD se contratadas, notas, frequência, financeiro e certificados. Mostrar somente recursos aplicáveis. Dados de um aluno nunca podem ser lidos por outro.

### 4.6 EAD

Aulas com vídeo incorporado do YouTube e materiais PDF em armazenamento privado. Registrar progresso por matrícula e aula. YouTube não listado **não é proteção forte contra compartilhamento**; não prometer DRM nem medição infalível de tempo assistido. Não hospedar streaming próprio. Não exigir sala ao vivo, fórum ou chat complexo.

### 4.7 Questões e provas

Banco por curso/disciplina, questões objetivas (múltipla escolha e verdadeiro/falso), seleção aleatória, embaralhamento de alternativas, limite de tentativas, nota mínima configurável e correção no servidor. Congelar versão das questões/respostas por tentativa para preservar auditoria; nunca expor gabarito antes da conclusão autorizada. Discursivas e correção por IA ficam fora do escopo inicial.

### 4.8 Certificados

Emissão manual ou automática conforme critérios do curso; PDF com identidade da instituição, identificador único, QR Code e validação pública com divulgação mínima de dados. Suportar revogação e substituição auditadas. Não alegar reconhecimento oficial sem base jurídica. Certificados essenciais podem integrar Gestão; a conclusão automática por progresso EAD depende de Gestão + EAD.

### 4.9 Captação com IA

Página pública individual da escola, catálogo de cursos e agente OpenAI com base somente em dados públicos aprovados pelo tenant. Responder dúvidas e cadastrar interessados/pré-inscrições com transparência e consentimento adequado. IA não confirma matrícula sem critérios verificáveis e não acessa dados privados acadêmicos/financeiros. Limites de uso, custos, abuso e logs mínimos. Sem prometer aconselhamento pastoral automatizado.

### 4.10 Configurações

Dados e identidade institucional, equipe/permissões, critérios de curso, modelos de certificado, página pública e integração financeira opcional. Configuração inicial em quatro passos: escola, primeiro curso, primeira turma, página pública; recursos posteriores opcionais.

## 5. Regras de negócio transversais

- Matrícula pode ser criada pela secretaria ou originar-se de pré-inscrição pública. Aprovação manual ou automática apenas quando critérios objetivos são satisfeitos.
- Cancelamento e transferência preservam trilha histórica; não apagar avaliações/certificados emitidos para simular mudança de status.
- Conclusão exige critérios configurados de notas, presença e/ou progresso; não gerar certificado somente porque um vídeo foi aberto.
- Trancado/cancelado/concluído não deve ser confundido com ativo para cobrança por faixa; especificar regras de matrícula vigente no momento da medição.
- Mudanças de plano e suspensão de SaaS devem respeitar carência/comunicação, preservação de dados e capacidade de regularização.
- A escola controla dados de seus alunos; aplicar princípios da LGPD, minimização, finalidade, retenção e exclusão conforme obrigação legal.

## 6. Arquitetura e isolamento

- Next.js 16, React 19, TypeScript, Tailwind; Supabase PostgreSQL/Auth/Storage com RLS; Vercel; OpenAI API; vídeos incorporados; PWA responsivo.
- **Repositório, Supabase, Vercel, variáveis, domínios, cookies, chaves e webhooks exclusivos do TeoClass.** Não copiar `.env.local`, dados reais ou credenciais do Educar360.
- `tenant_id` obrigatório nas entidades isoladas; RLS default-deny; validação de tenant e permissões no servidor e banco; chaves service-role apenas no backend.
- Revisar funções `SECURITY DEFINER`, `search_path`, grants, constraints compostas com tenant, políticas de Storage e operações com `ON DELETE CASCADE`.
- Credenciais Asaas de escolas não devem ficar em JSONB comum acessível a consultas de tenant; armazenar em cofre/armazenamento cifrado com acesso de serviço estritamente limitado. Nunca enviar chave ao cliente após cadastro.
- Integração Hub: assinatura de mensagens, proteção de replay, idempotência, reconciliação e fonte de verdade explícita para direitos comerciais.
- Logs e auditoria sem segredos, com proteção de dados pessoais.

## 7. Modelo conceitual de dados

**Núcleo:** tenants, profiles, tenant_users, audit_logs, plan_entitlements, hub_subscription_state.  
**Acadêmico:** students, courses, course_modules (opcional), subjects (opcional), lessons, classes/cohorts, teaching_assignments, enrollments, attendance, assessments, grades, academic_history.  
**EAD:** lesson_materials, lesson_progress, question_bank, exam_definitions, exam_attempts, attempt_questions, attempt_answers.  
**Certificados:** certificate_templates, certificates, certificate_revocations.  
**Financeiro escolar:** receivables, installments, payments, payables, discounts/scholarships, tenant_gateway_config (protegida), gateway_events.  
**Captação:** public_school_profiles, leads, pre_enrollments, ai_usage_counters.  

Nomes acima são **conceituais**, não DDL aprovado. Antes de criar migrations, definir chaves, relacionamentos, estados, índices, retenção, RLS e regras de integridade. Evitar renomear mecanicamente `series` para módulos sem revisão de referências.

## 8. Inventário de reaproveitamento Educar360

**Origem:** relatórios técnicos de auditoria e extração controlada do agente Educar360, recebidos em 16/11/2026. Os relatórios apontaram 26 migrations, TypeScript sem erros e ausência de suíte automatizada homologada. **Não houve inspeção independente do repositório pelo autor desta especificação.**

| Caminho / componente de origem | Diretriz |
|---|---|
| `src/lib/supabase/` | Copiar com revisão de configuração e segurança |
| `src/lib/tenant/resolver.ts` | Adaptar cookie, contexto e regras de assinatura |
| `src/lib/tenant/trial.ts` | Não transportar lógica de cobrança/trial como fonte de verdade |
| `src/lib/rbac/permissions.ts` | Adaptar aos cinco papéis e permissões EAD |
| `src/app/actions/secretaria.ts` | Adaptar cadastro adulto e responsáveis opcionais |
| `src/app/actions/matriculas.ts` | Adaptar matrículas por curso/turma |
| `src/app/actions/academico.ts` | Remodelar hierarquia sem séries/bimestres obrigatórios |
| `src/app/actions/calendario.ts` | Reaproveitar parcialmente sem controle legal obrigatório de dias letivos |
| `src/app/actions/grade-horaria.ts` | Não incluir no núcleo inicial |
| `src/app/actions/configuracoes.ts` | Adaptar, separar Hub de financeiro escolar |
| `src/app/actions/dashboard.ts` | Simplificar métricas |
| `src/components/secretaria/` | Adaptar interfaces reutilizáveis |
| `src/components/academico/GradeHorariaView.tsx` | Não incluir no núcleo inicial |
| `src/lib/platform/asaas/client.ts` | Reaproveitar somente após revisão; uso escolar opcional, não faturamento Hub |
| `src/lib/urls.ts` e middleware | Parametrizar domínios, eliminar marca e hosts Educar360 |
| `supabase/migrations/0001...0026` | **Revisar e reconstruir** sequência limpa, sem copiar cegamente |

**Observação:** os relatórios indicaram ausência de webhook Asaas funcional e telas placeholder para financeiro, comunicação e portais. Não tratar esses recursos como prontos.

## 9. Estratégia de migrations

Criar migrations novas, pequenas e ordenadas por responsabilidade, em vez de impor número arbitrário de quatro arquivos. Separar fundação, RLS, usuários, cadastros, acadêmico, matrículas, EAD, provas, certificados, financeiro, captação e integração Hub. Cada lote deve possuir testes de isolamento e rollback/recuperação planejados. Não executar SQL no Educar360 nem copiar banco de produção.

## 10. Lotes futuros de implementação — somente após autorização

1. **Extração segura e fundação:** repositório independente, ambientes, auth, tenant, RBAC, RLS e testes cruzados.
2. **Secretaria e cadastros:** alunos adultos, responsáveis opcionais, cursos e equipe.
3. **Acadêmico e matrículas:** turmas, estrutura flexível, frequência, notas e calendário simples.
4. **Portal do aluno e certificados básicos:** acesso pessoal e emissão/verificação com auditoria.
5. **Financeiro escolar manual:** contas, mensalidades, pagamentos e relatórios essenciais.
6. **Integração Hub e direitos de plano:** assinatura, estados, módulos, faixas e tolerância.
7. **EAD:** aulas, PDFs privados, progresso e portal adaptado.
8. **Banco de questões e provas:** correção, tentativas e histórico imutável.
9. **Asaas opcional da instituição:** credenciais seguras, cobranças e conciliação.
10. **Página pública e agente IA:** catálogo, atendimento, captação e limites de consumo.
11. **Homologação integral e piloto:** segurança, fluxos completos, acessibilidade, usabilidade, custo e lançamento gradual.

**Estimativa recebida do agente:** 120–145 horas para cinco lotes agregados. **Não validada**; não contempla de forma demonstrada todos os riscos, integrações, testes e ajustes acima. Reestimar após decomposição dos lotes.

## 11. Critérios mínimos de aceite

- **Isolamento:** usuários A/B de tenants distintos não conseguem ler, gravar ou alterar dados cruzados via UI, API, queries diretas e Storage.
- **RBAC:** aluno/professor/financeiro não acessam ações não autorizadas, mesmo alterando parâmetros da requisição.
- **Acadêmico:** aluno adulto é matriculado sem responsável; turmas e cursos simples/estruturados funcionam; históricos permanecem íntegros após transferência/cancelamento.
- **EAD:** conteúdo protegido por matrícula/plano; progresso persiste; não se declara segurança de vídeo que o YouTube não oferece.
- **Provas:** sorteio e correção feitos no servidor, sem vazamento de gabarito, tentativas auditáveis e notas preservadas após editar questões.
- **Certificados:** QR público verifica autenticidade com exposição mínima; revogação e substituição funcionam.
- **Financeiro:** recebimentos de tenant A jamais alcançam B; Asaas escolar e Asaas corporativo não se misturam; webhooks autenticados e idempotentes.
- **Hub:** ativação, upgrade, downgrade, inadimplência, reconciliação e suspensão gradual não provocam acesso indevido ou perda de dados.
- **IA:** respostas restritas ao catálogo público da escola, proteção contra prompt injection, limites de custo e pré-inscrições validadas.
- **Qualidade:** typecheck, lint, testes automatizados, build, testes E2E críticos, revisão LGPD e piloto aprovado.

## 12. Decisões pendentes de validação antes do lançamento

- Preços comerciais finais, limites de IA e armazenamento, regras de excedente e retenção.
- Regras de suspensão e prazos de preservação de dados conforme contratos e legislação.
- Campos pessoais/eclesiásticos realmente necessários e política LGPD.
- Fluxo de conciliação do Asaas por escola, incluindo estornos e webhooks.
- Validação real do RLS e do funcionamento do código reaproveitado.
- Estimativa de esforço revisada por lote após testes e dependências.

## 13. Restrições para o agente executor

**Até autorização expressa do usuário:** não clonar, editar código, criar migrations, provisionar Supabase/Vercel, criar repositório, acessar produção, alterar banco, configurar gateways, realizar commit/push ou deploy. Esta especificação é exclusivamente a referência de planejamento.

**Após autorização:** executar um lote por vez, apresentar evidências de testes, manter Educar360 intacto e não adicionar funcionalidades fora do escopo sem justificativa e aprovação.
