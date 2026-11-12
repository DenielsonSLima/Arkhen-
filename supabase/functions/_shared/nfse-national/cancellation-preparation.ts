import { evaluateCancellationPolicy, type CancellationPolicyInput } from './cancellation-policy.ts';
import { buildNationalCancellation, type CancellationInput } from './events.ts';
import { prepareNationalSignedXml, type NationalSchemaValidator } from './provider.ts';
import type { XmlSignatureProfile } from './signature.ts';
import type { NationalScope } from './adapter.ts';
import { requireContract } from './xml.ts';

/** Offline preparation only. Evidence must be loaded by the server, never accepted from a UI. */
export async function prepareNationalCancellation(userId: string, scope: NationalScope,
  input: CancellationInput, deps: {
    authorize(userId: string, scope: NationalScope): Promise<void>;
    loadEvidence(scope: NationalScope, accessKey: string): Promise<CancellationPolicyInput>;
    schema: NationalSchemaValidator;
    credential: { privateKeyPem: string; certificatePem: string };
    signatureProfile: XmlSignatureProfile;
  }) {
  requireContract(scope.environment === 'homologacao' && input.environment === 'HOMOLOGACAO',
    'NATIONAL_PRODUCTION_NOT_ENABLED');
  await deps.authorize(userId, scope);
  requireContract(input.author.type === 'CNPJ' && input.author.value === scope.issuerCnpj,
    'NATIONAL_ISSUER_MISMATCH');
  const evidence = await deps.loadEvidence(scope, input.accessKey);
  requireContract(evidence.document.accessKey === input.accessKey &&
    evidence.document.environment === input.environment, 'CANCELLATION_SCOPE_MISMATCH');
  const policy = evaluateCancellationPolicy(evidence);
  const capability = input.eventCode === '101101' ? policy.cancel : policy.requestAnalysis;
  requireContract(capability.allowed, 'CANCELLATION_NOT_ELIGIBLE');
  const document = buildNationalCancellation(input);
  const result = await prepareNationalSignedXml(document, deps);
  return { eventReferenceId: document.referenceId, signedEventXml: result.signedXml,
    eventCode: input.eventCode, state: 'PREPARED_ONLY' as const, submitted: false as const };
}
