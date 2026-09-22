# Ajustes financeiros preparados

F00/F01/F02/F07/F08/F10 implementados localmente, preservando atributos de estilo/classes, layout, cores e fontes. Sem aplicação remota, deploy ou alteração de dados financeiros reais. Integrações bancárias, boletos, Pix e webhooks permanecem adiados.

## Migrations — aplicar juntas, nesta ordem

1. `20260922001430_financeiro_controle_escrita.sql`: transferência e parcelamento privados, locks, valores válidos e idempotência por chave+payload; assinaturas públicas preservadas.
2. `20260922001435_financeiro_baixa_e_lancamentos.sql`: RBAC/tenant fail-closed, APIs públicas INVOKER→privadas DEFINER com search_path vazio; DML direto do ledger revogado e protegido por trigger. Pagamento valida estado/conta e principal−desconto+juros; replay da mesma baixa não duplica débito. Contas com saldo/histórico não são excluídas. Mantém compatibilidade de recebimentos internos `baixar_manual_cobranca_custom`/`confirmar_recebimento_financeiro` com financeiro OU faturamento:manage; recebimento integral exige abatimento exato e parcial não ultrapassa aberto. Escrita service_role legítima continua permitida.
3. `20260922001441_financeiro_resumos.sql`: despesas agregadas pelo valor efetivamente pago; resumo pagar usa data de pagamento no mês e exclui cancelados da previsão; últimas movimentações reais no dashboard.

## Arquivos frontend

- `FinanceiroPage.tsx`, `hooks/useFinanceiro.ts`, `queries/useFinanceiroQueries.ts`: período real da consulta até12 meses, resumo pagar SQL, invalidação/retry e PDF.
- `components/CaixaTab.tsx`, `components/ContasAPagarTab.tsx`: mesmas estruturas visuais, dados reais e métricas calculadas pelo banco.
- `components/ModalPagarDespesa.tsx`: prévia de juros/desconto pelo servidor, erro no alerta existente e confirmação bloqueada enquanto indisponível.
- `components/AddTransferenciaModal.tsx`, `components/AddContasAPagarModal.tsx`: chave renovada em cada abertura, mantida no retry da mesma operação.
- `services/contasPagarService.ts`, `financeiroService.ts`, `financeiroTypes.ts`, `financeiroPdfService.ts`: contratos RPC, normalização e exportação do conjunto carregado.

## Testes e revisão

- `supabase/tests/run-financeiro.mjs` + `fixtures/financeiro_schema.sql`: **72 asserções passaram** usando PostgreSQL/PGlite e as três migrations reais. Cobre permissão/tenant/NULL, DML direto e regrant, service_role, pagamento inválido/cancelado/conta alheia, principal100+juros10=pagamento110, replay, transferências, parcelas100,01, agregados e recebimentos internos com permissão faturamento.
- `npx vitest run src/modules/gestor/financeiro`: **9 suites/31 testes passaram**, incluindo `ModalPagarDespesa.test.tsx` e `financeiroPdfService.test.ts`.
- `git diff --check` do escopo limpo; atributos `className`/`style` dos10 arquivos modificados comparados com HEAD sem diferenças. Arquivos dentro do limite500 linhas.
- Revisão cruzada: autorização NULL endurecida; root contestou baixa integral sub/sobrepaga, ambas agora rejeitadas e testadas sem modificar saldo/estado/principal.
- PGlite foi instalado somente em `/private/tmp/arkhen-financeiro-pglite`; runner aceita `PGLITE_MODULE`. Dependências do projeto inalteradas. Suite/build globais ficam com o coordenador.

## Limitações preservadas

- Nenhum principal ou saldo histórico foi sobrescrito. Metadata `valor_pago` válido alimenta os agregados; registros antigos sem metadata confiável usam nominal. Diferenças históricas precisam de conciliação específica.
- `salvar_lancamento_financeiro` genérico e baixa manual **parcial** ainda não têm chave idempotente: perda de resposta exige conferência antes de repetir. Não há garantia universal de retry. As proteções novas cobrem transferência, parcelamento, baixa de despesa e confirmar recebimento.
- Semântica legada de competência e parcelas previamente pagas preservada. Seletor Caixa muda período do gráfico; cards gerais mantêm escopo anterior.
- PGlite usa fixture local e não substitui ensaio em staging nem teste concorrente de múltiplas conexões. Definições atuais das RPCs de recebimento foram consultadas somente leitura para preservar os contratos existentes.

## Conferência final do schema de produção

Consulta somente leitura confirmou UUIDs, campos monetários numeric(15,2), datas, defaults, assinaturas RPC, constraints e triggers existentes. As três migrations compilaram em PostgreSQL/PGlite com colunas/constraints/triggers extraídos do banco real; cadastro de lançamento, dashboard e resumo executaram nesse schema.

Foi reproduzida e corrigida uma incompatibilidade: exclusão autorizada de cliente por gestor sem financeiro:manage dispara FK ON DELETE SET NULL no ledger. O guard agora permite exclusivamente a cascata aninhada que limpa cliente_empresa_id, mantém todos os demais campos e tenant intactos, verifica membro interno e inexistência do cliente removido. DML direto permanece negado mesmo com grant acidental; três asserções adicionais cobrem referência nula, valor preservado e tentativa direta bloqueada.

Ordem de publicação: aplicar e validar as três migrations financeiras antes de publicar o frontend, que depende das novas RPCs de prévia e resumo. Não houve aplicação remota nesta revisão.
