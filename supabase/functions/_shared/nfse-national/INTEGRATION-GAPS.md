# Integration into Arkhen's current records

## Reused, not recreated
- Tenant/session: `resolve_empresa_id_for_user`, managed credential check.
- Fiscal configuration and client/office issuer: `configuracoes_integracao_fiscal`.
- PFX/key/password: existing Vault entries and `parseFiscalPkcs12` RSA key matching.
- Manager/accountant access: `resolve_inter_manager_empresa_id` plus exact current-tenant
  equality. The resolver name is banking-specific but its implementation reads existing
  active admin/contador and gestor/administrador records. It is not a new permission grant.
- Existing production emission remains WebISS and is unchanged.

## Current data is not a national draft
`webiss_rascunhos.dados` explicitly allowlists ABRASF fields. `webiss_revisar` joins actual
clients/configuration and validates WebISS endpoint, municipal enrollment and service fields.
Its ready=true means **WebISS ready**, not SEFIN ready. Do not reinterpret it as national.

Can reuse after explicit new review: competence, service description/amount, issuer and
recipient identity/address/contact, municipality IDs. Existing cobrança/source linkage
must remain intact and must prevent issuance of the same charge in both providers.

Cannot infer: national six-digit service tax code from ABRASF item/CNAE/municipal code;
Simple Nacional assessment option; national special-regime enums; required tax total
choice; IBS/CBS applicability/classification; retention scope. RPS identity/sequence is
not a DPS identity/sequence. WebISS's provider/municipality availability does not prove
that the same issuer is enrolled/authorized in the national production environment.

## Integrated review-only implementation (not deployed)
- `national-review-draft` authenticates through the existing handler, derives issuer
  scope server-side, validates explicit national fields and atomically revalidates
  the charge and authorization before saving `REVIEWED_ONLY`. It never transmits.
- The national form is available from an editable WebISS preparation linked to a
  charge after issuer selection. Fiscal choices start blank, not translated from
  WebISS. The form clears confirmation after edits and handles unavailable backend
  without claiming persistence. It has no transmission action.
- The charge/source linkage and cross-provider guards are present in migrations
  and tested against synthetic PostgreSQL fixtures. Those fixtures do not replace
  schema-complete staging validation or prove the deployed environment.

- Existing charge-linked reviews can now be reopened with their persisted identity.
  Lookup fails closed on tenant/issuer mismatch, and prepared reviews are read-only.
  Unsupported fiscal fields are rejected rather than silently discarded by the form.
- Review saves use an expected `reviewedAt` token under the charge row lock. An older
  operator cannot overwrite a newer saved review. The new service RPC and frontend
  must be deployed together after migrations; no mixed-version rollout is supported.
- Local PGlite checks cover reopening, stale source, cross-issuer denial and stale
  review-version rejection. They serialize through one local engine and do not prove
  independent PostgreSQL connection contention or the complete production schema.

- A dedicated national-review tab lists the selected issuer's charge-linked and standalone
  reviews, 25 per page, with explicit non-issued status and reopen action. Lookup and
  list remain service-only authorized RPCs; no direct private ledger access is granted.
  Current list refreshes on mutation, charge realtime invalidation, remount/focus.
  Cross-session invalidation uses an RLS-protected public version signal with no fiscal
  snapshot. Realtime publication and authenticated delivery still require staging validation.

## Remaining implementation work (not external outages)
1. Complete authenticated end-to-end validation against a complete staging schema.
   Standalone service review now uses an immutable declared reference unique per issuer,
   snapshot revision, optimistic version and preparation lock; it creates no cobrança.
   Offline preparation now consumes the exact server-owned review under matching source
   locks, with idempotent numbering and immutable preparation. Claim/transmission still
   rejects standalone services. Before enabling transport, connect that lifecycle and
   establish cross-provider service identity:
   two different declared references can still describe the same real-world service.
2. Validate source-revision invalidation, charge locks and every service-RPC boundary
   against real schema/roles before applying migrations; preserve the current locks.
3. Implement official accepted-event signature/schema verifier and verified archive transaction;
   connect reconciliation only after these exist. A separate UNVERIFIED evidence quarantine
   now archives raw documents atomically, deduplicated by ledger/content hash. It never
   changes fiscal state and cannot substitute for the verified archive dependency.
   Synthetic injected evidence is not proof.
4. Connect and validate mTLS/relay, signed-document preparation and authorized event
   lifecycle before considering any transmission switch. Review-only is not issuance.

## External validation prerequisites
- Current official SEFIN layout/contract and issuer enrollment/municipality routing.
- Isolated Supabase/Deno environment to test full migrations, roles and packaging.
- Working mTLS runtime or Arkhen-owned approved relay; no Universo credentials or URLs.
- Explicit controlled homologation authorization with synthetic fiscal recipient/data.

Only review/readiness handlers are present in code; they are not deployed by this work.
No live requests have been made. The product
must continue displaying national issuance/cancellation as unavailable, not complete.

## Cross-provider identity limitation found in the actual schema
`webiss_rascunhos` supports no-charge drafts, but has no mandatory shared service
reference. Its `origem` JSON is not a proven common identity. Recipient + date + amount
or text similarity cannot safely distinguish duplicate billing from separate services.
A production cross-provider guard therefore needs an explicit shared source reference
in both creation paths plus a reviewed mapping of legacy drafts. This work does not
silently backfill references, block existing WebISS drafts, or claim that amount-based
matching prevents duplicate service issuance. National transport remains disabled.

## Additional environment dependencies
The local PostgreSQL checks use a simplified synthetic schema and one PGlite engine.
They cannot prove contention between independent connections, Supabase Realtime delivery,
Vault integration, Deno Edge packaging, current official event XSD/signing trust rules,
or issuer enrollment. A schema-complete isolated Supabase staging project and reviewed
current official event contract are needed before those claims can be made. No production
credential or endpoint from Universo may be reused as a shortcut.
