/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RotinaFormDrawer } from './RotinaFormDrawer';

const company = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Empresa Alfa',
  cnpj: '12.345.678/0001-90',
  regime: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  modelosAtivos: [],
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('RotinaFormDrawer', () => {
  it('renderiza o formulário em um portal global e restaura a rolagem ao fechar', () => {
    const onClose = vi.fn();
    document.body.style.overflow = 'auto';

    const view = render(
      <RotinaFormDrawer
        company={company}
        modelos={[]}
        usuarios={[]}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Nova rotina recorrente' });
    expect(dialog.classList.contains('rotinas-drawer--fullscreen')).toBe(true);
    expect(dialog.parentElement?.classList.contains('rotinas-drawer-backdrop')).toBe(true);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.querySelector('.rotinas-drawer__header-inner')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    view.unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});
