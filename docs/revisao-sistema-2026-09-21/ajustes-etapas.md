# Ajustes por etapas — Arkhen

Solicitação: corrigir o sistema com três agentes, preservar o visual e adiar integrações financeiras externas. Este documento acompanha a implementação posterior ao diagnóstico inicial; não substitui o relatório original da auditoria.

## Estado

Correções preparadas no código local e nas migrations, com testes de terminal. Nenhuma migration, Edge ou versão do site foi publicada nesta etapa. Não foram alteradas senhas, contas de usuários, documentos ou lançamentos reais.

## Etapas e decisões

| Etapa | Entrega preparada | Estado |
|---|---|---|
| 1. Financeiro interno | Permissões no servidor; despesas com valores válidos; saldos e agregados usando valores pagos; transferências e parcelamento; resumo de contas a pagar e PDF; compatibilidade de recebimentos internos | Implementada e testada; ver relatório financeiro |
| 2. Documentos e auditoria | Exclusão transacional com fila de limpeza e recuperação; validação de tenant/caminho/dono; entrega compartilhada pela Edge segura; classificação de eventos XML; logs imutáveis e busca paginada | Implementada e testada; ver relatório documental |
| 3. Operação | Indicadores reais; alertas de validade; erros visíveis; exclusão de parceiro; datas locais; leitura histórica de fechamentos; autoria automática e justificativa de reabertura | Implementada e testada; histórico mantido para consulta |
| 4. Relatórios e simulações | Cumprimento de Prazos por data real; impedir resultado antigo após trocar filtros/dados; impedir impressão desatualizada; expor falhas de parametrização | Implementada e testada; mudanças no comparativo tributário adiadas |
| 5. Integrações e demais decisões | Integrações bancárias, cobrança pública, homologação fiscal, regras tributárias completas, recorrência manual da Agenda e efeitos dos parâmetros trabalhistas | Fora deste lote; exigem definição/etapa própria |

### Decisões aprovadas pelo usuário

- Fechamentos: autor e data reais registrados automaticamente; justificativa obrigatória para reabertura, usando o modal padrão.
- Cumprimento de Prazos: prazo legal, ou prazo interno quando não houver legal. Percentual = entregas concluídas comprovadamente no prazo / todas as entregas concluídas.

### Escopo adotado após autorização para seguir

1. Fechamentos do fluxo antigo permanecem para consulta histórica. O usuário autorizou seguir sem escolher entre as alternativas; adotou-se a opção conservadora já informada no chat. A escrita legada fica bloqueada explicitamente; nenhuma migração de dados foi feita.
2. Alterações no comparativo tributário ficam para a próxima etapa. A fórmula e a indicação atuais não foram alteradas; o diagnóstico sobre a recomendação permanece registrado.

### Regra do relatório de prazos

A fonte principal são as tarefas vinculadas a modelos de obrigações. O histórico antigo sem tarefa correspondente permanece nos totais, respeitando permissões. Itens cancelados ficam fora. Aguardando revisão não equivale a concluído. Prazo legal prevalece sobre interno; não se inventa prazo pelo fim da competência. A data de conclusão é convertida para o fuso do escritório. Histórico sem prazo/data de entrega comprovada não conta como entrega no prazo; o retorno inclui a quantidade sem evidência. Sem entregas concluídas, o indicador é zero. A distribuição por obrigação mantém a taxa de conclusão, agora calculada no servidor.

## Preservação visual

Nenhum arquivo CSS, cor, fonte ou layout foi editado. A análise AST dos componentes modificados encontrou os mesmos atributos de estilo/classes, exceto a condição da aba ativa em Atividades, corrigida para identificar a tarefa em vez do modelo. Os avisos usam o componente padrão já existente; o modal de reabertura foi autorizado.

O CSS compilado tem as mesmas 4.009 regras e os mesmos 459.174 bytes de conteúdo total do publicado. O hash muda porque o bloco existente de SystemToast passou a ser incluído antes no bundle; não há declaração CSS nova ou modificada. Evidência: `validacao-ajustes/visual.json`. Não houve teste em navegador, conforme a regra do repositório; esta comparação estática não é uma inspeção visual de pixels.

## Limites e próxima etapa

- Este lote não certifica todos os cenários fiscais nem implementa integrações bancárias.
- Baixas parciais antigas e lançamento genérico ainda não têm chave de idempotência; a proteção de repetição cobre os fluxos especificados no relatório financeiro.
- Leitura histórica não materializa nem migra tarefas antigas silenciosamente.
- Os avisos de infraestrutura e desempenho do diagnóstico permanecem para manutenção separada.
- A publicação deve usar somente os arquivos deste lote, preservar as alterações locais anteriores e aplicar as migrations na ordem, antes da Edge e do frontend. O histórico remoto diverge do local; não executar um push indiscriminado de todas as migrations.

## Relatórios dos três agentes

- [Financeiro](ajustes-financeiro.md)
- [Documentos, auditoria e compartilhamento](ajustes-documentos-auditoria.md)
- [Operação](ajustes-operacao.md)

A coordenação revisou compatibilidade de recebimentos, isolamento de arquivos e critérios de prazo; os agentes fizeram revisão cruzada entre operação, financeiro e segurança.

## Validação final conjunta

- `npm test`: 126 arquivos, 689 testes aprovados.
- `npm run build`: aprovado; permanece aviso de tamanho do bundle principal.
- `npm run lint`: aprovado, 15 avisos de manutenção existentes no conjunto.
- PostgreSQL isolado: financeiro (72 asserções), documentos/auditoria, indicadores, fechamentos e relatório de prazos aprovados. Sem escrita no banco remoto.
- Duas Edges verificadas com Deno pelo agente de documentos.
- `git diff --check`: aprovado. Os 85 arquivos de implementação alterados/adicionados estão listados em `validacao-ajustes/arquivos-implementacao.txt`; nenhum arquivo de código modificado atinge 500 linhas.
- Logs preservados em `validacao-ajustes/`. O manifesto não inclui documentos/fontes de trabalhos anteriores, nem a alteração preexistente em `supabase/.temp/cli-latest`.

## Integração com GitHub

A base remota foi atualizada para `280d7e2`, preservando as correções já publicadas de primeiro acesso por e-mail. A migration duplicada de preservação foi removida do lote; o arquivo original remoto `20260921163326_primeiro_acesso_email_senha_temporaria.sql` foi mantido.

A revisão final independente detectou incompatibilidade `uuid = text` no JOIN dos alertas documentais. O JOIN foi corrigido para `clientes.id::text = documentos.cliente_id`, e a fixture passou a reproduzir o tipo real. A revisão financeira adicional cobre as ações referenciais de exclusão de clientes.

### Situação do envio

A revisão automática bloqueou a primeira aplicação no banco remoto antes da execução, solicitando autorização explícita para produção. Não houve migration aplicada. O envio ao GitHub será feito em branch revisável enquanto a autorização específica do Supabase estiver pendente. A branch principal não deve receber este lote antes dos pré-requisitos do backend.

Resumo portátil de validação: `validacao-ajustes/resultados.json`. Os logs completos permanecem no workspace (arquivos `.log` ignorados pelo repositório).
