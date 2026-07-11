# Registro de Alterações do Projeto: Contabil

Este documento mantém o histórico ordenado cronologicamente de todas as modificações significativas realizadas no código-fonte, arquitetura e banco de dados do sistema **Contabil**.

---

## [2026-07-10] Módulos Agenda e Atividades

### 🚀 Novidades & Implementações
* Criada no Supabase, via MCP `contabil`, a migration remota `20260710200834_agenda_atividades_base`.
* Criadas tabelas com `empresa_id`, RLS por empresa, timestamps, realtime e dados padrão:
  * `agenda_tipos_evento`
  * `agenda_categorias_evento`
  * `agenda_responsaveis`
  * `agenda_eventos`
  * `atividades_modelos`
  * `atividades_rotinas`
  * `atividades_tarefas`
  * `atividades_instancias`
  * `atividades_fechamentos`
* Criadas tabelas internas de defaults `agenda_defaults` e `atividades_defaults`, bloqueadas por RLS sem política pública.
* Criado trigger seguro `seed_agenda_atividades_defaults_after_empresa_insert`, para novas empresas nascerem com padrões de Agenda/Atividades.
* Renomeado `agenda.mock.ts` para `agenda.defaults.ts`, removendo nomenclatura de mock da Agenda.
* Removido `window.location.reload()` do fluxo de vincular rotina em Atividades.

### ✅ Validação
* Conferido no Supabase: tabelas populadas com defaults, RLS ativo e trigger registrado em `empresas`.
* `npm run build` executado com sucesso.

### ⚠️ Pendências
* As telas internas de Agenda e Atividades ainda precisam migrar chamadas de `localStorage` para Supabase + TanStack Query.

---

## [2026-07-10] Módulo Parametrização

### 🚀 Novidades & Implementações
* Removida a pasta antiga `src/modules/gestor/cadastros`; o módulo agora fica em `src/modules/gestor/parametrizacao`.
* Atualizados imports, ids de abas e menu lateral para `parametrizacao-*`.
* Criadas no Supabase, via MCP `contabil`, as migrations remotas:
  * `20260710195141_parametrizacao_base`
  * `20260710195312_parametrizacao_seed_novas_empresas`
* Criadas tabelas com `empresa_id`, `ativo`, `sistema`, RLS por empresa e realtime:
  * `parametrizacao_catalogos`
  * `parametrizacao_regimes_tributarios`
  * `parametrizacao_cnaes`
  * `parametrizacao_regras_imposto`
  * `parametrizacao_regras_cnab`
  * `parametrizacao_prazos_entrega`
  * `parametrizacao_protocolos_tipos`
  * `parametrizacao_documentos_funcionarios`
  * `parametrizacao_parametros_calculo`
* Criado seed padrão para a empresa atual e trigger seguro para novas empresas nascerem com dados de Parametrização.

### ✅ Validação
* `npm run build` executado com sucesso após a renomeação do frontend.
* Conferido no Supabase: tabelas populadas, RLS ativo e trigger `seed_parametrizacao_defaults_after_empresa_insert` registrado em `empresas`.

---

## [2026-07-10] RBAC de Perfis de Acesso

### 🚀 Novidades & Implementações
* Criadas e aplicadas via MCP as migrations:
  * `rbac_perfis_acesso`
  * `rbac_perfis_realtime`
  * `seed_empresa_perfis_acesso`
  * `perfis_padrao_por_empresa`
* Adicionados campos de RBAC em `configuracoes_perfis_acesso`: `codigo`, `sistema`, `ativo`, `ordem`.
* Criados 5 perfis padrão com permissões granulares:
  * `Gestor`: acesso amplo de operação, financeiro, configurações, usuários e perfis.
  * `Financeiro`: faturamento, financeiro, contas bancárias e integração bancária; sem administração de usuários/perfis.
  * `Funcionário`: acesso apenas à própria rotina operacional, agenda, atividades, protocolos e documentos.
  * `Analista Fiscal`: clientes, parametrização, atividades fiscais, protocolos, conformidade, simulações e integração fiscal; sem financeiro do escritório.
  * `Cliente Externo`: portal/visão própria de documentos, protocolos, atividades e faturamento.
* Criadas RPCs:
  * `perfis_acesso_padrao`
  * `seed_perfis_acesso_empresa`
  * `listar_configuracoes_perfis_acesso`
  * `upsert_configuracoes_perfil_acesso`
  * `desativar_configuracoes_perfil_acesso`
* `Perfis de Acesso` e `Permissões do Sistema` passaram a consumir Supabase/TanStack Query, sem `localStorage`, `alert` ou `confirm`.
* `configuracoes_perfis_acesso` foi publicada em `supabase_realtime`.
* Criada a empresa seed `ARKHEN Gestão Contábil` (`11111111-1111-4111-8111-111111111111`) e materializados os 5 perfis padrão em `configuracoes_perfis_acesso`, para aparecerem no Table Editor do Supabase.
* Criado trigger `seed_perfis_acesso_after_empresa_insert`: toda empresa criada recebe automaticamente os perfis padrão.
* Ajustado fluxo de remoção para inativação (`ativo = false`) em vez de exclusão física, inclusive para perfis de sistema.
* Observação: a tabela `perfis` não é a lista de perfis de acesso; ela guarda vínculos entre `auth.users` e `empresa_id`.

### 🔎 Revisão do Módulo Configurações
* Já sem mock/localStorage nos submódulos trabalhados: Dados da Empresa, Marca d'Água, Perfis de Acesso e Permissões.
* Ainda dependem de mock/localStorage e precisam de próxima migração: Meu Perfil, Usuários, Contadores, Contas Bancárias, Integração Bancária, Integração Fiscal, Compartilhamento, Calculadora, Armazenamento, Status das APIs e Logs/Eventos.

---

## [2026-07-10] Integração Supabase MCP - Configurações

### 🚀 Novidades & Implementações
* Configurado o frontend para usar `@tanstack/react-query` via `QueryClientProvider`.
* Criada a migration `20260710000100_configuracoes_base.sql` e aplicada no Supabase pelo MCP `contabil`.
* Criadas tabelas multi-tenant com RLS para o módulo Configurações:
  * `empresas`, `perfis`
  * `configuracoes_empresa`, `configuracoes_marca_dagua`
  * `configuracoes_contadores`, `configuracoes_usuarios`, `configuracoes_perfis_acesso`
  * `configuracoes_contas_bancarias`, `configuracoes_integracao_bancaria`, `configuracoes_integracao_fiscal`
  * `configuracoes_armazenamento`, `configuracoes_compartilhamento`, `configuracoes_calculadora`
  * `configuracoes_api_status`, `configuracoes_eventos_logs`
* Criadas RPCs seguras com `SECURITY DEFINER` e `search_path` explícito:
  * `current_empresa_id`
  * `is_empresa_member`
  * `upsert_configuracoes_empresa`
  * `upsert_configuracoes_marca_dagua`
* Dados da Empresa e Marca d'Água passaram de mock para Supabase.
* Adicionado realtime para invalidar queries TanStack quando `configuracoes_empresa` ou `configuracoes_marca_dagua` mudarem.
* Publicadas `configuracoes_empresa` e `configuracoes_marca_dagua` em `supabase_realtime` via migration `configuracoes_realtime`.

### 🔧 Ajustes & Correções de Bugs
* `.env.local` já aponta para o projeto Supabase `dgklhykjwzmeqxejlicz`.
* Build validado com `npm run build`.
* Observação: o login atual ainda é mock/localStorage; para gravar dados com RLS em produção, será necessário integrar Supabase Auth e popular `perfis`.

---

## [2026-07-03] Inicialização e Estrutura de Agentes (Customizações)

### 🚀 Novidades & Implementações
* **Criação das Regras do Workspace (`.agents/AGENTS.md`)**: Configuração inicial de diretrizes invioláveis de arquitetura (frontend burro, cálculos via RPC, isolamento multi-empresa com RLS, invalidação TanStack Query, limite estrito de 500 linhas, pastas modulares).
* **Definição de Habilidades dos Agentes (`.agents/skills/`)**:
  * `frontend_developer`: Diretrizes de organização de formulários e hooks no frontend.
  * `database_architect`: Normas para criação de tabelas, políticas RLS e funções RPC.
  * `code_reviewer`: Regras para controle de tamanho de arquivos e conformidade estrutural.
  * `cybersecurity_expert`: Auditoria de RLS, prevenção de SQL injection e segurança de RPC.
  * `integration_specialist`: Regras para integrações com gateways de pagamento (Asaas, Pix) e webhooks.
  * `performance_optimization`: Diretrizes de caching (TanStack Query), renderizações React e indexação do banco.
* **Criação dos Arquivos de Memórias dos Agentes (`.agents/memories/`)**:
  * `frontend_memory.md`, `database_memory.md` e `revisor_memory.md` inicializados.
* **Contextualização RAG Inicial**:
  * Criação do arquivo central `PROJETO_CONTEXTO.md` na raiz do repositório.
  * Criação deste arquivo de histórico `PROJETO_ALTERACOES.md` na raiz do repositório.

### 🔧 Ajustes & Correções de Bugs
* N/A (Primeira entrega do repositório).

---

## 📈 Próximos Passos Recomendados
1. Inicialização do projeto frontend (React/Vite) ou configuração inicial de migrações do banco com Supabase CLI.
2. Criação do primeiro módulo (`modules/inicio`) para testar o fluxo de formulários modulares.
3. Testar a integração do TanStack Query e as mutações invalidando queries.
