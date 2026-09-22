# Ajustes operação — implementação local 21/09/2026

Código congelado para QA conjunta. Nenhuma mutação remota, deploy, browser ou CSS executado. Mudanças de terceiros preservadas.

## Entregue
- OP02: Fechamentos consulta todas competências, sem ensure/materialização no carregamento. União canônica + histórico não sobreposto. Histórico gestor/cliente permitido via função restrita, tabela legacy continua inacessível. Comandos sobre histórico recusados antes de qualquer escrita, com toast explícito de migração pendente.
- OP03: Checklist canônico salva pela RPC auditada e só reflete após confirmação. Valores salvos por RPC específica com merge e evento servidor; editor fica aberto no erro. Auditoria só mostra sucesso após await. Nenhum otimista de fechamento persiste estado falso.
- OP04: binding deleteCompany corrigido; teste usa método real e confirma bloqueio de documentos antes de DELETE.
- OP05: métricas Início agregadas server-side em RPC invoker, sem cortes das amostras visuais, empresas ativas reais, contagens reais tarefas/agenda/colaboradores. Canceladas excluídas; status aguardando revisão não equivale concluída.
- OP06: validade obtida de documentos.data_validade e clientes.certificados; RLS respeitada, datas inválidas ignoradas; nenhum payload de senha/certificado retornado.
- OP08: erros em Início/bootstrap, Minha Fila, Painel Operacional, Fechamentos e Agenda exibidos em componentes padrão existentes. Queries cacheadas e invalidáveis.
- OP10: autoria/data fechamento pelo servidor salvar_fechamento_operacional; campos auditáveis somente leitura preservando style. Reabertura exige justificativa no modal padrão. Dados checklist extraídos dos eventos canônicos, índice original do array incluído para não inverter etapas por ordem de chave JSONB.
- OP11: Agenda usa todayKey local para hoje/dia inicial/formulário.
- Ajuste necessário de integração: abas de atividades usam instanciaId como identidade, preservam modeloId para ícone e rótulo, evitando renderizar múltiplas tarefas de mesmo modelo na mesma aba.

## Migrations (ordem após base operacional existente)
1. 20260922002133_inicio_metricas_validade_operacionais.sql
2. 20260922002422_fechamentos_leitura_compativel.sql
3. 20260922002751_fechamento_valores_tarefa_auditaveis.sql

Criadas via supabase migration new após help; a primeira foi regenerada para evitar colisão de timestamp financeiro. Security invoker nas leituras correntes, definer somente histórico manage/client e escrita mínima validada; guards sessão, tenant, cliente, permission. Grants legacy não reabertos. Valores usa coluna existente de produção.

## Verificações
- 6 suites / 16 testes focados passaram: useAtividades, FechamentoConfirmationModal, AtividadesPage, inicioService, useGestaoEmpresarial.delete, MinhaFilaAtividades.accessibility.
- PGlite @0.3.15: ambos scripts supabase/tests/operacao/inicio.mjs e fechamentos.mjs passaram. Fixtures testam totais acima do corte, isolamento tenant, bloqueio anon, histórico antigo/sem duplicação/sem SELECT legacy, índice checklist, merge valores, autoria auth.uid, payload indevido e falta de permissão.
- Execução: PGLITE_MODULE=/private/tmp/arkhen-financeiro-pglite/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/operacao/inicio.mjs (idem fechamentos).
- git diff --check limpo. Arquivos alterados abaixo de 500 linhas. Nenhuma classe literal, cor, fonte, CSS, layout foi alterado; alteração expressão classe active apenas identidade da aba. Modais/toasts seguem componentes/classes existentes.
- Build e suite completos reservados ao coordenador.

## Pendências / limites reais
- OP07 recorrência manual Agenda: contrato incompleto de duração, término, edição/exclusão da série/ocorrência e fuso; metadados recorrente/periodicidade continuam como antes. Não geramos série sem decisão do usuário.
- Migração de histórico para editável aguarda decisão usuário. Histórico visível, recusa explícita da escrita. Sem data/autoria inventadas e sem migração silenciosa.
- Conclusão pelo checklist em Fechamentos segue exigência backend de evidência ou justificativa prévia. Se faltante, mostra erro; a tela existente Minha Fila/Detalhe permite informar evidência/justificativa. Não criamos evidência automática para forçar conclusão.
- Deduplicação histórico atual usa cliente/modelo_id/competência. Entradas antigas apenas modelo_codigo sem UUID podem permanecer separadas; não inferimos equivalência nem apagamos histórico. Coordenador informado.

## Contestação cruzada
OP01 nova exclusão DB+fila antes Storage corrige perda blob por FK; helper documento_cliente_belongs_to_empresa confirmado pelo agente3 também verifica escopo operacional, não só tenant. AI07 Edge URL elimina dependência de SELECT anon Storage. Relatório conformidade do coordenador revisado: prazo legal fallback interno, somente Concluída, datas desconhecidas não promovidas a no-prazo, escopo replica RLS e histórico manage/client.
