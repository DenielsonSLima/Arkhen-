import type { NationalScope } from './adapter.ts';
import {projectCancellationState,type AcceptedNationalEvent} from './events.ts';
import {requireContract} from './xml.ts';
export interface EventReconciliationDependencies {
 authorize(userId:string,scope:NationalScope):Promise<void>;
 lookup(accessKey:string):Promise<{state:'UNKNOWN'} | {state:'FOUND';documents:readonly string[]}>;
 /** Must verify official schema, authenticity and acceptance, not merely parse caller JSON. */
 verifyAccepted(xml:string):Promise<AcceptedNationalEvent>;
 /** Atomically archive the complete verified evidence; failure prevents projecting success. */
 archive(scope:NationalScope,accessKey:string,events:readonly {xml:string;event:AcceptedNationalEvent}[]):Promise<void>;
}
/** Read/reconcile only; no POST method or retry path exists. */
export async function reconcileNationalEvents(userId:string,scope:NationalScope,accessKey:string,deps:EventReconciliationDependencies) {
 requireContract(scope.environment==='homologacao','NATIONAL_PRODUCTION_NOT_ENABLED');
 requireContract(/^\d{50}$/.test(accessKey),'INVALID_ACCESS_KEY');
 await deps.authorize(userId,scope);
 const result=await deps.lookup(accessKey);
 if(result.state==='UNKNOWN') return {state:'AWAITING_CONFIRMATION' as const};
 requireContract(result.documents.length<=100,'NATIONAL_TOO_MANY_EVENTS');
 const verified: {xml:string;event:AcceptedNationalEvent}[]=[];
 const seen=new Map<string,string>();
 for(const xml of result.documents) {
  requireContract(xml.length>0 && xml.length<=4194304,'NATIONAL_INVALID_EVENT_SIZE');
  const event=await deps.verifyAccepted(xml);
  projectCancellationState(accessKey,'HOMOLOGACAO',[event]);
  const previous=seen.get(event.id);
  requireContract(previous===undefined || previous===xml,'NATIONAL_EVENT_CONTENT_CONFLICT');
  if(previous===undefined){verified.push({xml,event});seen.set(event.id,xml);}
 }
 const state=projectCancellationState(accessKey,'HOMOLOGACAO',verified.map(x=>x.event));
 await deps.archive(scope,accessKey,verified);
 return {state};
}
