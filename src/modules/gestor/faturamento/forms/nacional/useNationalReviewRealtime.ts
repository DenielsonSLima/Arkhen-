import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../../../../lib/supabase';
import {subscribeRealtimeChannel} from '../../../../../lib/realtimeChannel';
/** Only RLS-protected version signals, never subscribe to private fiscal snapshots. */
export function useNationalReviewRealtime(tenant:string) {
 const client=useQueryClient();
 useEffect(()=>{
  const invalidate=()=>{void client.invalidateQueries({queryKey:['faturamento','national-reviews',tenant]});void client.invalidateQueries({queryKey:['faturamento','national-review',tenant]});};
  const channel=subscribeRealtimeChannel(`national-reviews-${tenant}`,ch=>ch.on('postgres_changes',
   {event:'*',schema:'public',table:'national_nfse_review_signals',filter:`empresa_id=eq.${tenant}`},invalidate),
   status=>{if(status==='SUBSCRIBED') invalidate();});
  return ()=>{if(channel) void supabase.removeChannel(channel);};
 },[tenant,client]);
}
