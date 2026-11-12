import type { NationalIntent } from './adapter.ts';
import { requireContract } from './xml.ts';
export interface NationalCredentialDependencies {
  authorize(userId: string, intent: NationalIntent): Promise<void>;
  load(userId: string, intent: NationalIntent): Promise<{ pfxBase64: string; password: string }>;
  /** Use existing server PFX parser, never metadata supplied by the browser. */
  parse(pfxBase64: string, password: string): Promise<{ cnpj: string; validFrom: string; validUntil: string;
    certificatePem: string; privateKeyPem: string }>;
  now(): number;
}
/** Server-only; caller must never serialize, log or return the resulting key material. */
export async function loadNationalCredentials(userId: string, intent: NationalIntent, deps: NationalCredentialDependencies) {
  requireContract(intent.environment === 'homologacao', 'NATIONAL_PRODUCTION_NOT_ENABLED');
  await deps.authorize(userId, intent);
  try {
    const saved = await deps.load(userId, intent);
    const parsed = await deps.parse(saved.pfxBase64, saved.password); // Preserve exact password.
    requireContract(parsed.cnpj === intent.issuerCnpj, 'NATIONAL_CERTIFICATE_ISSUER_MISMATCH');
    const now = deps.now(), start = Date.parse(parsed.validFrom), end = Date.parse(parsed.validUntil);
    requireContract(Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) &&
      start <= now && now < end, 'NATIONAL_CERTIFICATE_EXPIRED_OR_NOT_YET_VALID');
    requireContract(Boolean(parsed.privateKeyPem && parsed.certificatePem), 'NATIONAL_CERTIFICATE_INCOMPLETE');
    return { certificatePem: parsed.certificatePem, privateKeyPem: parsed.privateKeyPem };
  } catch {
    // Parser/provider errors can contain credential input; expose no raw exception.
    throw new Error('NATIONAL_CERTIFICATE_UNAVAILABLE_OR_INVALID');
  }
}
