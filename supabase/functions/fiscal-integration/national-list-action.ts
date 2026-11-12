import type { NationalRpcClient } from '../_shared/nfse-national/rpc-ledger.ts';
export async function handleNationalList(admin:NationalRpcClient,userId:string,payload:Record<string,unknown>) {
 const id=payload.fiscal_config_id;const offset=payload.offset??0;
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
 ||typeof offset!=='number'||!Number.isInteger(offset)||offset<0||offset>10000) return {status:400,body:{ok:false,code:'NATIONAL_INVALID_PAGE'}};
 try {
  const result=await admin.rpc('national_nfse_list_reviews_edge',{p_user_id:userId,p_fiscal_config_id:id,p_offset:offset});
  const data=result.data as {items?:Record<string,unknown>[];hasMore?:boolean}|null;
  if(result.error||!data||!Array.isArray(data.items)||data.items.length>25||typeof data.hasMore!=='boolean') throw Error('DENIED');
  const items=data.items.map(row=>{
   const keys=['chargeId','serviceReference','draftId','recipientName','competence','amount','state','reviewedAt'];
   if(!row||keys.some(key=>typeof row[key]!=='string')) throw Error('INVALID_ROW');
   return Object.fromEntries(keys.map(key=>[key,row[key]]));
  });
  return {status:200,body:{ok:true,items,hasMore:data.hasMore,liveReady:false}};
 } catch {return {status:403,body:{ok:false,code:'NATIONAL_LIST_UNAVAILABLE'}};}
}
