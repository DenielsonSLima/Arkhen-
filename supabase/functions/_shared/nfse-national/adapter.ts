/** Preparation stage only. Not connected to an Edge handler or live transport. */
export type Environment = 'homologacao' | 'producao';
export interface NationalScope {
  tenantId: string; companyId: string; environment: Environment; issuerCnpj: string;
}
export interface NationalIntent extends NationalScope {
  draftId: string;
  /** Allocated server-side once. Never change after dispatch. */
  dpsId: string;
  /** Digest of the complete canonical snapshot, not supplied by the browser. */
  snapshotHash: string;
}
export type NationalOutcome =
  | { state: 'AUTHORIZED'; accessKey: string }
  | { state: 'REJECTED'; codes: string[] }
  | { state: 'AWAITING_CONFIRMATION'; code: string };
export interface NationalRecord {
  intent: NationalIntent; outcome?: NationalOutcome;
  /** Durable claim means a crash must reconcile, never send again automatically. */
  dispatched: boolean;
}
export interface NationalLedger {
  /** Atomic insert-or-read, enforcing UNIQUE(tenant, company, environment, draft). */
  reserve(intent: NationalIntent): Promise<NationalRecord>;
  /** Compare-and-set false -> true; exactly one caller may win. */
  claim(intent: NationalIntent): Promise<boolean>;
  /** Must match the complete scope and identity atomically. */
  settle(intent: NationalIntent, outcome: NationalOutcome): Promise<void>;
}
export type NationalLookup = NationalOutcome | { state: 'NOT_FOUND' };
export interface NationalDependencies {
  /** Server authorization; validate authenticated user membership AND issuing rights. */
  authorize(userId: string, scope: NationalScope): Promise<void>;
  ledger: NationalLedger;
  /** Must validate exact schema/signature and issuer, DPS, environment, payload of responses. */
  provider: {
    lookup(intent: NationalIntent): Promise<NationalLookup>;
    issue(intent: NationalIntent): Promise<NationalOutcome>;
  };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(intent: NationalIntent) {
  if (![intent.tenantId, intent.companyId, intent.draftId].every(value => uuid.test(value)) ||
      !/^\d{14}$/.test(intent.issuerCnpj) || !/^DPS\d{42}$/.test(intent.dpsId) ||
      !/^[a-f0-9]{64}$/.test(intent.snapshotHash)) throw new Error('INVALID_NATIONAL_IDENTITY');
  if (intent.environment !== 'homologacao') throw new Error('NATIONAL_PRODUCTION_NOT_ENABLED');
}
function sameIdentity(a: NationalIntent, b: NationalIntent) {
  return (['tenantId', 'companyId', 'environment', 'issuerCnpj', 'draftId', 'dpsId', 'snapshotHash'] as const)
    .every(key => a[key] === b[key]);
}
function normalizeOutcome(result: NationalOutcome): NationalOutcome {
  if (result.state === 'AUTHORIZED' && /^\d{50}$/.test(result.accessKey)) {
    return { state: 'AUTHORIZED', accessKey: result.accessKey };
  }
  if (result.state === 'REJECTED' && Array.isArray(result.codes) && result.codes.length > 0 &&
      result.codes.every(code => /^[A-Z0-9_-]{1,40}$/.test(code))) {
    return { state: 'REJECTED', codes: result.codes.slice(0, 20) };
  }
  return { state: 'AWAITING_CONFIRMATION', code: 'PROVIDER_RESULT_UNCONFIRMED' };
}

/**
 * Pure orchestration inspired by Universo's lookup-before-POST and durable claim.
 * Inject only synthetic providers until ledger/RLS, XML/XSD, mTLS and contract gates
 * have been implemented and verified. Production is deliberately rejected here.
 */
export async function runNationalDraft(userId: string, intent: NationalIntent,
  deps: NationalDependencies): Promise<NationalOutcome> {
  validate(intent);
  if (!uuid.test(userId)) throw new Error('INVALID_OPERATOR');
  await deps.authorize(userId, intent);
  const record = await deps.ledger.reserve(intent);
  if (!sameIdentity(record.intent, intent)) throw new Error('NATIONAL_IDENTITY_CONFLICT');
  if (record.outcome?.state === 'AUTHORIZED' || record.outcome?.state === 'REJECTED') {
    return normalizeOutcome(record.outcome);
  }
  let lookup: NationalLookup;
  try { lookup = await deps.provider.lookup(intent); }
  catch { return { state: 'AWAITING_CONFIRMATION', code: 'LOOKUP_UNAVAILABLE' }; }
  if (lookup.state !== 'NOT_FOUND') {
    const outcome = normalizeOutcome(lookup);
    await deps.ledger.settle(intent, outcome);
    return outcome;
  }
  // A prior POST may have succeeded even when the current lookup has not found it yet.
  if (record.dispatched || !await deps.ledger.claim(intent)) {
    return { state: 'AWAITING_CONFIRMATION', code: 'DISPATCH_ALREADY_CLAIMED' };
  }
  let outcome: NationalOutcome;
  try { outcome = normalizeOutcome(await deps.provider.issue(intent)); }
  catch { outcome = { state: 'AWAITING_CONFIRMATION', code: 'DISPATCH_RESULT_UNKNOWN' }; }
  // Failure here leaves the durable claim intact, preventing unsafe automatic retries.
  await deps.ledger.settle(intent, outcome);
  return outcome;
}
