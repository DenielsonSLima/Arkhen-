/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const save = vi.hoisted(() => vi.fn());
vi.mock('./nationalFormData', () => ({ nationalFieldsFromForm: () => ({ environment: 'HOMOLOGACAO' }) }));
vi.mock('./nationalReviewService', () => ({ saveNationalReview: save }));
import { NationalDraftEditor } from './NationalDraftForm';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const show = () => { const onBack = vi.fn(); const onClose = vi.fn(); render(<QueryClientProvider client={new QueryClient()}><NationalDraftEditor existing={null} configId="config" chargeId="charge" tenantId="tenant" onBack={onBack} onClose={onClose} /></QueryClientProvider>); return { onBack,onClose }; };
describe('national draft UI', () => {
  it('exibe bloqueio de transmissão e exige confirmação explícita', () => {
    show();
    expect((screen.getByRole('button',{name:'Emissão indisponível'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Salvar revisão nacional'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole('dialog'));
    expect(save).not.toHaveBeenCalled();
  });
  it('permite voltar e fechar sem chamar API', () => {
    const {onBack,onClose}=show();
    fireEvent.click(screen.getByRole('button',{name:'Voltar ao WebISS'})); expect(onBack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'Fechar revisão nacional'})); expect(onClose).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
  it('não mantém confirmação depois de editar valores', () => {
    show(); const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox); expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Nome do emitente'),{target:{value:'Empresa'}});
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });
  it('bloqueia repetição e fechamento enquanto salva, sem emitir', async () => {
    let resolve!: (value: unknown) => void;
    save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    show(); fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('dialog')); fireEvent.submit(screen.getByRole('dialog'));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect((screen.getByRole('button',{name:'Fechar revisão nacional'}) as HTMLButtonElement).disabled).toBe(true);
    resolve({ok:true,state:'REVIEWED_ONLY',submitted:false,liveReady:false});
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Nenhuma DPS'));
    expect(save.mock.calls[0][0]).toMatchObject({fiscal_config_id:'config',charge_id:'charge',fields:{environment:'HOMOLOGACAO'}});
  });
  it('preserva os dados e não afirma sucesso quando o backend recusa', async () => {
    save.mockRejectedValueOnce(Error('Integração indisponível'));
    show(); fireEvent.change(screen.getByLabelText('Nome do emitente'),{target:{value:'Empresa de teste'}});
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.submit(screen.getByRole('dialog'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Integração indisponível'));
    expect((screen.getByLabelText('Nome do emitente') as HTMLInputElement).value).toBe('Empresa de teste');
    expect(screen.queryByRole('status')).toBeNull();
  });

});
