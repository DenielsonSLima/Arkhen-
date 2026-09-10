# Importação inicial interna WebISS

Worker exclusivamente de consulta/importação de notas existentes. O Histórico NFS-e não precisa expor um botão de sincronização inicial. Não há operação de emissão, cancelamento ou criação de cobrança neste endpoint.

## Autenticação e execução

- Publicar somente este worker com `verify_jwt=false`: a autenticação própria ocorre pelo token aleatório de 256 bits e uso único validado atomicamente no banco. `fiscal-integration` continua exigindo JWT.
- Aplicar `20260910034923_webiss_import_jobs.sql`, que instala `pg_net` e cria a fila privada.
- Um administrador de infraestrutura executa `enfileirar_importacao_webiss(user_id, fiscal_config_id, cliente_id, ambiente, data_inicial, data_final)` pelo canal administrativo do projeto. A função exige usuário administrador ativo, valida a empresa, o emitente e o parceiro; o intervalo máximo é de 366 dias.
- O retorno contém somente `jobId` e `requestId`. O token é gerado no banco e enviado para a URL fixa deste worker por `pg_net`, após o commit; somente seu hash fica no job, por até dez minutos.
- O worker aceita apenas POST JSON `{ "jobId": "uuid" }` e o header interno `x-webiss-job-token`. A aquisição atômica consome o token e fornece o contexto cadastrado. O arquivo A1 e a senha permanecem exclusivamente no servidor.
- A consulta reutiliza `ConsultarNfseServicoPrestado`, verifica o emitente/tomador/município e importa até cinco notas de no máximo cinco páginas. O resumo informa cobertura parcial quando necessário.

## Acompanhamento

Consultar apenas ID, status, resultado, erro e horários do job pela administração. Não ler headers da fila HTTP, Vault ou conteúdo do certificado para diagnosticar. O XML de uma nota importada fica no histórico fiscal privado, isolado por empresa.

### Limite de permissões da extensão hospedada

No projeto hospedado, a fila `net.http_request_queue` pertence ao papel interno `supabase_admin`. A migration `20260910040202_restringir_pg_net_importacao_webiss.sql` tentou limitar sua leitura a `id`, mas a auditoria posterior comprovou que o papel de migrations não possui permissão para revogar o grant do proprietário; essa proteção **não entrou em vigor no remoto**. A correção requer execução pelo proprietário via suporte Supabase, seguida da verificação de `has_column_privilege` para `headers` e `body`.

O schema `net` não é exposto pela API do aplicativo; nenhuma view pública o referencia e a única RPC pública de enfileiramento exige `service_role`. Ainda assim, papéis com execução SQL direta e as permissões herdadas da extensão podem ler a fila enquanto o pedido aguarda execução. Por isso, o token é restrito a um job já autorizado, expira em dez minutos e é consumido atomicamente; sua resposta HTTP contém somente resumo. Não usar esta fila para transmitir certificado, senha, chave privada ou credencial geral do servidor.

Uma interrupção abrupta após o claim pode deixar o job em `processing`. Depois de confirmar que a execução terminou, o administrador pode finalizá-lo como falha pela RPC `finish_webiss_import_job` e enfileirar uma nova consulta explícita. Não reutilizar tokens nem reiniciar jobs automaticamente.

Falha ou exceção da RPC de claim retorna HTTP `503`, com mensagem fixa; claim nulo sem erro continua retornando `403` (token recusado, expirado ou já utilizado). Nesse caminho o worker não consulta o WebISS, não grava o erro interno e não repete nem finaliza o job. Não presumir pelo HTTP que o claim não ocorreu: confirme o estado e os horários registrados.

Se o pedido HTTP terminou e o job permanece `pending`, com `started_at` nulo, o administrador deve confirmar que não há execução ativa e retirar a capability antes de uma nova consulta explícita: por ID exato e com condição de estado `pending`/`started_at IS NULL`, marcar `failed`, limpar `token_hash`, registrar `finished_at` e uma razão administrativa fixa. A RPC `finish_webiss_import_job` aceita apenas `processing` e não atende esse caso pendente. Nunca ler nem reutilizar o token, alterar o job para `processing` artificialmente ou disparar retentativas automáticas; o novo enfileiramento gera outro job e outra capability.

## Validação

`deno test --config supabase/functions/webiss-import-worker/deno.json supabase/functions/webiss-import-worker/handler_test.ts`

O teste SQL `supabase/tests/run-webiss-import-jobs.mjs` usa PGlite e transporte simulado; não chama o WebISS. Os testes cobrem autenticação, repetição de token, escopo, isolamento e resumo sem segredos.
