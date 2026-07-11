# Regras e Agentes do Workspace (Contabil)

Este repositório possui uma configuração de múltiplos agentes virtuais especializados, cada um com sua responsabilidade e memória própria. Todas as interações neste workspace devem aderir às regras invioláveis abaixo.

---

## 1. Regras Invioláveis (Inviolable Rules)

### 🔴 Regra 1: Frontend Burro & Cálculos via RPC (Server-Side)
* **O Frontend NÃO faz cálculos de negócios**: O frontend deve ser puramente de exibição e coleta de dados.
* **Cálculos via RPC**: Todos os cálculos matemáticos, contábeis, tributários ou de negócios devem ser delegados ao banco de dados ou ao backend através de **Supabase RPC (Remote Procedure Call)** ou funções seguras no backend.

### 🔴 Regra 2: Isolamento Multi-Empresa com Segurança RLS (Supabase)
* **Segurança RLS Obrigatória**: Todas as tabelas no banco de dados devem ter Row Level Security (RLS) habilitado.
* **Isolamento por Empresa**: Toda consulta, inserção, atualização ou deleção de dados deve ser validada contra o ID do tenant/empresa (`empresa_id` ou `tenant_id`) associado à sessão do usuário autenticado. Políticas de RLS devem proibir estritamente o vazamento de dados entre diferentes empresas.

### 🔴 Regra 3: Atualização em Tempo Real com TanStack Query
* **Invalidação de Queries**: Sempre que ocorrer uma alteração de dados (mutação - inserção, edição ou exclusão), a query correspondente no TanStack Query deve ser invalidada imediatamente (`queryClient.invalidateQueries`) para forçar a sincronização e atualização em tempo real da interface.

### 🔴 Regra 4: Estrutura de Pastas Modularizada
* **Divisão de Módulos**: O projeto deve ser organizado em módulos sob a pasta `modules/` (ex: `modules/inicio/`, `modules/parceiros/`).
* **Subpastas por Responsabilidade**: Cada módulo deve conter subpastas bem definidas para isolar responsabilidades:
  * `services/` - Arquivos de chamadas de API/Supabase.
  * `hooks/` - Hooks React customizados.
  * `queries/` - Consultas e mutações do TanStack Query.
  * `forms/` - Subpasta específica para formulários, contendo arquivos separados para o card principal do formulário, adição (`AddForm`), edição (`EditForm`), etc.
* **Sem Código Solto**: Evitar misturar lógica de busca de dados diretamente em componentes de UI.

### 🔴 Regra 5: Limite Estrito de 500 Linhas por Arquivo
* **Quebra de Arquivos**: Nenhum arquivo de código fonte deve passar de **500 linhas**. Se um arquivo atingir ou exceder esse limite, ele deve ser obrigatoriamente quebrado em múltiplos arquivos menores e modulares.

### 🔴 Regra 6: Proibição de Teste via Navegador / Abertura de Browser
* **Sem Testes Visuais ou Navegador**: É terminantemente proibido abrir o navegador (ou utilizar subagentes de browser, Puppeteer, Playwright, etc.) para testar visualmente, simular ou validar a aplicação. A validação das alterações deve ser feita unicamente via análise estática, build e testes de terminal.

### 🔴 Regra 7: Proibição de Modais Nativos do Navegador
* **Sem `alert`, `confirm` ou `prompt` nativos**: Toda confirmação, aviso, bloqueio ou exclusão deve usar o quick modal padrão do sistema (`SystemQuickModal`) ou componente equivalente com backdrop global, visual escuro/dourado e portal em `document.body`.
* **Exclusões sempre com padrão do sistema**: Ações destrutivas nunca devem acionar diálogos genéricos do navegador; devem exibir título claro, mensagem objetiva, botão cancelar e botão de confirmação no padrão visual do "Sair do Sistema".

---

## 2. Personas dos Agentes

### 💻 Agente Frontend
* **Foco**: Interface do usuário, UX/UI, formulários modulares, tratamento de estados locais e integração com TanStack Query.
* **Memória**: Armazena padrões visuais, estado de componentes de formulários, controle de diálogos e boas práticas de hooks em `.agents/memories/frontend_memory.md`.
* **Regra**: Nunca inserir fórmulas de cálculo no código typescript do frontend.
* **Regra de UX**: Nunca usar diálogos nativos do navegador. Usar quick modal padrão do sistema para confirmações, erros bloqueantes e exclusões.

### 🗄️ Agente Banco de Dados (Supabase)
* **Foco**: Migrações SQL, tabelas, relacionamentos, triggers, funções RPC para cálculo, e segurança RLS.
* **Memória**: Armazena esquemas de tabelas, funções RPC existentes, logs de migrações e políticas RLS criadas em `.agents/memories/database_memory.md`.
* **Regra**: Garantir RLS rigoroso em 100% das tabelas.

### 🔍 Agente Revisor Geral (Revisor Geral)
* **Foco**: Garantia de qualidade, modularidade, conformidade com os limites de linhas, organização de diretórios e padrões de código.
* **Memória**: Armazena checklists de revisão de código, problemas detectados e melhorias arquiteturais em `.agents/memories/revisor_memory.md`.
* **Regra**: Bloquear qualquer pull request ou alteração que viole a regra de modularidade ou o limite de 500 linhas.

---

## 3. Padrões de Cibersegurança

1. **Prevenção contra Injeção de SQL**: Sempre utilizar prepared statements e parametrizar queries no banco de dados. Nunca concatenar inputs de usuários em consultas SQL brutas.
2. **Proteção RLS Robustez**: As políticas RLS do Supabase devem usar `auth.uid()` e conferir as permissões do usuário em uma tabela de perfil vinculada para garantir o escopo correto da empresa.
3. **Validação de Entrada (Inputs)**: Sanitizar e validar todo dado de entrada no frontend (usando bibliotecas como Zod) e re-validar no backend/RPC para evitar injeção de payloads maliciosos.
4. **Princípio do Menor Privilégio**: As chaves de API públicas do Supabase (anon key) só devem ter acesso às funções públicas permitidas pelas políticas de RLS. Operações administrativas devem rodar apenas em contexto de service role restrito no backend, nunca expostas ao cliente.
