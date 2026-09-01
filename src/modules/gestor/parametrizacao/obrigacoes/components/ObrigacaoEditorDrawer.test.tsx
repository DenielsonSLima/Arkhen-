/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyObrigacao, type ObrigacaoModeloDraft } from '../obrigacoes.types';
import { ObrigacaoEditorDrawer } from './ObrigacaoEditorDrawer';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});
const validDraft = (): ObrigacaoModeloDraft => ({
  ...createEmptyObrigacao(),
  nome: 'Obrigação operacional',
  etapas: ['Executar conferência'],
});

describe('ObrigacaoEditorDrawer agenda operacional', () => {
  it.each([
    [
      { periodicidade: 'unica' as const, dataVencimento: '' },
      'Informe uma data de ocorrência válida para a obrigação única.',
    ],
    [
      { periodicidade: 'semanal' as const, diaSemana: undefined },
      'Selecione um dia de execução válido para a obrigação semanal.',
    ],
    [
      { periodicidade: 'anual' as const, mesVencimento: undefined },
      'Informe um mês e um dia de ocorrência válidos para a obrigação anual.',
    ],
  ])('exige a agenda de %s mesmo sem prazo fiscal', (updates, expectedMessage) => {
    const onSave = vi.fn();
    render(
      <ObrigacaoEditorDrawer
        initialValue={{ ...validDraft(), ...updates, temVencimento: false }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar obrigação' }));

    expect(screen.getByRole('alert').textContent).toBe(expectedMessage);
    expect(onSave).not.toHaveBeenCalled();
  });
});
