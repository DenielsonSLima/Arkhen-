# Contexto Geral do Projeto: Contabil

Este é o arquivo central de contexto (RAG) do sistema **Contabil**, contendo a visão geral, objetivos de negócio, stack tecnológica e diretrizes do ecossistema.

## 🎯 Visão do Sistema
O **Contabil** é uma plataforma multi-empresa (multi-tenant) desenvolvida para gerenciar fluxos contábeis, tributários e financeiros de forma eficiente, segura e em tempo real. O sistema foi projetado sob a premissa de isolamento rígido entre clientes e delegação completa de processos pesados/cálculos ao banco de dados.

## 🛠️ Stack Tecnológica
* **Frontend**: React (SPA/Vite/Next.js) + TypeScript
* **Estilização**: Vanilla CSS (CSS puro para máximo controle, performance e customização visual premium)
* **Gerenciamento de Estado & Requisições**: TanStack Query (React Query)
* **Backend & Banco de Dados**: Supabase (PostgreSQL)
* **Segurança**: Row Level Security (RLS) nativo do Supabase + JWT Authentication

## 🔐 Pilares de Cibersegurança
1. **Isolamento de Tenants**: Toda tabela obrigatoriamente possui a coluna `empresa_id` ou `tenant_id` e políticas RLS restritas para garantir que um usuário autenticado só visualize, atualize ou remova dados de sua empresa.
2. **Cálculos Server-Side**: O frontend é tratado como "burro" (visualização limpa). Todo cálculo matemático e processamento de regras tributárias/contábeis ocorre em ambiente controlado no PostgreSQL via RPCs, reduzindo a superfície de ataque e garantindo a consistência das operações.
3. **Prepared Statements**: Sem concatenação de strings para queries SQL, minimizando riscos de injeção de comandos.
4. **Princípio do Menor Privilégio**: As chaves de acesso público do cliente (anon key) têm escopo altamente restrito pelo RLS. Operações administrativas rodam estritamente via Service Role/Backend.

## 📁 Convenção de Diretórios (Arquitetura Modular)
A arquitetura do projeto é estritamente modular sob a raiz `modules/`:
```
modules/
├── inicio/                   # Exemplo de Módulo Inicial (Dashboard)
│   ├── services/             # Requisições Supabase e chamadas de API
│   ├── hooks/                # Hooks customizados para lógica do React
│   ├── queries/              # Hooks do TanStack Query (queries/mutações)
│   └── forms/                # Pasta específica para formulários do módulo
│       ├── FormCard.tsx      # Card container principal do formulário
│       ├── AddForm.tsx       # Formulário de criação/adição
│       └── EditForm.tsx      # Formulário de edição
└── parceiros/                # Módulo de Parceiros
    ├── services/
    ├── hooks/
    ├── queries/
    └── forms/
```
**Regra Estrita**: Nenhum arquivo contendo código fonte no projeto pode ultrapassar 500 linhas. Arquivos que atinjam essa marca devem ser desmembrados em unidades lógicas menores.

## 🧩 Estado Atual do Módulo Configurações
* O projeto Supabase ativo é `https://dgklhykjwzmeqxejlicz.supabase.co`.
* A migration `configuracoes_base` criou a base multi-tenant (`empresas`, `perfis`) e as tabelas dos submódulos de configurações com RLS ativo.
* O frontend já possui `QueryClientProvider` com TanStack Query e realtime para invalidar as queries de `configuracoes_empresa` e `configuracoes_marca_dagua`; as duas tabelas foram publicadas em `supabase_realtime`.
* Dados da Empresa e Marca d'Água já buscam dados no Supabase e salvam via RPC (`upsert_configuracoes_empresa`, `upsert_configuracoes_marca_dagua`), sem cálculo de negócio no frontend.
* Perfis de Acesso/RBAC já buscam dados no Supabase via RPC `listar_configuracoes_perfis_acesso`; os perfis padrão são `Gestor`, `Financeiro`, `Funcionário`, `Analista Fiscal` e `Cliente Externo`.
* Os 5 perfis padrão também foram materializados na tabela `configuracoes_perfis_acesso` para a empresa seed `ARKHEN Gestão Contábil`. Toda nova linha em `empresas` dispara um trigger que cria esses perfis padrão automaticamente para a nova empresa.
* Perfis de acesso não devem ser excluídos fisicamente. O fluxo correto é marcar `ativo = false` para inativar, preservando histórico e modelo. A tabela `perfis` é somente para vínculo usuário-empresa.
* A matriz de Permissões do Sistema consome os mesmos perfis/RBAC do Supabase, sem `localStorage`.
* Toda gravação segura depende de usuário autenticado no Supabase com vínculo em `perfis`. O login visual ainda é mock/localStorage e precisa ser substituído por Supabase Auth para uso real das policies.
