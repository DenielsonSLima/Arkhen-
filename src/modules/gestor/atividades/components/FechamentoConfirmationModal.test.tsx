/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FechamentoConfirmationModal } from './FechamentoConfirmationModal';
afterEach(cleanup);
describe('confirmação de fechamento auditável', () => {
  it('exige justificativa na reabertura e conserva o formulário quando servidor rejeita', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Sem permissão')); const close = vi.fn();
    render(<FechamentoConfirmationModal isOpen reopening onClose={close} onConfirm={save} />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Justificativa'), { target: { value: 'Corrigir documento' } });
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() => expect(screen.getByText('Sem permissão')).toBeTruthy());
    expect(save).toHaveBeenCalledWith('Corrigir documento'); expect(close).not.toHaveBeenCalled();
  });
  it('bloqueia envios concorrentes até confirmação efetiva', async () => {
    let resolve!: () => void; const save = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<FechamentoConfirmationModal isOpen reopening={false} onClose={vi.fn()} onConfirm={save} />);
    fireEvent.click(screen.getByText('Confirmar'));
    fireEvent.click(screen.getByText('Salvando...'));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
});
