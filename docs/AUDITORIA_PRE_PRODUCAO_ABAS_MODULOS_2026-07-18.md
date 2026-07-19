# Auditoria de pré-produção — abas internas e módulos

Data: 18/07/2026

Escopo: ciclo de vida das abas internas, registro de rotas, `React.Activity`, limites de erro, Realtime, efeitos, listeners, timers, consultas ocultas e custo de renderização. A validação foi estática, por testes automatizados e build; não foi usado navegador.

## Causas transversais confirmadas

1. `internalTabsStore.setState` persistia e notificava mesmo quando o updater devolvia exatamente o estado atual.
2. O callback `onViewContextChange` era recriado em cada renderização do layout. Páginas que sincronizavam o contexto em um efeito podiam formar o ciclo efeito → store → layout → novo callback → efeito.
3. A persistência local notificava o store de forma síncrona durante `saveState`; depois o próprio store notificava novamente. Cada mutação local provocava duas renderizações.
4. Abas Financeiro ocultas recebiam a subaba derivada do módulo globalmente ativo, em vez do `id`/contexto da própria instância.
5. Em Atividades, `allGroups` era recriado em todo render e um efeito gravava outro objeto em `selectedGroup`, formando realimentação ao abrir Fechamentos com cliente e competência.
6. Rajadas Realtime de Atividades chamavam diretamente uma carga pesada para cada evento.
7. Grades de documentos podiam iniciar várias renderizações PDF simultâneas, inclusive depois de a aba ficar oculta.
8. A promoção pelo botão “+” varria todos os descendentes do módulo até cinco vezes, combinando `getComputedStyle` e métricas de layout. Em Financeiro/Faturamento isso bloqueava a thread principal.

## Correções aplicadas

- Bail-out referencial no store: estado idêntico não persiste nem notifica.
- Hidratação externa compara snapshots semânticos e ignora o eco da própria gravação.
- Callbacks de contexto estabilizados com `useCallback` no layout e no renderizador de módulos.
- Instâncias Financeiro derivam a subaba do próprio `moduleId`/contexto.
- `React.Activity` mantém somente as abas internas, mas desmonta seus efeitos quando `hidden`; cópias base deixam de permanecer duplicadas.
- O reset de scroll atua apenas no viewport/painel ativo e não percorre mais toda a árvore do módulo.
- Canais Realtime têm nomes únicos e cleanup com `removeChannel`.
- Filtro Realtime de preferências usa uma condição válida; usuário continua validado por callback e RLS.
- Atividades memoiza os grupos, evita regravação equivalente e consolida rajadas em uma recarga.
- Previews PDF usam fila global com no máximo duas renderizações concorrentes e ignoram resultados após ocultação.
- O botão “abrir em aba” de Parametrização passa a abrir Regimes Tributários, em vez de uma rota pai sem conteúdo.

## Matriz dos 13 módulos

| Módulo | Submódulos/rotas críticas | Estado do ciclo de aba | Observação de pré-produção |
|---|---|---|---|
| Início | painel, agenda, tarefas, avisos | OK | Efeitos principais têm cleanup; consultas são montadas somente quando visível. |
| Clientes | lista, detalhe, filiais, protocolos, documentos | Corrigido | Contexto estabilizado; Realtime isolado; preview PDF limitado. Formulários e modal de upload ainda excedem 500 linhas. |
| Atividades | Minha Fila, Equipe, Fechamentos, Modelos, Painel | Corrigido | Eliminado loop de seleção e recargas Realtime em rajada. `AbaRotinas` e `AbaMinhasAtividades` excedem 500 linhas. |
| Conformidade | filtros, métricas, etapas | OK | Canal único por montagem, cleanup e queries via TanStack. Correção de schema/RPC pertence à auditoria de banco. |
| Protocolos | pendentes, concluídos, empresa, arquivos | OK com débito | Realtime e cleanup corretos; `protocolosService.ts` tem 524 linhas. |
| Simulações | 18 simuladores e PDF | Alerta | Ciclo de aba não apresentou loop; página principal tem 1.999 linhas e precisa ser modularizada antes de manutenção segura. Regras de cálculo estão em auditoria própria. |
| Reforma Tributária | visão, adequação, XML, IBS/CBS, decisões, split | OK | Query e Realtime são suspensos ao ocultar; subabas inativas são desmontadas. |
| Faturamento | dashboard, recorrências, NFS-e, inadimplência, histórico, configuração | Corrigido com bloqueios funcionais explícitos | Loop de contexto e Realtime amplo removidos; consultas canceláveis e filtros aplicados. Controles sem backend foram desabilitados/sinalizados. |
| Financeiro | caixa, receber, pagar, transferências, créditos, débitos | Corrigido com migrations pendentes | Cada aba usa/persiste seu contexto; queries são condicionais e canceláveis; transferência e parcelamento passaram a uma RPC atômica/idempotente. |
| Documentos | meus, empresas, inativas, todos, compartilhados | Corrigido com débitos | Realtime e cleanup corretos; previews pesados limitados. Página, serviços e aba de empresas excedem 500 linhas. |
| Agenda | calendário, eventos, padrões, equipe | OK | Realtime único e removido ao ocultar; timers de toast têm cleanup. |
| Parametrização | 15 catálogos/regras | Corrigido com bloqueadores de qualidade | Rota pai em aba corrigida. Integração Fiscal tem 1.018 linhas e inicialização assíncrona não cancelável; exige extração antes de evolução segura. |
| Configurações | empresa, usuários, perfis, integrações, armazenamento, módulos | OK com bloqueadores de qualidade | Assinatura global é intencional e invalida apenas queries ativas. Integração Fiscal e Compartilhamento excedem 500 linhas. |

## Arquivos acima do limite obrigatório de 500 linhas

- `simulacoes-calculos/SimulacoesCalculosPage.tsx` — 1.999
- `configuracoes/integracao-fiscal/FiscalConfig.tsx` — 1.018
- `documentos/DocumentosPage.tsx` — 811
- `configuracoes/compartilhamento/CompartilhamentoConfig.tsx` — 778
- `gestao-empresarial/components/DocumentUploadModal.tsx` — 692
- `documentos/services/documentosService.ts` — 673
- `documentos/components/DocumentosEmpresasTab.tsx` — 670
- `atividades/components/AbaRotinas.tsx` — 640
- `gestao-empresarial/forms/ClienteAddForm.tsx` — 633
- `documentos/services/documentShareService.ts` — 605
- `gestao-empresarial/services/gestaoEmpresarialMockData.ts` — 570
- `protocolos/services/protocolosService.ts` — 524
- `gestao-empresarial/forms/ClienteEditForm.tsx` — 518
- `atividades/components/AbaMinhasAtividades.tsx` — 518

## Validação automatizada

- Store: no-op não notifica; mutação local gera uma notificação; snapshot externo diferente hidrata uma vez.
- Contexto Financeiro: subaba deriva da instância, não do módulo ativo global.
- Atividades: canal único por montagem, callback estável, rajada consolidada e seleção por contexto sem loop.
- Documentos: fila respeita duas renderizações PDF concorrentes.
- Suite completa integrada: 13 arquivos e 27 testes aprovados; build de produção aprovado.

## Faturamento e Financeiro — resultado funcional

- Faturamento não compartilha mais o Realtime amplo do Financeiro; canais, cleanup e invalidações são específicos.
- Filtros do dashboard, NFS-e e inadimplência consultam somente após “Filtrar”, e o parceiro está ligado à RPC.
- Configurações fiscais, ações de NFS-e e contatos de inadimplência sem serviço real ficaram somente leitura/desabilitados, sem falso aviso de sucesso.
- Financeiro resolve a subaba antes de iniciar queries e carrega apenas Caixa, Receber, Pagar ou Lançamentos conforme a visão ativa.
- Transferência e parcelamento usam uma única chamada transacional, com chave de idempotência, RBAC e validação de tenant/saldo na migration pendente.
- Baixa de cobrança Asaas só confirma localmente depois de o provedor cancelar o pagamento; baixa customizada integrada e Banco Inter ficam bloqueados até existir conciliação segura.
- FKs compostas `(id, empresa_id)` e validações semânticas foram preparadas para impedir referências financeiras entre tenants.

## Bloqueadores antes do aceite de produção

1. Validar em staging e aplicar as migrations `20260718232000`, `20260718234000` e `20260718235000`; o frontend transacional depende delas.
2. Criar fluxos reais para configuração fiscal, ações NFS-e e conciliação Banco Inter antes de habilitar os controles hoje bloqueados.
3. Executar homologação autenticada do botão “+”, com Financeiro/Faturamento alternando entre cinco abas e inspeção de canais/consultas.
4. Modularizar os arquivos acima de 500 linhas, começando por Simulações, Integração Fiscal e Documentos.
5. Reduzir o bundle principal, atualmente perto de 3 MB minificado; o registro ainda importa quase todos os módulos de forma eager.
