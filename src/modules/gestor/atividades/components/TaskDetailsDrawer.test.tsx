/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  notas: '',
};

describe('TaskDetailsDrawer', () => {
  it('exige justificativa e a envia ao concluir a última etapa', () => {
    const toggleChecklist = vi.fn();
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

    expect(toggleChecklist).toHaveBeenCalledWith(
      tarefa.id,
      0,
      true,
      undefined,
      'Documentos e protocolo conferidos.',
    );
  });
});
