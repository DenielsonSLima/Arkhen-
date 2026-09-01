/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditHookMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useTarefaChecklistAudit', () => ({
  useTarefaChecklistAudit: auditHookMock,
}));

import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import type { TarefaGestor } from '../services/rotinasAtividadesService';

const tarefa: TarefaGestor = {
  id: '77777777-7777-4777-8777-777777777777',
  titulo: 'Folha de pagamento',
  categoria: 'Cliente',
  frequencia: 'Mensal',
  responsavel: 'Ana',
  cliente: 'Empresa Alfa',
  vencimento: '2026-09-25',
  prioridade: 'Média',
  status: 'Pendente',
  origem: 'Rotina',
  checklist: [{ titulo: 'Conferir folha', concluida: false }],
  etapasTotal: 1,
  etapasConcluidas: 0,
  percentual: 0,
  notas: '',
};

afterEach(cleanup);

beforeEach(() => {
  auditHookMock.mockReturnValue({
    events: [],
    latestByStep: new Map(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('TaskDetailsDrawer', () => {
  it('exige justificativa e a envia ao concluir a última etapa', async () => {
    const toggleChecklist = vi.fn().mockResolvedValue({});
    render(
      <TaskDetailsDrawer
        selectedTask={tarefa}
        onClose={vi.fn()}
        updateTarefa={vi.fn()}
        toggleChecklist={toggleChecklist}
      />,
    );

    fireEvent.click(screen.getByLabelText('Conferir folha'));
    expect(screen.getByRole('alert').textContent).toContain('Informe a evidência ou justificativa');
    expect(toggleChecklist).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Ex.: documentos conferidos e protocolo validado.'), {
      target: { value: 'Documentos e protocolo conferidos.' },
    });
    fireEvent.click(screen.getByLabelText('Conferir folha'));

    await waitFor(() => {
      expect(toggleChecklist).toHaveBeenCalledWith(
        tarefa.id,
        0,
        true,
        undefined,
        'Documentos e protocolo conferidos.',
      );
    });
  });

  it('mostra data e horário persistidos da conclusão até os segundos', () => {
    render(
      <TaskDetailsDrawer
        selectedTask={{
          ...tarefa,
          status: 'Concluída',
          dataHoraConclusao: '2026-09-01T12:53:05',
          checklist: [{ titulo: 'Conferir folha', concluida: true }],
          etapasConcluidas: 1,
          percentual: 100,
        }}
        onClose={vi.fn()}
        updateTarefa={vi.fn()}
        toggleChecklist={vi.fn()}
      />,
    );

    const completionTime = screen.getByText('01/09/2026 às 12:53:05');
    expect(completionTime.tagName).toBe('TIME');
    expect(completionTime.getAttribute('datetime')).toBe('2026-09-01T12:53:05');
  });

  it('mostra em cada etapa a conclusão autoritativa com ator e segundos', () => {
    auditHookMock.mockReturnValue({
      events: [],
      latestByStep: new Map([[0, {
        id: '88888888-8888-4888-8888-888888888888',
        taskId: tarefa.id,
        stepIndex: 0,
        completed: true,
        actorName: 'Ana Souza',
        createdAt: '2026-09-01T12:53:05',
      }]]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TaskDetailsDrawer
        selectedTask={{
          ...tarefa,
          status: 'Em andamento',
          checklist: [{ titulo: 'Conferir folha', concluida: true }],
          etapasConcluidas: 1,
          percentual: 100,
        }}
        onClose={vi.fn()}
        updateTarefa={vi.fn()}
        toggleChecklist={vi.fn()}
      />,
    );

    expect(screen.getByText((_, element) => (
      element?.textContent === 'Concluído em 01/09/2026 às 12:53:05 por Ana Souza'
    ))).toBeTruthy();
  });

  it.each(['Aguardando revisão', 'Cancelada'] as const)(
    'bloqueia observação e checklist quando está %s',
    (status) => {
      const updateTarefa = vi.fn().mockResolvedValue({});
      const toggleChecklist = vi.fn().mockResolvedValue({});
      render(
        <TaskDetailsDrawer
          selectedTask={{ ...tarefa, status }}
          onClose={vi.fn()}
          updateTarefa={updateTarefa}
          toggleChecklist={toggleChecklist}
        />,
      );

      const observation = screen.getByLabelText('Observações / bloqueio');
      const checklist = screen.getByLabelText('Conferir folha');
      expect(observation.hasAttribute('disabled')).toBe(true);
      expect(checklist.hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Salvar observação' }).hasAttribute('disabled'))
        .toBe(true);

      fireEvent.change(observation, { target: { value: 'Não deve salvar' } });
      fireEvent.click(checklist);
      expect(updateTarefa).not.toHaveBeenCalled();
      expect(toggleChecklist).not.toHaveBeenCalled();
    },
  );

  it('salva observação explicitamente e serializa cliques concorrentes', async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    const updateTarefa = vi.fn(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    render(
      <TaskDetailsDrawer
        selectedTask={tarefa}
        onClose={vi.fn()}
        updateTarefa={updateTarefa}
        toggleChecklist={vi.fn().mockResolvedValue({})}
      />,
    );

    fireEvent.change(screen.getByLabelText('Observações / bloqueio'), {
      target: { value: 'Documento pendente do cliente.' },
    });
    expect(updateTarefa).not.toHaveBeenCalled();

    const saveButton = screen.getByRole('button', { name: 'Salvar observação' });
    fireEvent.click(saveButton);
    expect(updateTarefa).toHaveBeenCalledTimes(1);
    expect(updateTarefa).toHaveBeenCalledWith(tarefa.id, {
      observacaoFalta: 'Documento pendente do cliente.',
    });
    expect(screen.getByRole('button', { name: 'Salvando...' }).hasAttribute('disabled'))
      .toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Salvando...' }));
    expect(updateTarefa).toHaveBeenCalledTimes(1);

    await act(async () => { resolveSave?.({}); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar observação' }).hasAttribute('disabled'))
        .toBe(true);
    });
  });

  it('mantém o rascunho e mostra o erro quando a observação falha', async () => {
    const updateTarefa = vi.fn().mockRejectedValue(new Error('Falha ao salvar observação.'));
    render(
      <TaskDetailsDrawer
        selectedTask={tarefa}
        onClose={vi.fn()}
        updateTarefa={updateTarefa}
        toggleChecklist={vi.fn().mockResolvedValue({})}
      />,
    );

    const observation = screen.getByLabelText('Observações / bloqueio');
    fireEvent.change(observation, { target: { value: 'Rascunho preservado.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar observação' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao salvar observação.');
    expect((observation as HTMLTextAreaElement).value).toBe('Rascunho preservado.');
    expect(screen.getByRole('button', { name: 'Salvar observação' }).hasAttribute('disabled'))
      .toBe(false);
  });

  it('mostra falha da RPC e bloqueia toggles paralelos do checklist', async () => {
    let rejectToggle: ((error: Error) => void) | undefined;
    const toggleChecklist = vi.fn(() => new Promise((_resolve, reject) => {
      rejectToggle = reject;
    }));
    render(
      <TaskDetailsDrawer
        selectedTask={{
          ...tarefa,
          status: 'Em andamento',
          checklist: [{ titulo: 'Conferir folha', concluida: true }],
          etapasConcluidas: 1,
          percentual: 100,
        }}
        onClose={vi.fn()}
        updateTarefa={vi.fn().mockResolvedValue({})}
        toggleChecklist={toggleChecklist}
      />,
    );

    const checkbox = screen.getByLabelText('Conferir folha');
    fireEvent.click(checkbox);
    expect(toggleChecklist).toHaveBeenCalledTimes(1);
    expect(checkbox.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Salvando alteração');
    fireEvent.click(checkbox);
    expect(toggleChecklist).toHaveBeenCalledTimes(1);

    await act(async () => { rejectToggle?.(new Error('Falha ao persistir checklist.')); });
    expect((await screen.findByRole('alert')).textContent)
      .toContain('Falha ao persistir checklist.');
  });

  it('expõe semântica modal, Escape, foco e bloqueio de rolagem', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Abrir detalhes';
    document.body.appendChild(opener);
    opener.focus();
    const previousOverflow = document.body.style.overflow;
    const onClose = vi.fn();
    const { unmount } = render(
      <TaskDetailsDrawer
        selectedTask={tarefa}
        onClose={onClose}
        updateTarefa={vi.fn().mockResolvedValue({})}
        toggleChecklist={vi.fn().mockResolvedValue({})}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: tarefa.titulo });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    const closeButton = screen.getByRole('button', { name: 'Fechar Detalhes' });
    const lastCheckbox = screen.getByLabelText('Conferir folha');
    expect(closeButton).toBe(document.activeElement);

    lastCheckbox.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastCheckbox).toBe(document.activeElement);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
