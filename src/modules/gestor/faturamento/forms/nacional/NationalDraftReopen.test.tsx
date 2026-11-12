/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('./nationalReviewService', () => ({ getNationalChargeReview: api.get, saveNationalReview: api.save }));
import { NationalDraftForm } from './NationalDraftForm';
import { nationalFieldsFromForm } from './nationalFormData';
const snapshot = () => nationalFieldsFromForm({competence:'2026-11-12',issuerName:'Emitente Sintético',issuerCnpj:'00000000000000',issuerMunicipality:'2803401',simpleOption:'1',specialRegime:'0',recipientName:'Tomador Sintético',recipientType:'CNPJ',recipientDocument:'00000000000000',serviceMunicipality:'2803401',nationalTaxCode:'080101',description:'Teste sem valor fiscal',amount:'1.00',issTaxation:'1',issRetention:'1',totalMode:'AMOUNTS',federal:'0.00',state:'0.00',municipal:'0.00',ibscbs:'NOT_APPLICABLE_CONFIRMED'});
const show = () => render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
  <NationalDraftForm configId="config" chargeId="charge" tenantId="tenant" onBack={vi.fn()} onClose={vi.fn()} />
</QueryClientProvider>);
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('reabre com a mesma identidade e exige confirmação nova', async () => {
  const fields = snapshot();
  api.get.mockResolvedValue({draftId:'persisted-id', fields, state:'REVIEWED_ONLY', editable:true,reviewedAt:'2026-11-12'});
  api.save.mockResolvedValue({state:'REVIEWED_ONLY',draftId:'persisted-id',reviewedAt:'2026-11-12T01:00:00Z'});
  show();
  await screen.findByLabelText('Nome do emitente');
  expect((screen.getByLabelText('Nome do emitente') as HTMLInputElement).value).toBe(fields.issuer.name);
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('dialog'));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  expect(api.save.mock.calls[0][0].draft_id).toBe('persisted-id');
  expect(api.save.mock.calls[0][0].expected_reviewed_at).toBe('2026-11-12');
});
it('consulta falha não abre formulário vazio nem permite nova revisão', async () => {
  api.get.mockRejectedValue(Error('denied')); show();
  expect((await screen.findByRole('alert')).textContent).toContain('Nenhum rascunho novo');
  expect(screen.queryByRole('checkbox')).toBeNull(); expect(api.save).not.toHaveBeenCalled();
});
it('revisão preparada pode ser lida mas não alterada', async () => {
  api.get.mockResolvedValue({draftId:'prepared',fields:snapshot(),state:'PREPARED_LOCKED',editable:false,reviewedAt:'2026-11-12'});
  show(); await screen.findByLabelText('Nome do emitente');
  expect((screen.getByRole('button',{name:'Salvar revisão nacional'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByRole('dialog')); expect(api.save).not.toHaveBeenCalled();
});
it('trocar de empresa não exibe revisão do cache anterior', async () => {
  api.get.mockImplementation(config => config==='config' ? Promise.resolve({draftId:'a',fields:snapshot(),state:'REVIEWED_ONLY',editable:true,reviewedAt:'2026-11-12'}) : new Promise(()=>{}));
  const client=new QueryClient();
  const view=render(<QueryClientProvider client={client}><NationalDraftForm configId="config" chargeId="a" tenantId="a" onBack={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
  await screen.findByLabelText('Nome do emitente');
  view.rerender(<QueryClientProvider client={client}><NationalDraftForm configId="other" chargeId="b" tenantId="b" onBack={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
  expect(screen.queryByLabelText('Nome do emitente')).toBeNull();
});
