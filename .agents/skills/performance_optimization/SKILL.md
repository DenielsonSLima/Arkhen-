---
name: Performance Optimization Skill
description: Triggers when optimizing React rendering, configuring TanStack Query cache rules, lazy-loading code splitting, or indexing SQL databases.
---
# Performance Optimization Skill

## Responsabilidades
- Otimizar a performance de renderização de componentes React.
- Configurar políticas de cache inteligentes usando TanStack Query.
- Otimizar consultas ao banco de dados e propor índices em tabelas.
- Monitorar e reduzir o tamanho dos bundles compilados (bundle size).

## Instruções de Execução
1. **Otimização de Consultas (TanStack Query)**:
   - Configure um `staleTime` razoável (ex: 5 minutos para dados estáticos, ou 0 para dados altamente voláteis) para evitar refetchs desnecessários nas navegações.
   - Utilize a invalidação de queries seletiva para atualizar apenas o cache afetado pela mutação, e não re-buscar todo o banco de dados.
2. **Desempenho no React**:
   - Evite re-renderizações desnecessárias de componentes de listas longas contábeis (use paginação ou virtualização de listas).
   - Memorize cálculos visuais leves com `useMemo` ou funções de callback passadas para componentes filhos com `useCallback`.
   - Adote Code Splitting via `React.lazy` ou imports dinâmicos para carregar os módulos sob demanda (por exemplo, carregar o formulário apenas quando o card de edição/adição for aberto).
3. **Desempenho de Banco de Dados**:
   - Toda coluna utilizada como chave de busca frequente ou RLS (como `empresa_id` ou `tenant_id`) deve possuir obrigatoriamente um índice correspondente (B-Tree Index) para evitar full table scans.
   - Otimize as funções RPC contábeis para evitar joins desnecessários e use subconsultas otimizadas.
