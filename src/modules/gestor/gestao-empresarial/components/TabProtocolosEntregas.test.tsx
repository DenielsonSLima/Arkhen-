/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  company: null as any,
  value: null as any,
}));
const tabsMock = vi.hoisted(() => ({ openTab: vi.fn() }));

vi.mock('../../../../hooks/useInternalTabs', () => ({
  useInternalTabs: () => tabsMock,
}));

vi.mock('../../protocolos/hooks/useEmpresaProtocolosConfiguracao', () => ({
  useEmpresaProtocolosConfiguracao: (company: any) => {
    hookMock.company = company;
    return hookMock.value;
  },
}));

import { TabProtocolosEntregas } from './TabProtocolosEntregas';
import { ProtocolosError } from '../../protocolos/services/protocolosError';

const company = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Cliente Novo',
  razaoSocial: 'Cliente Novo Ltda',
  cnpj: '11.111.111/0001-11',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  status: 'Ativa',
  email: 'matriz@example.com',
  telefone: '82999999999',
  endereco: 'Rua da Matriz',
  funcionariosCount: 0,
  funcionarios: [],
  ferias: [],
  documentos: [],
  polos: [],
} as any;

const dctfweb = {
  id: 'dctfweb',
  nome: 'DCTFWeb',
  categoria: 'Fiscal',
  orgao: 'Receita Federal',
  diaLimite: 25,
  temVencimento: false,
  etapas: ['Conferir dados', 'Transmitir obrigação'],
  descricao: 'Obrigação fiscal',
  status: 'Ativo',
  regimes: ['Simples Nacional'],
  periodicidadePadrao: 'mensal',
  origemPadrao: 'Ambos',
} as const;

const catalogo = [dctfweb];
const initialConfigs = [{ entregaId: 'dctfweb', ativo: false, periodicidade: 'mensal' }];
const canonicalConfigs = [{ entregaId: 'dctfweb', ativo: true, periodicidade: 'trimestral' }];
const initialUpdatedAt = '2026-08-31T20:00:00.000Z';
const canonicalUpdatedAt = '2026-08-31T20:01:00.000Z';

const makeHookValue = () => ({
  data: { catalogo, configs: initialConfigs, updatedAt: initialUpdatedAt },
  error: null,
  isLoading: false,
  isSaving: false,
  saveError: null,
  refetch: vi.fn(),
  saveConfiguracao: vi.fn().mockResolvedValue({
    catalogo,
    configs: canonicalConfigs,
    updatedAt: canonicalUpdatedAt,
  }),
  resetSaveError: vi.fn(),
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('TabProtocolosEntregas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookMock.company = null;
    hookMock.value = makeHookValue();
  });

  it('parte do estado vazio e salva a seleção explícita com a versão CAS carregada', async () => {
    render(<TabProtocolosEntregas company={company} />);

    expect(screen.getByText('Nenhuma obrigação selecionada')).toBeTruthy();
    expect(screen.queryByText('DCTFWeb')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar obrigações/i }).at(-1)!);

    expect(screen.getByRole('dialog', { name: 'Selecionar obrigações' })).toBeTruthy();
    const checkbox = screen.getByRole('checkbox', { name: /dctfweb/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /salvar seleção/i }));

    await waitFor(() => {
      expect(hookMock.value.saveConfiguracao).toHaveBeenCalledWith(
        [expect.objectContaining({ entregaId: 'dctfweb', ativo: true, periodicidade: 'mensal' })],
        initialUpdatedAt,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('DCTFWeb')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /editar obrigações/i })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Obrigações sincronizadas');
  });

  it('não exibe nem permite selecionar obrigações inativas do catálogo', () => {
    const inativa = {
      ...dctfweb,
      id: 'sped-inativo',
      nome: 'SPED inativo',
      status: 'Inativo',
    };
    hookMock.value = {
      ...hookMock.value,
      data: {
        catalogo: [dctfweb, inativa],
        configs: [
          { ...initialConfigs[0], ativo: true },
          { entregaId: inativa.id, ativo: true, periodicidade: 'mensal' },
        ],
        updatedAt: initialUpdatedAt,
      },
    };

    render(<TabProtocolosEntregas company={company} />);

    expect(screen.getByText('DCTFWeb')).toBeTruthy();
    expect(screen.queryByText('SPED inativo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /editar obrigações/i }));
    expect(screen.getByRole('checkbox', { name: /dctfweb/i })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /sped inativo/i })).toBeNull();
    expect(screen.getByText(/obrigação selecionada/).parentElement?.textContent).toContain('1 obrigação selecionada');
  });

  it('usa o id real da filial para carregar, salvar e abrir as rotinas da unidade', async () => {
    const filialId = '22222222-2222-4222-8222-222222222222';
    const companyWithBranch = {
      ...company,
      polos: [{
        id: filialId,
        companyId: company.id,
        nome: 'Filial Centro',
        cnpj: '11.111.111/0002-00',
        email: 'filial@example.com',
        telefone: '82888888888',
        endereco: 'Rua da Filial',
        cidade: 'Maceió',
        uf: 'AL',
        ativo: true,
      }],
    };
    render(<TabProtocolosEntregas company={companyWithBranch} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Unidade configurada' }), {
      target: { value: filialId },
    });

    await waitFor(() => {
      expect(hookMock.company.id).toBe(filialId);
      expect(hookMock.company.nome).toBe('Filial Centro');
      expect(hookMock.company.tipoEstabelecimento).toBe('Filial');
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir rotinas/i }));
    expect(tabsMock.openTab).toHaveBeenCalledWith(
      'atividades-modelos',
      'Rotinas',
      'Repeat',
      { data: { selectedCompanyId: filialId } },
    );

    fireEvent.click(screen.getAllByRole('button', { name: /adicionar obrigações/i }).at(-1)!);
    fireEvent.click(screen.getByRole('checkbox', { name: /dctfweb/i }));
    fireEvent.click(screen.getByRole('button', { name: /salvar seleção/i }));
    await waitFor(() => expect(hookMock.value.saveConfiguracao).toHaveBeenCalled());
    expect(hookMock.company.id).toBe(filialId);
  });

  it('mantém a versão CAS congelada enquanto o modal está sendo editado', async () => {
    const view = render(<TabProtocolosEntregas company={company} />);
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar obrigações/i }).at(-1)!);
    fireEvent.click(screen.getByRole('checkbox', { name: /dctfweb/i }));

    const spedFiscal = { ...dctfweb, id: 'sped-fiscal', nome: 'SPED Fiscal' };
    hookMock.value = {
      ...hookMock.value,
      data: {
        catalogo: [dctfweb, spedFiscal],
        configs: [
          ...initialConfigs,
          { entregaId: spedFiscal.id, ativo: false, periodicidade: 'mensal' },
        ],
        updatedAt: '2026-08-31T20:00:30.000Z',
      },
    };
    view.rerender(<TabProtocolosEntregas company={company} />);

    expect(await screen.findByRole('checkbox', { name: /sped fiscal/i })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /dctfweb/i }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /salvar seleção/i }));

    await waitFor(() => expect(hookMock.value.saveConfiguracao).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entregaId: 'dctfweb', ativo: true }),
        expect.objectContaining({ entregaId: 'sped-fiscal', ativo: false }),
      ]),
      initialUpdatedAt,
    ));
  });

  it('recarrega a versão canônica depois de um conflito de gravação', async () => {
    hookMock.value.saveConfiguracao = vi.fn().mockRejectedValue(
      new ProtocolosError('conflict', 'Configuração alterada por outro usuário.'),
    );
    hookMock.value.refetch = vi.fn().mockResolvedValue({
      data: { catalogo, configs: canonicalConfigs, updatedAt: canonicalUpdatedAt },
      error: null,
    });

    render(<TabProtocolosEntregas company={company} />);
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar obrigações/i }).at(-1)!);
    fireEvent.click(screen.getByRole('checkbox', { name: /dctfweb/i }));
    fireEvent.click(screen.getByRole('button', { name: /salvar seleção/i }));
    fireEvent.click(await screen.findByRole('button', { name: /recarregar configuração/i }));

    await waitFor(() => {
      expect(hookMock.value.refetch).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('DCTFWeb')).toBeTruthy();
    });
  });

  it('exibe falha de carregamento sem fallback local e permite tentar novamente', () => {
    hookMock.value = {
      ...hookMock.value,
      data: undefined,
      error: new Error('Configuração indisponível.'),
    };

    render(<TabProtocolosEntregas company={company} />);

    expect(screen.getByRole('alert').textContent).toContain('Configuração indisponível.');
    expect(screen.queryByText('DCTFWeb')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(hookMock.value.refetch).toHaveBeenCalledOnce();
  });
});
