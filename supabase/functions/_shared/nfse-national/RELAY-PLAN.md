# Arkhen-owned fiscal relay: deployment prerequisites (not implemented/deployed)

Do not reuse Universo URLs, credentials, issuer allowlists or certificates. Edge live
routes remain closed. Allocation and Vault RPCs are server-only preparation primitives,
not permission to issue a fiscal document.

## Boundary
- Deploy a dedicated Arkhen-owned service only if Edge mTLS cannot pass runtime tests.
- Pin the official homologation host and path set in server code. Reject user-provided
  URLs, production hosts, redirects, proxy overrides and arbitrary HTTP methods.
- Authenticate calls with a dedicated service identity and short-lived signed request
  claims binding tenant, exact fiscal configuration, issuer, environment, operation,
  DPS/event identity, XML digest, expiration and nonce. Enforce durable replay protection.
- Relay independently validates environment, XML/XSD/signature, issuer authorization,
  size limits and allowed operation before opening any socket. Never trust caller flags.
- Prefer scoped credential retrieval inside relay under an Arkhen-specific identity.
  Never let browser transmit/receive A1, private key or password. If crossing service
  boundaries is necessary, approve that precise deployment/data destination first.
- No secrets/XML/customer personal data in logs. Audit only operation IDs, digest,
  normalized status and timing. Errors must be redacted. Pin TLS trust and dependencies.
- Persist claim before dispatch and response archive before final status. On timeout,
  reconcile exact DPS/event; never reissue with a fresh number or retry POST blindly.

## Before enabling even homologation
1. Verify current official SEFIN contract, municipalities and issuer enrollment.
2. Bind staff fiscal-role permissions and reviewed source records to server snapshot;
   the preparation RPC currently trusts its service caller's reviewed snapshot.
3. Test the complete migrations and actual roles, including concurrent allocation and
   revoked users, against an isolated project. Synthetic PGlite is not a substitute.
4. Bind existing Vault PFX parser to credentials.ts and verify extracted CNPJ, validity,
   private-key match and chain without exporting credentials to callers.
5. Validate deployed Deno/Node packaging, trust store, timeout and egress behavior.
6. Add durable cancellation-event allocation/reconciliation and government response tests.
7. Obtain scoped authorization for controlled homologation. Production remains a
   separate gated release, not an environment toggle exposed to a browser.
