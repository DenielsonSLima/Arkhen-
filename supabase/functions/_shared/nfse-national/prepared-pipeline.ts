import { buildNationalDps } from './dps.ts';
import type { NationalDpsInput } from './dps.types.ts';
import { prepareNationalSignedXml } from './provider.ts';
import { createNationalHomologationPilot } from './pilot.ts';
import type { NationalPilotDependencies, NationalPilotResult } from './pilot.types.ts';
import { runNationalDraft, type NationalIntent, type NationalLedger, type NationalOutcome, type NationalScope } from './adapter.ts';
import { requireContract } from './xml.ts';

export interface PreparedPipelineDependencies extends NationalPilotDependencies {
  authorize(userId: string, scope: NationalScope): Promise<void>;
  /** Must persist exact signed bytes before claim; use nationalRpcLedger in server wiring. */
  ledger(prepared: { snapshot: NationalDpsInput; signedDpsXml: string }): NationalLedger;
  /** Private durable archive, bound to intent. Failures must propagate, never log XML publicly. */
  archive(intent: NationalIntent, document: { authorizedXml: string; signedDpsXml: string;
    accessKey: string; number: string }): Promise<void>;
}

/** Complete offline preparation/validation chain. No endpoint or credential lookup is implicit. */
export async function runPreparedNationalDraft(userId: string, intent: NationalIntent,
  input: NationalDpsInput, deps: PreparedPipelineDependencies): Promise<NationalOutcome> {
  requireContract(intent.environment === 'homologacao' && input.environment === 'HOMOLOGACAO',
    'NATIONAL_PRODUCTION_NOT_ENABLED');
  await deps.authorize(userId, intent);
  requireContract(input.issuer.taxId.type === 'CNPJ' && input.issuer.taxId.value === intent.issuerCnpj,
    'NATIONAL_ISSUER_MISMATCH');
  const document = buildNationalDps(input);
  requireContract(document.referenceId === intent.dpsId, 'NATIONAL_DPS_IDENTITY_MISMATCH');
  const prepared = await prepareNationalSignedXml(document, deps);
  const pilot = createNationalHomologationPilot(deps);
  const pilotIntent = { input, expectedDpsId: intent.dpsId };
  async function outcome(result: NationalPilotResult): Promise<NationalOutcome> {
    if (result.state === 'AUTHORIZED') {
      requireContract(result.signedDpsXml === prepared.signedXml, 'NATIONAL_SIGNED_BYTES_MISMATCH');
      await deps.archive(intent, { authorizedXml: result.authorizedXml, signedDpsXml: result.signedDpsXml,
        accessKey: result.accessKey, number: result.number });
      return { state: 'AUTHORIZED', accessKey: result.accessKey };
    }
    if (result.state === 'REJECTED') return { state: 'REJECTED', codes: result.codes };
    return { state: 'AWAITING_CONFIRMATION', code: result.code };
  }
  return await runNationalDraft(userId, intent, {
    authorize: deps.authorize,
    ledger: deps.ledger({ snapshot: input, signedDpsXml: prepared.signedXml }),
    provider: {
      async lookup() {
        const result = await pilot.reconcile(pilotIntent);
        if (result.state === 'AWAITING_CONFIRMATION' && result.code === 'DPS_NOT_FOUND') return { state: 'NOT_FOUND' };
        return await outcome(result);
      },
      async issue() { return await outcome(await pilot.issue(pilotIntent)); },
    },
  });
}
