# Modelos fiscais de Faturamento

Presets WebISS por empresa e configuração emitente. Criar, editar, clonar, inativar/reativar e preencher rascunho existente. Não emite, cancela, reserva RPS nem altera notas antigas.

## Ativação

Aplicar, mediante autorização de banco, `20261112112928_faturamento_modelos_fiscais.sql` antes de liberar a interface. Nenhuma migration foi aplicada durante a implementação. Banco sem RPC exibe indisponibilidade explícita, não armazenamento fictício no navegador.

A aba `ModelosTab` deve ser integrada em Faturamento. O seletor em `NfseDraftForm` preenche apenas campos de preset; datas, competência, identidade e tomador continuam por operação. Revisão fiscal é invalidada ao aplicar um modelo. Emissão de produção mantém seus bloqueios existentes.

Dados não são partilhados entre tenants. O servidor deriva a empresa da sessão e confere a empresa esperada, emitente e versão. Arquivamento é reversível. Clonar abre novo formulário e somente persiste quando salvo. A criação reutiliza o UUID para retry. Dados existentes não são atualizados quando um modelo muda.

As mutações invalidam TanStack Query imediatamente; outra sessão atualiza ao focar a janela e a cada 30s. Não afirmar sincronização push em tempo real: a tabela privada não foi exposta em publication por conveniência.

## Limites

Esta etapa não converte presets WebISS em DPS Nacional. Integração nacional exige contrato próprio, tributação revisada e adaptação do backend. Não aplicar a regra acadêmica da Universo de competência no último dia do mês pago aos serviços contábeis.

## Verificação offline

- Vitest: serviços, seletor, editor/clonagem/inativação e regressão de preparação.
- Banco: fixture PGlite isolada com dois tenants, roles authenticated/anon, CRUD, versão otimista, criação idempotente, validação e acesso direto negado.
- `PGLITE_MODULE=/caminho/local/pglite/dist/index.js node supabase/tests/modelos_fiscais_isolated.mjs` (validado com `@electric-sql/pglite@0.3.14`).
- Sem conexão ao banco real, sem browser e sem operação fiscal real.
