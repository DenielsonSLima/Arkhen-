/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NovaCategoriaClienteModal } from './NovaCategoriaClienteModal';

const props = () => ({
  nome: '',
  descricao: '',
  error: '',
  onNomeChange: vi.fn(),
  onDescricaoChange: vi.fn(),
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
});

describe('NovaCategoriaClienteModal', () => {
  afterEach(() => cleanup());

  it('é renderizado fora do formulário transformado e fecha com Escape', () => {
    const modalProps = props();
    const { container } = render(
      <div style={{ transform: 'translateY(1px)' }}>
        <NovaCategoriaClienteModal {...modalProps} />
      </div>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Nova Categoria' });
    expect(container.contains(dialog)).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(modalProps.onCancel).toHaveBeenCalledOnce();
  });

  it('não fecha pelo fundo enquanto o salvamento está em andamento', () => {
    const modalProps = props();
    render(<NovaCategoriaClienteModal {...modalProps} isSaving />);

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(modalProps.onCancel).not.toHaveBeenCalled();
  });

  it('não propaga clique do diálogo portalizado para o modal de cliente', () => {
    const modalProps = props();
    const closeParentModal = vi.fn();
    render(
      <div onClick={closeParentModal}>
        <NovaCategoriaClienteModal {...modalProps} />
      </div>,
    );

    fireEvent.click(screen.getByPlaceholderText('Ex: Holding Familiar'));

    expect(closeParentModal).not.toHaveBeenCalled();
    expect(modalProps.onCancel).not.toHaveBeenCalled();
  });
});
