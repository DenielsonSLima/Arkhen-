import type { NationalIntent, NationalLedger, NationalRecord, NationalOutcome } from './adapter.ts';
export interface NationalRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
/** companyId is a fiscal configuration id, not a browser-selected tenant override. */
export function nationalRpcLedger(client: NationalRpcClient, authenticatedUserId: string,
  prepared: { snapshot: Record<string, unknown>; signedDpsXml: string }): NationalLedger {
  async function rpc(name: string, intent: NationalIntent, extra: Record<string, unknown> = {}) {
    const result = await client.rpc(name, { p_user_id: authenticatedUserId, p_intent: intent, ...extra });
    if (result.error) throw new Error('NATIONAL_LEDGER_UNAVAILABLE');
    return result.data;
  }
  return {
    async reserve(intent): Promise<NationalRecord> {
      const data = await rpc('national_nfse_reserve_edge', intent,
        { p_snapshot: prepared.snapshot, p_signed_xml: prepared.signedDpsXml });
      if (!data || typeof data !== 'object' || !('intent' in data) || !('dispatched' in data) ||
          typeof data.dispatched !== 'boolean') throw new Error('INVALID_NATIONAL_LEDGER_RESPONSE');
      return data as NationalRecord;
    },
    async claim(intent) {
      const value = await rpc('national_nfse_claim_edge', intent);
      if (typeof value !== 'boolean') throw new Error('INVALID_NATIONAL_LEDGER_RESPONSE');
      return value;
    },
    async settle(intent, outcome: NationalOutcome) { await rpc('national_nfse_settle_edge', intent, { p_outcome: outcome }); },
  };
}

export function nationalRpcArchive(client: NationalRpcClient, authenticatedUserId: string) {
  return async (intent: NationalIntent, document: { authorizedXml: string; signedDpsXml: string; accessKey: string; number: string }) => {
    const { error } = await client.rpc('national_nfse_archive_edge',
      { p_user_id: authenticatedUserId, p_intent: intent, p_document: document });
    if (error) throw new Error('NATIONAL_ARCHIVE_UNAVAILABLE');
  };
}

/** Archive only after authorization, policy and signature checks in cancellation-preparation. */
export async function nationalRpcPrepareEvent(client: NationalRpcClient, userId: string,
 intent: NationalIntent, event: { accessKey: string; eventCode: string; eventReferenceId: string; signedEventXml: string }) {
 const result=await client.rpc('national_nfse_prepare_event_edge',{p_user_id:userId,p_intent:intent,p_event:event});
 if(result.error || !result.data || typeof result.data!=='object') throw new Error('NATIONAL_EVENT_STORAGE_UNAVAILABLE');
 const data=result.data as {state:unknown;submitted:unknown;eventReferenceId:unknown};
 if(data.state!=='PREPARED_ONLY' || data.submitted!==false || data.eventReferenceId!==event.eventReferenceId)
  throw new Error('INVALID_NATIONAL_EVENT_RESPONSE');
 return {state:'PREPARED_ONLY' as const,submitted:false as const,eventReferenceId:event.eventReferenceId};
}
