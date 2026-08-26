/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  revoke: vi.fn(),
  renew: vi.fn(),
}));

vi.mock('../services/documentShareService', () => ({
  documentShareService: {
    list: mocks.list,
    revoke: mocks.revoke,
    renew: mocks.renew,
    getConfiguracaoCompartilhamento: vi.fn(),
  },
  SHARE_EXPIRATION_OPTIONS: ['1 hora'],
  formatShareDateTime: vi.fn(() => '26/08/2026 12:00'),
  generateSharePassword: vi.fn(() => 'senha-segura'),
  isSharePasswordRequired: vi.fn(() => false),
  parseShareDurationMs: vi.fn(() => 3_600_000),
}));

import { SharedDocumentsTab } from './SharedDocumentsTab';

const activeLink = {
  id: 'linha-share',
  shareGroupId: 'grupo-share',
  documentId: 'documento-real',
  documento: 'balanco-real.pdf',
  empresa: 'Escritório Real',
  geradoPor: 'Pessoa Responsável',
  dataGeracao: '26/08/2026 10:00',
  dataGeracaoIso: '2026-08-26T13:00:00.000Z',
  tempoLimite: '1 hora',
  dataExpiracao: '26/08/2026 11:00',
  dataExpiracaoIso: '2099-08-26T14:00:00.000Z',
  link: 'https://arkhen.vercel.app/s/grupo-share',
  status: 'Ativo' as const,
};

describe('SharedDocumentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([activeLink]);
    mocks.revoke.mockResolvedValue(true);
    mocks.renew.mockResolvedValue(true);
  });

  afterEach(cleanup);

  it('distingue erro de carregamento de estado vazio e permite tentar novamente', async () => {
    mocks.list
      .mockRejectedValueOnce(new Error('Falha ao consultar os links.'))
      .mockResolvedValueOnce([activeLink]);

    render(<SharedDocumentsTab refreshKey={0} />);

    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao consultar os links.');
    expect(screen.queryByText('Nenhum arquivo compartilhado')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('balanco-real.pdf')).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('mantém o link ativo e comunica a falha quando a revogação não persiste', async () => {
    const onNotify = vi.fn();
    mocks.revoke.mockRejectedValue(new Error(
      'Não foi possível revogar o compartilhamento. O link continua ativo.',
    ));

    render(<SharedDocumentsTab refreshKey={0} onNotify={onNotify} />);
    await screen.findByText('balanco-real.pdf');
    fireEvent.click(screen.getByTitle('Revogar'));

    const modal = screen.getByText(/downloads já autorizados.*5 minutos/i).parentElement;
    expect(modal).toBeTruthy();
    fireEvent.click(within(modal as HTMLElement).getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(
      expect.stringContaining('link continua ativo'),
    ));
    expect(screen.getByRole('alert').textContent).toContain('link continua ativo');
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(onNotify).not.toHaveBeenCalledWith(expect.stringContaining('salva localmente'));
  });

  it('revalida a lista depois de uma revogação confirmada', async () => {
    const expiredLink = { ...activeLink, status: 'Expirado' as const };
    mocks.list
      .mockResolvedValueOnce([activeLink])
      .mockResolvedValueOnce([expiredLink]);

    render(<SharedDocumentsTab refreshKey={0} />);
    await screen.findByText('balanco-real.pdf');
    fireEvent.click(screen.getByTitle('Revogar'));
    const modal = screen.getByText(/downloads já autorizados.*5 minutos/i).parentElement;
    fireEvent.click(within(modal as HTMLElement).getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.revoke).toHaveBeenCalledWith('grupo-share');
  });
});
