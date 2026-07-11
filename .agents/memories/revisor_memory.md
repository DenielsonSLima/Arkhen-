# Memória do Agente Revisor Geral

Esta é a memória persistente do **Agente Revisor Geral**. Ela armazena relatórios de qualidade de código, listas de conformidade de regras e incidentes de violação arquitetural detectados no projeto Contabil.

## 📌 Status de Conformidade do Repositório
* **Status**: Aprovado para a primeira etapa do módulo Configurações.
* **Validação mais recente**: `npm run build` passou após integrar TanStack Query, realtime e serviços Supabase para Dados da Empresa e Marca d'Água.
* **Validação RBAC**: `npm run build` passou após migrar Perfis de Acesso e Permissões do Sistema para Supabase/TanStack Query.
* **Pendências de Configurações**: ainda há `localStorage`/mock em Meu Perfil, Usuários, Contadores, Contas Bancárias, Integração Bancária, Integração Fiscal, Compartilhamento, Calculadora, Armazenamento, Status das APIs e Logs/Eventos.
* **Observação de Produto/Security**: o login do app ainda é mock/localStorage; para testar gravação real sob RLS, integrar Supabase Auth e criar vínculo em `perfis`.
* **Verificação de Limite de Linhas**: Todos os novos arquivos do submódulo de Atividades (`FolhaPage.tsx`, `ProLaborePage.tsx`, `ObrasPage.tsx`, `DctfWebPage.tsx`, `ObrigacoesPage.tsx`, `TarefasPage.tsx`, `ConfigFluxosPage.tsx`, `useAtividades.ts` e `atividadesService.ts`) estão rigorosamente abaixo do limite estrito de 500 linhas.
* **Verificação de Lógica no Frontend**: Lógicas matemáticas de cálculo tributário foram evitadas (a inserção de valores de INSS, IRRF e REINF na DCTFWeb é meramente cadastral e preenchida pelo usuário contador).
* **Verificação de Modularidade de Diretórios**: OK. A divisão de responsabilidades segue a estrutura modular e limpa proposta para a pasta de `atividades/`.

## 🔎 Checklists de Revisão Periódica
- [x] Nenhum arquivo possui mais de 500 linhas.
- [x] Nenhuma lógica de cálculo de negócios ou fórmulas matemáticas está embutida no frontend.
- [x] A pasta `modules/` contém subpastas separadas por módulos, com suas subpastas `services`, `hooks` e `forms` (ou `config`).
- [x] Formulários e modais são quebrados de forma limpa.
- [x] Todas as tabelas criadas no banco de dados possuem RLS ativo e checam `empresa_id` / `tenant_id`.
- [x] Nenhum componente ou hook novo deve utilizar diálogos nativos do navegador (`window.confirm`, `window.alert`, `window.prompt`, `confirm()`, `alert()`, `prompt()`); confirmações devem usar `SystemQuickModal` ou equivalente global do sistema.
- [x] O agente não abre ou tenta utilizar o navegador/browser para testar ou conferir alterações visuais (proibido pela Regra 6).

## 🚨 Incidentes e Correções Efetuadas
* *Nenhum incidente de revisão registrado.*
