/** @vitest-environment jsdom */
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({list:vi.fn()}));
vi.mock('../forms/nacional/useNationalReviewRealtime',()=>({useNationalReviewRealtime:vi.fn()}));
vi.mock('../queries/useFaturamentoFiscalQueries',()=>({useFiscalBillingTenant:()=>({data:'tenant'}),useFiscalEmitters:()=>({data:[{id:'config',prestadorNome:'Emitente teste'}]})}));
vi.mock('../forms/nacional/nationalListService',()=>({listNationalReviews:api.list}));
vi.mock('../forms/nacional/NationalDraftForm',()=>({NationalDraftForm:({chargeId}:{chargeId:string})=><div role="dialog">{chargeId}</div>}));
import {NationalReviewsTab} from './NationalReviewsTab';
afterEach(()=>{cleanup();vi.resetAllMocks();});
const show=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NationalReviewsTab/></QueryClientProvider>);
it('separa revisão de nota emitida e abre cobrança existente',async()=>{
 api.list.mockResolvedValue({items:[{draftId:'draft',chargeId:'charge',recipientName:'Tomador teste',competence:'2026-11-12',amount:'10.00',state:'REVIEWED_ONLY',reviewedAt:'2026-11-12'}],hasMore:false});
 show();expect(api.list).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Emitente'),{target:{value:'config'}});
 await screen.findByText('Tomador teste');expect(screen.getByText('Revisada, não emitida')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Abrir revisão'}));expect(screen.getByRole('dialog').textContent).toBe('charge');
 expect((screen.getByRole('button',{name:'Próxima'}) as HTMLButtonElement).disabled).toBe(true);
});
it('falha de acesso não aparece como lista vazia',async()=>{
 api.list.mockRejectedValue(Error('Acesso negado'));show();fireEvent.change(screen.getByLabelText('Emitente'),{target:{value:'config'}});
 expect((await screen.findByRole('alert')).textContent).toContain('Acesso negado');expect(screen.queryByText(/Nenhuma revisão/)).toBeNull();
});
it('opens standalone service review with a stable reference, not a fabricated charge',async()=>{
 api.list.mockResolvedValue({items:[],hasMore:false});show();fireEvent.change(screen.getByLabelText('Emitente'),{target:{value:'config'}});
 await screen.findByText(/Nenhuma revisão/);
 fireEvent.change(screen.getByLabelText('Referência única do serviço'),{target:{value:'service-001'}});
 fireEvent.click(screen.getByRole('button',{name:'Novo serviço / reabrir'}));expect(screen.getByRole('dialog').textContent).toBe('');
});
