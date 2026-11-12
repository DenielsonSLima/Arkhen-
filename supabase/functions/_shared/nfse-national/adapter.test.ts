import { describe, expect, it, vi } from 'vitest';
import { runNationalDraft, type NationalIntent, type NationalRecord, type NationalDependencies } from './adapter';
const id = '10000000-0000-4000-8000-000000000001';
const intent: NationalIntent = { tenantId: id, companyId: id, draftId: id,
  environment: 'homologacao', issuerCnpj: '00000000000000', dpsId: `DPS${'0'.repeat(42)}`, snapshotHash: 'a'.repeat(64) };
function setup() {
  let record: NationalRecord | undefined;
  const deps: NationalDependencies = {
    authorize: vi.fn(async () => {}),
    ledger: {
      reserve: vi.fn(async (input) => { record ??= { intent: { ...input }, dispatched: false }; return structuredClone(record); }),
      claim: vi.fn(async () => { if (record!.dispatched) return false; record!.dispatched = true; return true; }),
      settle: vi.fn(async (_, outcome) => { record!.outcome = outcome; }),
    },
    provider: { lookup: vi.fn(async () => ({ state: 'NOT_FOUND' as const })),
      issue: vi.fn(async () => ({ state: 'AUTHORIZED' as const, accessKey: '0'.repeat(50) })) },
  };
  return deps;
}
describe('National draft isolated orchestration', () => {
  it('blocks production before any dependency', async () => {
    const deps = setup();
    await expect(runNationalDraft(id, { ...intent, environment: 'producao' }, deps)).rejects.toThrow('NOT_ENABLED');
    expect(deps.authorize).not.toHaveBeenCalled();
  });
  it('authorizes before reserving or transmitting', async () => {
    const deps = setup(); vi.mocked(deps.authorize).mockRejectedValue(new Error('DENIED'));
    await expect(runNationalDraft(id, intent, deps)).rejects.toThrow('DENIED');
    expect(deps.ledger.reserve).not.toHaveBeenCalled(); expect(deps.provider.issue).not.toHaveBeenCalled();
  });
  it.each(['tenantId', 'companyId', 'issuerCnpj', 'dpsId', 'snapshotHash', 'environment'] as const)('rejects mismatched persisted %s', async (field) => {
    const deps = setup(); vi.mocked(deps.ledger.reserve).mockResolvedValue({ intent: { ...intent, [field]: 'different' }, dispatched: false });
    await expect(runNationalDraft(id, intent, deps)).rejects.toThrow('IDENTITY_CONFLICT');
    expect(deps.provider.lookup).not.toHaveBeenCalled();
  });
  it('reconciles an existing authorization without sending', async () => {
    const deps = setup(); vi.mocked(deps.provider.lookup).mockResolvedValue({ state: 'AUTHORIZED', accessKey: '1'.repeat(50) });
    expect((await runNationalDraft(id, intent, deps)).state).toBe('AUTHORIZED');
    expect(deps.provider.issue).not.toHaveBeenCalled();
  });
  it('does not POST after an uncertain lookup', async () => {
    const deps = setup(); vi.mocked(deps.provider.lookup).mockRejectedValue(new Error('offline'));
    expect((await runNationalDraft(id, intent, deps)).state).toBe('AWAITING_CONFIRMATION');
    expect(deps.ledger.claim).not.toHaveBeenCalled();
  });
  it('allows at most one POST with concurrent requests', async () => {
    const deps = setup(); await Promise.all([runNationalDraft(id, intent, deps), runNationalDraft(id, intent, deps)]);
    expect(deps.provider.issue).toHaveBeenCalledTimes(1);
  });
  it('does not resend after a timeout', async () => {
    const deps = setup(); vi.mocked(deps.provider.issue).mockRejectedValue(new Error('timeout'));
    await runNationalDraft(id, intent, deps); await runNationalDraft(id, intent, deps);
    expect(deps.provider.issue).toHaveBeenCalledTimes(1);
  });
  it('preserves the claim after persistence failure', async () => {
    const deps = setup(); vi.mocked(deps.ledger.settle).mockRejectedValueOnce(new Error('database unavailable'));
    await expect(runNationalDraft(id, intent, deps)).rejects.toThrow('database unavailable');
    await runNationalDraft(id, intent, deps); expect(deps.provider.issue).toHaveBeenCalledTimes(1);
  });
  it('returns saved final result only after reauthorization', async () => {
    const deps = setup(); await runNationalDraft(id, intent, deps); await runNationalDraft(id, intent, deps);
    expect(deps.authorize).toHaveBeenCalledTimes(2); expect(deps.provider.issue).toHaveBeenCalledTimes(1);
  });
});
