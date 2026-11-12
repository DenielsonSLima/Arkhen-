import { describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../../../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
import { saveNationalReview, type NationalReviewRequest } from './nationalReviewService';
const request = { fiscal_config_id:'config',charge_id:'charge',draft_id:'draft',fields:{} } as NationalReviewRequest;
describe('national review service', () => {
  it('chama apenas revisão, sem emissão', async () => {
    invoke.mockResolvedValueOnce({ data:{ok:true,state:'REVIEWED_ONLY',submitted:false,liveReady:false,draftId:'draft',reviewedAt:'2026-11-12T00:00:00Z'},error:null });
    await saveNationalReview(request);
    expect(invoke).toHaveBeenLastCalledWith('fiscal-integration',{body:{action:'national-review-draft',...request}});
  });
  it('não declara sucesso com integração ausente ou retorno inesperado', async () => {
    invoke.mockResolvedValueOnce({ data:null,error:Error('missing endpoint') });
    await expect(saveNationalReview(request)).rejects.toThrow('não foi salva');
    invoke.mockResolvedValueOnce({ data:{ok:true,state:'AUTHORIZED',submitted:true},error:null });
    await expect(saveNationalReview(request)).rejects.toThrow('Resposta inesperada');
  });
});
