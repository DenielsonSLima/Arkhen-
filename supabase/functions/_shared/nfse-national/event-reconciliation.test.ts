import {it,expect} from 'vitest';
import {reconcileNationalEvents,type EventReconciliationDependencies} from './event-reconciliation.ts';
import type {NationalScope} from './adapter.ts';
const key='0'.repeat(50),scope={environment:'homologacao'} as NationalScope;
function dependencies(code='101103'):EventReconciliationDependencies {return {
 authorize:async()=>{},lookup:async()=>({state:'FOUND',documents:['synthetic-event']}),
 verifyAccepted:async()=>({accessKey:key,environment:'HOMOLOGACAO',code,sequence:'001',id:`EVT${key}${code}001`}),archive:async()=>{},
};}
it('analysis accepted is not cancelled',async()=>{expect((await reconcileNationalEvents('u',scope,key,dependencies())).state).toBe('AWAITING_ANALYSIS');});
it('confirmed cancellation projects cancelled only after archive',async()=>{expect((await reconcileNationalEvents('u',scope,key,dependencies('101101'))).state).toBe('CANCELLED');});
it('unavailable consultation remains uncertain',async()=>{const d=dependencies();d.lookup=async()=>({state:'UNKNOWN'});expect((await reconcileNationalEvents('u',scope,key,d)).state).toBe('AWAITING_CONFIRMATION');});
it('archive failure cannot report cancellation',async()=>{const d=dependencies('101101');d.archive=async()=>{throw Error('STORAGE_FAILED');};await expect(reconcileNationalEvents('u',scope,key,d)).rejects.toThrow('STORAGE_FAILED');});
it('cross-note accepted event is rejected',async()=>{await expect(reconcileNationalEvents('u',scope,'1'.repeat(50),dependencies())).rejects.toThrow('EVENT_IDENTITY_MISMATCH');});
