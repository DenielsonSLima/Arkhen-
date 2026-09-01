/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceHook = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAtividadesWorkspace', () => ({
  useAtividadesWorkspace: workspaceHook,
}));

vi.mock('./ModalNovaTarefa', () => ({
  ModalNovaTarefa: ({ onSalvar }: { onSalvar: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onSalvar({
        titulo: 'Tarefa teste',
        categoria: 'Interna',
        vencimento: '2026-09-01',
        prioridade: 'Média',
        checklist: [],
        notas: '',
      })}
    >
      Salvar tarefa simulada
    </button>
  ),
}));

vi.mock('./TaskDetailsDrawer', () => ({ TaskDetailsDrawer: () => null }));
vi.mock('./minha-fila/MinhaFilaTaskCard', () => ({ MinhaFilaTaskCard: () => null }));

import { MinhaFilaAtividades } from './MinhaFilaAtividades';

const saveTarefaAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  saveTarefaAsync.mockResolvedValue(undefined);
  workspaceHook.mockReturnValue({
    tarefas: [],
    usuarioAtual: {
      configUsuarioId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      nome: 'Pessoa usuária',
    },
    updateTarefaAsync: vi.fn(),
    saveTarefaAsync,
    toggleChecklistAsync: vi.fn(),
  });
});

afterEach(cleanup);

describe('MinhaFilaAtividades accessibility', () => {
  it('expõe estado dos filtros e nomes acessíveis nos controles', () => {
    render(<MinhaFilaAtividades />);

    const hoje = screen.getByRole('button', { name: /Hoje 0/ });
    const semana = screen.getByRole('button', { name: /Semana 0/ });
    expect(hoje.getAttribute('aria-pressed')).toBe('true');
    expect(semana.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(semana);
    expect(hoje.getAttribute('aria-pressed')).toBe('false');
    expect(semana.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Buscar tarefas')).toBeTruthy();
    expect(screen.getByLabelText('Período anterior')).toBeTruthy();
    expect(screen.getByLabelText('Próximo período')).toBeTruthy();
    expect(screen.getByLabelText('Selecionar data de referência')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar tarefas'), { target: { value: 'folha' } });
    expect(screen.getByLabelText('Limpar busca')).toBeTruthy();
  });

  it('anuncia o feedback de sucesso em uma live region', async () => {
    render(<MinhaFilaAtividades />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa simulada' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(
      'Tarefa criada com sucesso.',
    ));
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});
