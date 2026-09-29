/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemQuickModal } from './SystemQuickModal';

afterEach(cleanup);

describe('SystemQuickModal', () => {
  it('expõe semântica acessível, foco seguro e fechamento por Escape', async () => {
    const onClose = vi.fn();
    render(
      <SystemQuickModal
        isOpen
        title="Excluir obrigação?"
        message="Confirme a exclusão."
        onConfirm={vi.fn()}
        onClose={onClose}
        danger
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Excluir obrigação?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancelar' }),
    ));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('aguarda uma confirmação assíncrona e bloqueia cliques duplicados', async () => {
    let resolveConfirmation: (() => void) | undefined;
    const onClose = vi.fn();
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    }));
    render(
      <SystemQuickModal
        isOpen
        title="Confirmar"
        message="Aguarde a operação."
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect((screen.getByRole('button', { name: 'Processando...' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    resolveConfirmation?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
