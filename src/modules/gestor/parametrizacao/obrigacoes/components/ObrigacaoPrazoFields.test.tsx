/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyObrigacao } from '../obrigacoes.types';
import { ObrigacaoPrazoFields } from './ObrigacaoPrazoFields';

afterEach(cleanup);

describe('ObrigacaoPrazoFields', () => {
  it('não solicita campo adicional para a execução diária', () => {
    render(
      <ObrigacaoPrazoFields
        draft={{ ...createEmptyObrigacao(), periodicidade: 'diaria' }}
        isSaving={false}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByText(/executada todos os dias/i)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('captura uma data ISO para a execução única', () => {
    const onPatch = vi.fn();
    render(
      <ObrigacaoPrazoFields
        draft={{ ...createEmptyObrigacao(), periodicidade: 'unica' }}
        isSaving={false}
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Data da ocorrência/), {
      target: { value: '2026-09-18' },
    });
    expect(onPatch).toHaveBeenCalledWith({ dataVencimento: '2026-09-18' });
  });

  it('mantém a data da ocorrência única visível sem prazo fiscal', () => {
    render(
      <ObrigacaoPrazoFields
        draft={{ ...createEmptyObrigacao(), periodicidade: 'unica', temVencimento: false }}
        isSaving={false}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Data da ocorrência/)).toBeTruthy();
    expect(screen.getByText(/mesmo sem prazo fiscal/i)).toBeTruthy();
  });

  it('captura o dia ISO da semana para a execução semanal', () => {
    const onPatch = vi.fn();
    render(
      <ObrigacaoPrazoFields
        draft={{ ...createEmptyObrigacao(), periodicidade: 'semanal', temVencimento: false }}
        isSaving={false}
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Dia da execução/), { target: { value: '5' } });
    expect(onPatch).toHaveBeenCalledWith({ diaSemana: 5 });
    expect(screen.getByRole('option', { name: 'Domingo' })).toBeTruthy();
  });

  it('exibe mês e dia para a execução anual', () => {
    render(
      <ObrigacaoPrazoFields
        draft={{ ...createEmptyObrigacao(), periodicidade: 'anual', temVencimento: false }}
        isSaving={false}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Mês da ocorrência/)).toBeTruthy();
    expect(screen.getByLabelText(/Dia da ocorrência/)).toBeTruthy();
  });
});
