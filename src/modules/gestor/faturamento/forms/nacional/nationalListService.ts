import { supabase } from '../../../../../lib/supabase';
export interface NationalReviewRow {chargeId:string;serviceReference:string;draftId:string;recipientName:string;competence:string;amount:string;state:string;reviewedAt:string;}
export async function listNationalReviews(configId:string,offset:number):Promise<{items:NationalReviewRow[];hasMore:boolean}> {
 const {data,error}=await supabase.functions.invoke('fiscal-integration',{body:{action:'national-list-reviews',fiscal_config_id:configId,offset}});
 if(error||data?.ok!==true||!Array.isArray(data.items)||typeof data.hasMore!=='boolean') throw Error('Não foi possível consultar as revisões nacionais.');
 if(data.items.some((row:NationalReviewRow)=>!row||['chargeId','serviceReference','draftId','recipientName','competence','amount','state','reviewedAt'].some(key=>typeof row[key as keyof NationalReviewRow]!=='string'))) throw Error('Resposta inesperada ao consultar as revisões.');
 return {items:data.items,hasMore:data.hasMore};
}
