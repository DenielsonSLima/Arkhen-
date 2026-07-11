# Memória do Agente Banco de Dados (Supabase)

Esta é a memória persistente do **Agente Banco de Dados**. Ela serve para rastrear migrações, estruturas de tabelas, funções RPC criadas e políticas RLS para garantir a segurança multi-empresa.

## 📌 Estado Atual do Banco de Dados
* **Status**: Base real do módulo Configurações aplicada no Supabase remoto via MCP `contabil`.
* **Provedor**: Supabase.
* **Isolamento de Dados**: Tabelas parametrizadas com RLS para isolar dados com base no `empresa_id` (ID do escritório de contabilidade).
* **Projeto Supabase**: `dgklhykjwzmeqxejlicz`.

## 🗄️ Tabelas e Relacionamentos

### Base Multi-Tenant (Aplicada)
- `empresas`: tenant principal e clientes/filiais via `parent_empresa_id`.
- `perfis`: vínculo `auth.users.id` -> `empresa_id`, usado por RLS.

### Configurações (Aplicadas)
- `configuracoes_empresa`: dados cadastrais, endereço e logo do escritório.
- `configuracoes_marca_dagua`: estado, posição, opacidade e arquivo da marca d'água.
- `configuracoes_contadores`: contadores vinculados ao tenant.
- `configuracoes_usuarios`: usuários convidados/visíveis no módulo.
- `configuracoes_perfis_acesso`: perfis de acesso e permissões.
- `configuracoes_contas_bancarias`: contas financeiras configuradas pelo escritório.
- `configuracoes_integracao_bancaria`: provedores bancários e payload seguro de configuração.
- `configuracoes_integracao_fiscal`: provedores fiscais por UF/município.
- `configuracoes_armazenamento`: limites e retenção.
- `configuracoes_compartilhamento`: regras de links/compartilhamento.
- `configuracoes_calculadora`: preferências da calculadora.
- `configuracoes_api_status`: status de serviços externos.
- `configuracoes_eventos_logs`: trilha de auditoria do módulo.

### 1. contas_bancarias (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `empresa_id`: uuid (Referência para tenant/RLS)
- `banco`: varchar(100)
- `agencia`: varchar(20)
- `numero_conta`: varchar(30)
- `tipo_conta`: varchar(30) ('corrente' | 'poupança')
- `saldo_inicial`: numeric(15, 2)
- `saldo_atual`: numeric(15, 2)

### 2. cnaes (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `codigo`: varchar(20) UNIQUE
- `descricao`: text
- `simples_nacional`: boolean
- `simples_anexo`: varchar(20) ('Anexo I' ao 'Anexo V' ou 'N/A')
- `presuncao_irpj`: numeric(5, 2)
- `presuncao_csll`: numeric(5, 2)

### 3. regras_imposto (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `empresa_id`: uuid
- `nome`: varchar(150)
- `regime`: varchar(50) ('Lucro Presumido' | 'Lucro Real')
- `cnae_codigo`: varchar(20) (FK para cnaes)
- `cst_pis`: varchar(5)
- `aliquota_pis`: numeric(5, 2)
- `cst_cofins`: varchar(5)
- `aliquota_cofins`: numeric(5, 2)

### 4. regras_cnab (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `empresa_id`: uuid
- `nome`: varchar(150)
- `banco`: varchar(50)
- `tipo_regra`: varchar(20) ('cobranca' | 'conciliacao')
- `multa`: numeric(5, 2) NULL
- `juros`: numeric(5, 2) NULL
- `dias_tolerancia`: integer NULL
- `padrao_texto`: varchar(150) NULL
- `conta_contabil`: varchar(150) NULL

### 5. clientes_empresas (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `empresa_id`: uuid (Escritório contábil)
- `nome`: varchar(150)
- `cnpj`: varchar(20) UNIQUE
- `regime`: varchar(50) ('Simples Nacional' | 'Lucro Presumido' | 'Lucro Real')
- `modelos_ativos`: text[] (Array de chaves FK de modelos ativos, ex: `['folha', 'dctfweb']`)

### 6. modelos_atividades (Planejada / Simulada no Frontend)
- `id`: varchar(50) PRIMARY KEY
- `nome`: varchar(100)
- `descricao`: text
- `etapas`: text[] (Lista ordenada de itens de checklist)

### 7. atividades_instancias (Planejada / Simulada no Frontend)
- `id`: uuid PRIMARY KEY
- `empresa_id`: uuid
- `cliente_id`: uuid (FK para clientes_empresas)
- `modelo_id`: varchar(50) (FK para modelos_atividades)
- `competencia`: varchar(10) (MM/AAAA)
- `status`: varchar(20) ('Pendente' | 'Em andamento' | 'Concluída')
- `checklists`: jsonb (Estado de check de cada etapa, ex: `{"Fazer folha": true, "Gerar FGTS": false}`)
- `valores`: jsonb (Valores consolidados declarados, ex: `{"valorInss": 1250.00, "valorIrrf": 350.00, "valorReinf": 0.00}`)

## 🔐 Políticas RLS Estabelecidas
* Toda tabela de Configurações possui RLS ativo comparando `empresa_id` via `public.is_empresa_member(empresa_id)`.
* `empresas` e `perfis` também possuem RLS; `perfis` permite leitura do próprio usuário e membros da empresa.

## ⚙️ Funções RPC Criadas
* `public.current_empresa_id()`: retorna a primeira empresa ativa do usuário autenticado.
* `public.is_empresa_member(p_empresa_id uuid)`: valida vínculo de tenant.
* `public.upsert_configuracoes_empresa(p_payload jsonb)`: grava dados da empresa usando a empresa da sessão.
* `public.upsert_configuracoes_marca_dagua(p_payload jsonb)`: grava marca d'água usando a empresa da sessão.
* `public.perfis_acesso_padrao()`: catálogo SQL dos 5 perfis RBAC padrão.
* `public.seed_perfis_acesso_empresa(p_empresa_id uuid)`: materializa perfis padrão para o tenant autenticado.
* `public.listar_configuracoes_perfis_acesso()`: lista perfis do tenant; sem auth, retorna apenas catálogo padrão não sensível.
* `public.upsert_configuracoes_perfil_acesso(...)`: cria/edita perfis e permissões no tenant.
* `public.desativar_configuracoes_perfil_acesso(p_id uuid)`: desativa perfis personalizados.

## ⚠️ Histórico de Migrações
* `20260710190315_configuracoes_base`: aplicada via MCP `contabil`.
* `20260710190653_configuracoes_realtime`: publicou `configuracoes_empresa` e `configuracoes_marca_dagua` em `supabase_realtime`.
* `20260710191446_rbac_perfis_acesso`: adicionou RBAC e RPCs de perfis.
* `20260710191458_rbac_perfis_realtime`: publicou `configuracoes_perfis_acesso` em `supabase_realtime`.
* `20260710192915_seed_empresa_perfis_acesso`: criou empresa seed ARKHEN e materializou 5 perfis padrão em `configuracoes_perfis_acesso`.
* `20260710193306_perfis_padrao_por_empresa`: criou trigger para semear perfis padrão em toda nova empresa e alterou desativação para `ativo = false` sem exclusão física.
* `20260710195141_parametrizacao_base`: criou as tabelas multi-tenant de Parametrização com RLS, índices, timestamps, realtime e seed inicial por empresa: `parametrizacao_catalogos`, `parametrizacao_regimes_tributarios`, `parametrizacao_cnaes`, `parametrizacao_regras_imposto`, `parametrizacao_regras_cnab`, `parametrizacao_prazos_entrega`, `parametrizacao_protocolos_tipos`, `parametrizacao_documentos_funcionarios` e `parametrizacao_parametros_calculo`.
* `20260710195312_parametrizacao_seed_novas_empresas`: criou `parametrizacao_defaults` e trigger seguro `seed_parametrizacao_defaults_after_empresa_insert` para toda nova empresa nascer com os padrões do módulo Parametrização sem expor função pública com `empresa_id` arbitrário.
* `20260710200834_agenda_atividades_base`: criou as tabelas multi-tenant de Agenda e Atividades com RLS, índices, timestamps, realtime, defaults e trigger seguro para novas empresas: `agenda_tipos_evento`, `agenda_categorias_evento`, `agenda_responsaveis`, `agenda_eventos`, `atividades_modelos`, `atividades_rotinas`, `atividades_tarefas`, `atividades_instancias`, `atividades_fechamentos`, `agenda_defaults` e `atividades_defaults`.
* `limpar_seeds_operacionais_atividades`: aplicado via MCP `contabil`; removeu dados operacionais/defaults de Atividades (`atividades_defaults`, `atividades_modelos`, `atividades_rotinas`, `atividades_tarefas`, `atividades_instancias`, `atividades_fechamentos`) e parou o seed automático de Atividades para empresas novas.
* `limpar_seeds_operacionais_agenda`: aplicado via MCP `contabil`; removeu dados operacionais/defaults de Agenda (`agenda_defaults`, `agenda_tipos_evento`, `agenda_categorias_evento`, `agenda_responsaveis`, `agenda_eventos`) e transformou `seed_agenda_atividades_defaults_after_empresa_insert()` em no-op para que empresas novas não recebam Agenda/Atividades preenchidas automaticamente.
