/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NovaCategoriaClienteModal } from './NovaCategoriaClienteModal';

afterEach(cleanup);

describe('NovaCategoriaClienteModal', () => {
  it('submits inside a portal without submitting the partner form behind it', () => {
    const onOuterSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onSubmit = vi.fn();

    render(
      <form onSubmit={onOuterSubmit}>
        <NovaCategoriaClienteModal
          nome="Clínica"
          descricao="Segmento de saúde"
          error=""
          onNomeChange={vi.fn()}
          onDescricaoChange={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={onSubmit}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('closes with Escape when it is not saving', () => {
    const onCancel = vi.fn();
    render(
      <NovaCategoriaClienteModal
        nome=""
        descricao=""
        error=""
        onNomeChange={vi.fn()}
        onDescricaoChange={vi.fn()}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps focus inside while saving and returns it only when the modal closes', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const props = {
      nome: 'Clínica',
      descricao: '',
      error: '',
      onNomeChange: vi.fn(),
      onDescricaoChange: vi.fn(),
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    };
    const view = render(<NovaCategoriaClienteModal {...props} />);

    expect(document.activeElement).toBe(screen.getByLabelText('Nome *'));
    view.rerender(<NovaCategoriaClienteModal {...props} isSaving />);

    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(dialog);

    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
