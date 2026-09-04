/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditHookMock = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useTarefaChecklistAudit', () => ({
  useTarefaChecklistAudit: auditHookMock,
}));

import type { TarefaGestor } from '../../services/rotinasAtividadesService';
import { TaskInspector } from './TaskInspector';

const task: TarefaGestor = {
  id: '77777777-7777-4777-8777-777777777777',
  titulo: 'Pró-Labore',
  categoria: 'Folha',
  frequencia: 'Mensal',
  responsavel: 'Ana',
  cliente: 'Empresa Alfa',
  vencimento: '2026-09-21',
  prioridade: 'Média',
  status: 'Em andamento',
  origem: 'Rotina',
  checklist: [
    { titulo: 'Enviar ao cliente', concluida: false },
    { titulo: 'Calcular retirada e INSS', concluida: true },
  ],
  notas: '',
};

afterEach(cleanup);

beforeEach(() => {
  auditHookMock.mockReturnValue({
    events: [],
    latestByStep: new Map([[1, {
      id: '88888888-8888-4888-8888-888888888888',
      taskId: task.id,
      stepIndex: 1,
      completed: true,
      actorName: 'Ana',
      createdAt: '2026-09-04T14:35:27',
    }]]),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('TaskInspector', () => {
  it('mostra a data e a hora persistidas em cada item feito', () => {
    render(
      <TaskInspector
        filteredTasks={[task]}
        requestArchive={vi.fn()}
        selectedTask={task}
        setSelectedTaskId={vi.fn()}
        toggleChecklist={vi.fn()}
        updateTarefa={vi.fn()}
      />,
    );

    const completionTime = screen.getByText('04/09/2026 às 14:35:27');
    expect(completionTime.tagName).toBe('TIME');
    expect(completionTime.getAttribute('datetime')).toBe('2026-09-04T14:35:27');
    expect(completionTime.parentElement?.textContent).toBe('Feito em 04/09/2026 às 14:35:27');
  });

  it('empilha as anotações e a pendência em uma única coluna', () => {
    render(
      <TaskInspector
        filteredTasks={[task]}
        requestArchive={vi.fn()}
        selectedTask={task}
        setSelectedTaskId={vi.fn()}
        toggleChecklist={vi.fn()}
        updateTarefa={vi.fn()}
      />,
    );

    const notes = screen.getByLabelText('Anotações do andamento');
    const issue = screen.getByLabelText('Pendência / motivo de falta');
    const notesGrid = notes.closest('div');

    expect(notesGrid).toBe(issue.closest('div'));
    expect(notesGrid?.style.gridTemplateColumns).toBe('1fr');
    expect(notes.style.width).toBe('100%');
    expect(issue.style.width).toBe('100%');
  });
});
