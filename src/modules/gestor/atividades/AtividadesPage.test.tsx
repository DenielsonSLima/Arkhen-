/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAtividades: vi.fn(),
  useAtividadesRealtime: vi.fn(),
  useAtividadesPodeGerenciar: vi.fn(),
}));

vi.mock('./hooks/useAtividades', () => ({ useAtividades: mocks.useAtividades }));
vi.mock('./hooks/useAtividadesRealtime', () => ({
  useAtividadesRealtime: mocks.useAtividadesRealtime,
}));
vi.mock('./hooks/useAtividadesWorkspace', () => ({
  useAtividadesPodeGerenciar: mocks.useAtividadesPodeGerenciar,
}));

vi.mock('./components/MinhaFilaAtividades', () => ({
  MinhaFilaAtividades: () => <div>Minha fila canônica</div>,
}));
vi.mock('./components/AbaGerirEquipe', () => ({
  AbaGerirEquipe: () => <div>Equipe legada</div>,
}));
vi.mock('./components/AbaRotinas', () => ({
  AbaRotinas: () => <div>Rotinas</div>,
}));
vi.mock('./por-empresa/AtividadesPorEmpresa', () => ({
  AtividadesPorEmpresa: () => <div>Fechamentos</div>,
}));
vi.mock('./components/AtividadeDetailView', () => ({
  AtividadeDetailView: () => <div>Detalhes</div>,
}));
vi.mock('./components/AtividadesControle', () => ({
  AtividadesControle: () => <div>Painel</div>,
}));

import { AtividadesPage } from './AtividadesPage';

const legacyState = {
  globalFilter: 'todas' as const,
  setGlobalFilter: vi.fn(),
  companyGroups: [],
  isLoading: false,
  selectedGroup: null,
  setSelectedGroup: vi.fn(),
  fechamentoMeta: { finalizado: false, dataHora: '', usuario: '' },
  handleSaveFechamentoMeta: vi.fn(),
  handleToggleStep: vi.fn(),
  handleSaveStepDate: vi.fn(),
  handleSaveTaxValores: vi.fn(),
  metrics: { total: 0, completed: 0, inProgress: 0, pending: 0 },
  refresh: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAtividadesPodeGerenciar.mockReturnValue({ data: true });
  mocks.useAtividades.mockReturnValue(legacyState);
});

afterEach(cleanup);

describe('AtividadesPage', () => {
  it('não carrega nem materializa o fluxo legado ao abrir Minha Fila', () => {
    render(<AtividadesPage view="minha-fila" />);

    expect(screen.getByText('Minha fila canônica')).toBeTruthy();
    expect(mocks.useAtividades).not.toHaveBeenCalled();
    expect(mocks.useAtividadesRealtime).toHaveBeenCalledWith(true);
  });

  it('isola o hook legado apenas na visão que ainda o utiliza', () => {
    render(<AtividadesPage view="equipe" />);

    expect(screen.getByText('Equipe legada')).toBeTruthy();
    expect(mocks.useAtividades).toHaveBeenCalledTimes(1);
    expect(mocks.useAtividadesRealtime).toHaveBeenCalledWith(true, legacyState.refresh);
  });
});
