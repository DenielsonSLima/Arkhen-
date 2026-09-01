/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyObrigacao, type ObrigacaoModelo } from '../obrigacoes.types';
import { ObrigacaoCard } from './ObrigacaoCard';

afterEach(cleanup);

const makeObrigacao = (updates: Partial<ObrigacaoModelo>): ObrigacaoModelo => ({
  ...createEmptyObrigacao(),
  id: 'obrigacao-1',
  codigo: 'obrigacao-teste',
  ordem: 1,
  atualizadoEm: null,
  nome: 'Obrigação teste',
  etapas: ['Executar'],
  ...updates,
});

const renderCard = (updates: Partial<ObrigacaoModelo>) => render(
  <ObrigacaoCard
    obrigacao={makeObrigacao(updates)}
    onEdit={vi.fn()}
    onDuplicate={vi.fn()}
    onToggleStatus={vi.fn()}
  />,
);

describe('ObrigacaoCard agenda', () => {
  it.each([
    [{ periodicidade: 'diaria' as const }, 'Diário · execução diária'],
    [{ periodicidade: 'unica' as const, dataVencimento: '2026-09-15' }, 'Único · ocorrência em 15/09/2026'],
    [{ periodicidade: 'semanal' as const, diaSemana: 5 }, 'Semanal · execução na Sexta-feira'],
    [{ periodicidade: 'anual' as const, mesVencimento: 12, diaVencimento: 31 }, 'Anual · ocorrência em 31 de dezembro'],
  ])('descreve a periodicidade com seus campos específicos', (updates, label) => {
    renderCard(updates);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('prioriza a indicação sem vencimento e mantém a agenda fora da visualização', () => {
    renderCard({ periodicidade: 'mensal', diaVencimento: 31, temVencimento: false });
    expect(screen.getByText('Mensal · sem vencimento fixo')).toBeTruthy();
    expect(screen.queryByText('Mensal · vence dia 31')).toBeNull();
  });

  it('preserva a ocorrência única no card mesmo sem prazo fiscal', () => {
    renderCard({ periodicidade: 'unica', dataVencimento: '2026-09-15', temVencimento: false });
    expect(screen.getByText('Único · ocorrência em 15/09/2026 · sem prazo fiscal')).toBeTruthy();
  });
});
