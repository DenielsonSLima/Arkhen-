/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import { ResumoAuditoriaTab } from './ResumoAuditoriaTab';

const selectedGroup: CompanyActivityGroup = {
  id: 'cliente-1-08-2026',
  clienteId: '00000000-0000-4000-8000-000000000001',
  clienteNome: 'Empresa Teste',
  cnpj: '00.000.000/0001-00',
  regime: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  competencia: '08/2026',
  responsavel: '',
  atividades: [],
  progressoGeral: 0,
  statusGeral: 'Pendente',
};

type SaveAudit = (meta: { finalizado: boolean; dataHora: string; usuario: string }) => Promise<void>;

const renderTab = (save: SaveAudit) => render(
  <ResumoAuditoriaTab
    selectedGroup={selectedGroup}
    competencia="08/2026"
    fechamentoMeta={{ finalizado: false, dataHora: '', usuario: '' }}
    handleSaveFechamentoMeta={save}
    getActivityIcon={() => null}
    onSelectTab={vi.fn()}
  />,
);

afterEach(cleanup);

describe('ResumoAuditoriaTab', () => {
  it('mostra identidade e horário como dados derivados do servidor', () => {
    renderTab(vi.fn().mockResolvedValue(undefined));

    expect(screen.getByLabelText('Data e hora registradas pelo servidor').textContent)
      .toContain('Será registrada automaticamente ao salvar');
    expect(screen.getByLabelText('Usuário registrado pelo servidor').textContent)
      .toContain('Será identificado automaticamente ao salvar');
    expect(screen.queryByPlaceholderText('Responsável pelo fechamento')).toBeNull();
  });

  it('só confirma sucesso depois que a escrita termina', async () => {
    let resolveSave: (() => void) | undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    renderTab(save);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Auditoria Contábil' }));

    expect((screen.getByRole('button', { name: 'Salvando...' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Dados de auditoria salvos com sucesso!')).toBeNull();
    resolveSave?.();

    await waitFor(() => {
      expect(screen.getByText('Dados de auditoria salvos com sucesso!')).not.toBeNull();
    });
    expect(save).toHaveBeenCalledWith({ finalizado: true, dataHora: '', usuario: '' });
  });

  it('exibe o erro real e não mostra sucesso quando a RPC falha', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Sem permissão para homologar fechamento'));
    renderTab(save);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Auditoria Contábil' }));

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Sem permissão para homologar fechamento');
    expect(screen.queryByText('Dados de auditoria salvos com sucesso!')).toBeNull();
  });
});
