# NFS-e nacional: implementação preparatória, sem transmissão habilitada

Referência: `DenielsonSLima/UniversoCursosConsultoria`, revisão `cba1301`.
Os módulos `xml`, `dps`, `dps.types`, `events` e `cancellation-policy` foram
portados dessa base do mesmo proprietário, preservando suas validações.
Não foram copiados certificados, contas, evidências fiscais ou credenciais.

## Implementado

- Builder de DPS com revisão explícita, competência, identificação, valores
  canônicos e recusa de campos fiscais não suportados. Não calcula tributos.
- Builder de cancelamento 101101 e solicitação de análise 101103; projeção
  dos estados distingue análise pendente, cancelamento e substituição.
- Política de cancelamento dependente de evidências atuais do emitente,
  documento, ambiente e regras municipais. Não assume prazo nacional de 24h.
- Orquestração: autorização a cada chamada, consulta antes do envio, claim
  atômico e sem reenvio automático após timeout/falha de persistência.
- Migration preparatória com ledger privado, RLS sem acesso cliente, RPCs
  exclusivas para service_role, escopo revalidado por usuário/empresa/config,
  CNPJ do certificado, identidade imutável e compare-and-set do dispatch.
- `rpc-ledger.ts` adapta essas RPCs ao orquestrador; `companyId` identifica
  precisamente a configuração fiscal (emitente/cliente) dentro do tenant.
- Handler permite somente `national-readiness`, após autenticação normal e
  autorização da configuração na RPC. Não retorna segredos. `national-emit`,
  `national-cancel` e `national-consult` retornam bloqueio explícito 409.
- Validação XSD oficial completo de homologação, com SHA256 de cada recurso,
  imports em allowlist em memória, sem downloads de schema durante execução.
- XMLDSig com dependências fixadas, assinatura e verificação local; gzip/base64
  com limites, proteção contra DTD/XXE, UTF-8 inválido e expansão excessiva.
- Pipeline homologação amarra autorização, snapshot, assinatura, ledger,
  consulta, POST injetado e arquivo privado. Só confirma AUTHORIZED depois
  de arquivar XML validado com a DPS/emitente/ambiente/conteúdo correspondentes.
- Migration agora exige arquivo privado antes de status AUTHORIZED e impede
  alteração de um arquivo fiscal já gravado. Preparação de cancelamento
  autoriza, exige evidência canônica e assina XML sem transmitir.
- Adapter HTTPS mTLS com destino oficial fixo, TLS validado, timeout, limite,
  sem redirects ou retry. Toda chamada real permanece bloqueada antes do socket.
- WebISS permanece no caminho anterior, sem alteração de cálculo/contrato.

## O que NÃO está concluído

A migration foi testada em PostgreSQL WASM local, com tabelas-base mínimas e
usuários fictícios, **não aplicada no Supabase**. É necessária validação contra
schema completo e políticas reais antes de aplicar. O teste usa um resolvedor
sintético de associação; não prova os controles reais de login/permissão.

Não há transporte nacional habilitado, emissão/cancelamento/consulta reais,
relay Arkhen aprovado, UI de revisão nacional ou alocação DPS automática.
A elegibilidade recebe fatos canônicos de uma camada futura; nunca aceitar
esses fatos do navegador. O pipeline pode receber somente transporte sintético
nos testes; sua factory não é uma autorização para chamar a SEFIN.

A produção está bloqueada no orquestrador, no handler e por constraint do
ledger. Os builders sabem representar os dois ambientes, mas isso **não**
concede permissão para transmitir. A preparação nacional nunca deve reutilizar
um RPS WebISS como DPS nem migrar uma nota por simples mudança de status.

## Antes de habilitar homologação

1. Validar schema completo, RLS e privilégios do operador para emissão;
   implementar alocação estável da DPS e snapshot fiscal revisado no backend.
2. Hash: a RPC usa SHA256 dos bytes UTF-8 de `snapshot::jsonb::text`. O caller
   deve obter esse digest no backend, não confiar em JSON.stringify do cliente.
3. Integrar a carga do A1 pelo Vault ao pipeline, validando CNPJ e validade;
   os testes usam somente certificado efêmero. Persistir os bytes antes do
   claim. A RPC protege identidade, não verifica criptografia sozinha.
4. Validar se o executor da Edge suporta o mTLS implementado. Se precisar de
   relay, provisionar endpoint Arkhen próprio e segredo por ambiente. Não usar
   o relay/URL/chave da Universo. Aprovar contrato atual da SEFIN e testar em
   homologação antes de remover o guard de rede.
5. O provider só retorna NOT_FOUND após ausência conclusiva, nunca timeout/403.
   AUTHORIZED exige XML validado com DPS, emitente, ambiente e payload corretos.
6. Cancelamento necessita ledger/eventos próprio, elegibilidade do servidor e
   reconciliação. Não marcar nota cancelada ao receber HTTP 200 ou análise.
7. Testar contratos em homologação com autorização específica e só então
   considerar habilitação separada de produção.

## Testes offline

`npm run test:national` e `npm run check:national`

`PGLITE_MODULE=/caminho/instalado/pglite/dist/index.js node scripts/tests/national-ledger-smoke.mjs`

O segundo comando não instala pacotes nem acessa banco remoto. Usa PGlite
fornecido pelo executor e executa SQL em banco efêmero com dados sintéticos.

O teste criptográfico usa OpenSSL local para criar certificado sintético de um
 dia, apagado ao final. Pacotes de teste são versões fixadas no package-lock.
A tentativa de execução Deno ficou bloqueada no acesso direto ao registry npm;
a suíte Node/Vitest e o typecheck estrito passaram. Isso não constitui teste
 do empacotamento/deploy Deno da Edge, que ainda precisa ser validado.

### Additional offline preparation stage
`20261112180000_national_nfse_preparation.sql` allocates an immutable DPS snapshot,
server timestamp, canonical JSONB digest and per-tenant/issuer homologation sequence
(series 80000). Same-draft retries return the same snapshot; changes require a new
reviewed draft. This is not connected to the WebISS RPS allocator or live handler.
Only service_role may call it; an actual reviewed-source/role adapter is still required.
The Vault RPC requires the exact prior prepared identity and only returns credentials
to trusted server code. `credentials.ts` adds actual parsed certificate CNPJ and validity
checks and redacts parser errors. It is not yet wired into a deployed credential loader.
See `RELAY-PLAN.md` for Arkhen-owned infrastructure requirements; no relay was deployed.

### Server wiring and cancellation durability
`server-preparation.ts` connects the allocation RPC, scoped Vault RPC and existing
WebISS RSA PFX parser without calling any provider. An ephemeral synthetic PFX tests
real password handling/key matching. Its required `ReviewedNationalSource` adapter
must authorize the fiscal role and load a reviewed server record; **no permissive
implementation is provided**. Existing membership-only SQL scope is not a substitute
for this missing application authorization layer, so routes remain blocked.
`20261112180000_national_nfse_event_preparation.sql` durably stores immutable signed
cancellation requests for an authorized archived note. It never submits an event or
changes the note to canceled. Event dispatch, reconciliation and accepted-event
persistence remain pending, as does full homologation integration testing.

### Fail-closed reviewed-source adapter and event reconciliation
`nationalReviewedSource` now uses dedicated private fiscal permissions (exact tenant,
configuration and user; expiring/revocable) and reviewed snapshots. No permissions are
seeded and no browser/service write API exists for these tables. Provisioning permissions
and generating/invalidation of reviews from actual business records remain prerequisites,
not bypasses. Lower-level service-role ledger RPCs still require trusted server wiring;
this adapter is not a claim that every RPC has a standalone fiscal-role enforcement.
`reconcileNationalEvents` handles unknown responses, binds accepted events to note and
environment, distinguishes analysis from cancellation and requires archive success before
returning a projected state. Its official-event authenticity verifier and atomic evidence
archive are injected, not implemented deployment services. No actual endpoint is called.

### Charge-connected review (backend staging)
`draft-review.ts` requires explicit national fiscal choices, validates the full DPS
contract without consuming a number and rejects test-only IBS/CBS omissions. Its RPC
joins the existing cobrança/client under a row lock, binds recipient identity/name and
service amount, and stores review tied to a hash of current charge/client records.
Changed charge/client data invalidates the review. The two existing WebISS write paths
have reciprocal homologation-only overlap guards sharing the charge lock. This is
conservative: even a saved review reserves the charge; releasing/switching providers
needs an explicit safe workflow not yet provided. Production WebISS is unaffected.
Still missing: user-facing national draft form, fiscal-configuration revision binding,
atomic revalidation at final claim, full migration/concurrency tests, and live contract.
The server preparation series was corrected to 80000 (allowed homologation range) and
validation timestamps now use whole seconds and explicit UTC offset.

### Review-only API and final atomic guard
`national-review-draft` is now routed to the review-only handler. It derives tenant and
issuer from the fiscal configuration server-side, authorizes existing manager roles,
validates explicit national fields and saves a charge-bound review. It never loads Vault,
allocates DPS or opens a provider connection. Emit/cancel/consult remain blocked.
Configuration revisions are now bound to reviews; existing reviews without that revision
must be redone. The final claim locks charge, config, recipient and review, revalidates
all source/config hashes and the immutable preparation, then performs one compare-and-set.
Tests cover stale charge/config and three queued claims producing one winner. PGlite
serializes these calls, so this is NOT evidence of independent-session concurrency;
real PostgreSQL multi-session/deadlock tests remain a release requirement.
