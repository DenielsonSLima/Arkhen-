/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TarefaGestor } from '../../services/rotinasAtividadesService';
import { MinhaFilaTaskCard } from './MinhaFilaTaskCard';

afterEach(cleanup);

const tarefa: TarefaGestor = {
  id: '77777777-7777-4777-8777-777777777777',
  titulo: 'Folha de pagamento',
  categoria: 'Folha',
  frequencia: 'Mensal',
  responsavel: 'Ana',
  cliente: 'Empresa Alfa',
  vencimento: '2026-09-25',
  prioridade: 'Média',
  status: 'Em andamento',
  origem: 'Rotina',
  checklist: [
    { titulo: 'Primeira', concluida: true },
    { titulo: 'Segunda', concluida: true },
    { titulo: 'Terceira', concluida: true },
    { titulo: 'Quarta', concluida: false },
  ],
  etapasTotal: 4,
  etapasConcluidas: 3,
  percentual: 75,
  notas: '',
};

describe('MinhaFilaTaskCard', () => {
  it('mostra percentual e quantidade concluída sem abrir os detalhes', () => {
    const onOpen = vi.fn();
    render(
      <MinhaFilaTaskCard
        task={tarefa}
        isLate={false}
        isBlocked={false}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('3/4 concluídas')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '3 de 4 etapas concluídas',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Folha de pagamento' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('exibe a conclusão com segundos usando o valor persistido', () => {
    render(
      <MinhaFilaTaskCard
        task={{
          ...tarefa,
          status: 'Concluída',
          dataHoraConclusao: '2026-09-01T12:53:05',
          checklist: tarefa.checklist.map((item) => ({ ...item, concluida: true })),
          etapasConcluidas: 4,
          percentual: 100,
        }}
        isLate={false}
        isBlocked={false}
        onOpen={vi.fn()}
      />,
    );

    const completionTime = screen.getByText('01/09/2026 às 12:53:05');
    expect(completionTime.tagName).toBe('TIME');
    expect(completionTime.getAttribute('datetime')).toBe('2026-09-01T12:53:05');
  });

  it('não cria um horário local quando a conclusão não o possui', () => {
    render(
      <MinhaFilaTaskCard
        task={{ ...tarefa, status: 'Concluída' }}
        isLate={false}
        isBlocked={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Horário de conclusão não registrado')).toBeTruthy();
    expect(document.querySelector('time')).toBeNull();
  });

  it('nunca apresenta uma tarefa cancelada como atrasada', () => {
    const { container } = render(
      <MinhaFilaTaskCard
        task={{ ...tarefa, status: 'Cancelada', vencimento: '2026-01-01' }}
        isLate
        isBlocked={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText('Atrasada')).toBeNull();
    expect(container.querySelector('.minha-fila-task-card')?.classList.contains('is-cancelled'))
      .toBe(true);
    expect(container.querySelector('.minha-fila-task-card')?.classList.contains('is-late'))
      .toBe(false);
  });
});
