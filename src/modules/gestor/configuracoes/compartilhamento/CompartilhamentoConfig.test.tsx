/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
  saveConfiguration: vi.fn(),
}));

vi.mock('../../documentos/services/documentShareService', () => ({
  documentShareService: {
    getConfiguracaoCompartilhamento: mocks.getConfiguration,
    list: mocks.list,
    revoke: mocks.revoke,
    saveConfiguracaoCompartilhamento: mocks.saveConfiguration,
  },
  SHARE_EXPIRATION_OPTIONS: ['1 hora', '3 horas', '12 horas'],
  getShareExpirationMinutes: vi.fn(() => 180),
}));

import { CompartilhamentoConfig } from './CompartilhamentoConfig';

const configuration = {
  tempoPadrao: '3 horas',
  tempoPadraoMinutos: 180,
  limitarTipos: ['dre'],
  exigirSenhaPadrao: true,
  prazosExigemSenha: ['12 horas'],
};

const activeLink = {
  id: 'linha-share',
  shareGroupId: 'grupo-share',
  documento: 'balanco-real.pdf',
  empresa: 'Escritório Real',
  geradoPor: 'Pessoa Responsável',
  dataGeracao: '26/08/2026 10:00',
  tempoLimite: '3 horas',
  dataExpiracao: '26/08/2026 13:00',
  link: 'https://arkhen.vercel.app/s/grupo-share',
  status: 'Ativo' as const,
};

describe('CompartilhamentoConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfiguration.mockResolvedValue(configuration);
    mocks.list.mockResolvedValue([activeLink]);
    mocks.revoke.mockResolvedValue(true);
    mocks.saveConfiguration.mockResolvedValue(configuration);
  });

  afterEach(cleanup);

  it('expõe falha de listagem e permite repetir sem exibir estado vazio', async () => {
    mocks.list
      .mockRejectedValueOnce(new Error('Falha ao carregar compartilhamentos.'))
      .mockResolvedValueOnce([activeLink]);

    render(<CompartilhamentoConfig />);
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao carregar compartilhamentos.');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('preserva o link ativo e mostra erro quando a revogação falha', async () => {
    mocks.revoke.mockRejectedValue(new Error(
      'Não foi possível revogar o compartilhamento. O link continua ativo.',
    ));

    render(<CompartilhamentoConfig />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Links & Senhas Gerados/i }));
    expect(await screen.findByText('balanco-real.pdf')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Revogar link'));

    const modal = screen.getByText(/downloads já autorizados.*5 minutos/i).parentElement;
    fireEvent.click(within(modal as HTMLElement).getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('link continua ativo'));
    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
    expect(mocks.revoke).toHaveBeenCalledWith('grupo-share');
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
