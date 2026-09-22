# Ajustes de documentos, compartilhamento e auditoria

Implementação local em 21/09/2026. Nenhuma migration foi aplicada em produção, nenhuma Edge foi publicada e nenhum documento real foi excluído. Classes, CSS, estrutura visual, cores e fontes das telas existentes foram preservados. A página pública foi dividida em componente e hook para respeitar o limite de 500 linhas.

## Correções preparadas

| Achado | Comportamento resultante |
| --- | --- |
| OP01 | A exclusão registra snapshot e fila privada na mesma transação que remove os metadados. Uma FK impede a transação inteira antes de qualquer remoção do Storage. A Edge aceita somente IDs, valida sessão, usa caminhos obtidos do servidor e confirma a limpeza idempotente. Falhas deixam uma pendência que é retomada ao abrir Documentos. |
| OP09 | Eventos de carta de correção, pedidos de cancelamento sem homologação e respostas rejeitadas deixam de ser classificados como cancelamento confirmado. Cancelamento exige tipo 110111 e retorno 135/155, ou retorno legado 101. |
| AI04 | Falha ao salvar modelos XML passa a rejeitar a operação, preserva o cache anterior e aparece no aviso já existente da tela. |
| AI05 | Usuários autenticados não podem inserir, editar, excluir ou truncar logs diretamente. Escritas legítimas de servidor continuam podendo acrescentar eventos; histórico não pode ser alterado nem por uma rotina privilegiada. |
| AI06 | Busca e filtros consultam todo o histórico permitido pelo RLS. A lista carrega lotes de 100 por cursor ao alcançar a última linha, sem novos botões ou controles. |
| AI07 | O compartilhamento solicita URLs à Edge segura já implantada, valida senha no servidor e renova URLs temporárias. Não depende de caminhos públicos nem de SELECT anônimo no Storage. O fallback de documentos recebidos em hash sem assinatura foi removido. |

## Exclusão e limites de segurança

- `preparar_exclusao_documentos` valida ator, empresa, vínculo ativo, tipo de acesso, dono/permissão e cliente operacional. O helper `documento_cliente_belongs_to_empresa` foi conferido ao vivo: ele chama `current_user_can_access_cliente_operacional`, além de conferir o tenant.
- O caminho deve corresponder ao tenant e à pasta pessoal/dono ou cliente do registro. Se o objeto existe, seu proprietário deve corresponder ao proprietário registrado. Caminhos duplicados em outro documento são recusados.
- Produção já possui `UNIQUE(storage_path)` e trigger de preservação da identidade documental; a preparação mantém validação própria. Um novo guard bloqueia o reaproveitamento do caminho enquanto há limpeza pendente, usando lock compartilhado com a preparação.
- A fila é privada e as RPCs de leitura/confirmação da fila são executáveis apenas por `service_role`. A Edge restringe as consultas ao ator autenticado, inclusive na retomada.
- A limpeza processa até 100 pendências por chamada e interrompe no primeiro erro. O snapshot permanece recuperável. Não foi criado agendamento remoto; se a pessoa não abrir novamente Documentos, a pendência exige retomada operacional posterior.

## Compatibilidade da auditoria

Consulta remota somente de definições identificou seis rotinas legítimas que inserem logs, todas `SECURITY DEFINER`: provisionamento de funcionário por e-mail/CPF, desfazimento do provisionamento por e-mail, confirmação do primeiro acesso gerenciado e confirmações de troca/reset de senha por CPF. A migration permite esses INSERTs de servidor e não acrescenta endpoint genérico capaz de forjar autoria. Os fluxos de primeiro acesso não foram alterados neste escopo.

## Validação local

- 24 testes Vitest passaram em seis arquivos: serviço/queries de documentos, compartilhamento seguro, modelo XML, classificação fiscal e protocolo da Edge de exclusão.
- `supabase/tests/documentos_auditoria_safety.mjs` passou em PostgreSQL isolado PGlite: rollback de FK em lote, negação de permissões/cliente operacional, caminho de outro tenant, proprietário incompatível, reaproveitamento de caminho pendente, fila privada, isolamento do ator, replay, INSERT legítimo de servidor, logs imutáveis, cursor sem sobreposição e busca além dos primeiros 100 registros.
- `deno check --no-lock supabase/functions/delete-documents/index.ts supabase/functions/get-shared-document-url/index.ts` passou.
- Nenhum navegador foi utilizado; os testes de DOM usam jsdom local.
- Revisão cruzada: agente operacional conferiu ordem de exclusão e compartilhamento; agente financeiro conferiu SQL da fila e logs. A coordenação solicitou as verificações adicionais de caminho/proprietário e associação ativa, incorporadas e testadas.

## Ordem de publicação a coordenar

1. Aplicar `20260922010633_documentos_exclusao_reconciliavel.sql` e `20260922010653_auditoria_logs_imutaveis.sql`.
2. Publicar `delete-documents` com suas dependências compartilhadas e autenticação manual. O código de `get-shared-document-url` foi sincronizado do endpoint já publicado, sem alterar a implementação remota.
3. Publicar o frontend somente após as dependências estarem disponíveis.

Cobranças públicas, boletos, Pix, integrações bancárias e webhooks permanecem fora deste lote por orientação do usuário. O achado de cobrança pública baseada em hash sem assinatura continua pendente; a remoção do fallback aqui se restringe a documentos compartilhados.
