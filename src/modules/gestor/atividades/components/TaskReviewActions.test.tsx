/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TarefaGestor } from '../services/rotinasAtividadesService';
import { TaskReviewActions } from './TaskReviewActions';

const task = (status: TarefaGestor['status']): TarefaGestor => ({
  id: 'task-1', titulo: 'Revisar obrigação', categoria: 'Fiscal', frequencia: 'Única',
  responsavel: 'Ana', responsavelUserId: 'executor-1', cliente: 'Cliente',
  vencimento: '2026-08-26', prioridade: 'Média', status, origem: 'Manual',
  checklist: [{ titulo: 'Transmitir', concluida: true }], notas: '',
  revisorUserId: 'reviewer-1', revisorNome: 'Bruno',
});

describe('TaskReviewActions', () => {
  it('permite que o revisor atribuído aprove e bloqueia rejeição sem motivo', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    render(<TaskReviewActions task={task('Aguardando revisão')} authUserId="reviewer-1"
      canManage={false} isSaving={false} onReview={onReview} onReopen={vi.fn()} />);

    expect((screen.getByRole('button', { name: 'Rejeitar e devolver' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar conclusão' }));
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('task-1', true, ''));
  });

  it('exige justificativa significativa para o gestor reabrir', () => {
    render(<TaskReviewActions task={task('Concluída')} authUserId="manager-1"
      canManage isSaving={false} onReview={vi.fn()} onReopen={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Reabrir tarefa' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Descreva por que/), {
      target: { value: 'Correção necessária' },
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
