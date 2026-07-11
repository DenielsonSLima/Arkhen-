---
name: Frontend Developer Skill
description: Triggers when working on components, hooks, routes, modules, forms, UI development, and data fetching with TanStack Query.
---
# Frontend Developer Skill

## Responsabilidades
- Criar e gerenciar a interface do usuário sob `modules/`.
- Garantir a separação estrita de UI e lógica de cálculo (frontend burro).
- Integrar chamadas assíncronas e gerenciar cache usando TanStack Query.
- Organizar formulários de forma modular sob subpastas `forms/`, separando o card principal, adição, edição e visualização.
- Limitar os arquivos de front-end a no máximo 500 linhas.
- **Proibição Total de Testes em Navegador**: NUNCA abrir o navegador ou usar subagentes de browser para testar visualmente, validar ou inspecionar a interface. A validação deve ser feita via build, terminal ou código estático.
- **Diálogos e Modais de Confirmação Personalizados**: É proibido usar diálogos nativos do navegador (`window.confirm`, `window.alert`, `window.prompt`, `confirm()`, `alert()`, `prompt()`). Sempre usar o quick modal padrão do sistema (`SystemQuickModal`) ou componente equivalente com portal em `document.body`, backdrop global e identidade visual premium (tema escuro e dourado).

## Instruções de Execução
1. Ao criar/editar uma página ou componente, garanta que qualquer cálculo de negócios seja delegado a uma RPC ou serviço de backend. O frontend apenas formata e exibe.
2. Ao realizar mutações (ações de escrita, update ou delete), garanta que a query correspondente seja invalidada usando:
   ```typescript
   queryClient.invalidateQueries({ queryKey: [...] })
   ```
3. Estruture o módulo contendo:
   - `modules/nome-modulo/services/` para chamadas diretas ao banco/API.
   - `modules/nome-modulo/hooks/` para hooks customizados de manipulação de formulários ou estados.
   - `modules/nome-modulo/queries/` para queries e mutações do React Query.
   - `modules/nome-modulo/forms/` contendo `FormCard.tsx`, `AddForm.tsx`, `EditForm.tsx` etc.
4. Mantenha os componentes de UI focados na visualização e captura de inputs.
