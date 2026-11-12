/** @vitest-environment jsdom */
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const mocks=vi.hoisted(()=>({subscribe:vi.fn(),remove:vi.fn()}));
vi.mock('../../../../../lib/realtimeChannel',()=>({subscribeRealtimeChannel:mocks.subscribe}));
vi.mock('../../../../../lib/supabase',()=>({supabase:{removeChannel:mocks.remove}}));
import {useNationalReviewRealtime} from './useNationalReviewRealtime';
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('subscribes only to tenant-filtered public signals and invalidates scoped queries',()=>{
 const channel={on:vi.fn()};channel.on.mockReturnValue(channel);
 mocks.subscribe.mockImplementation((_scope,configure)=>configure(channel));
 const client=new QueryClient();const invalidate=vi.spyOn(client,'invalidateQueries');
 const Host=()=>{useNationalReviewRealtime('tenant');return null;};
 const view=render(<QueryClientProvider client={client}><Host/></QueryClientProvider>);
 expect(channel.on.mock.calls[0][1]).toEqual({event:'*',schema:'public',table:'national_nfse_review_signals',filter:'empresa_id=eq.tenant'});
 channel.on.mock.calls[0][2]();expect(invalidate).toHaveBeenCalledWith({queryKey:['faturamento','national-reviews','tenant']});
 view.unmount();expect(mocks.remove).toHaveBeenCalledWith(channel);
});
