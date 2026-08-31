/** @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientBranch,
  Company,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useCompanyLibraryWorkspace } from './useCompanyLibraryWorkspace';

type WorkspaceOptions = Parameters<typeof useCompanyLibraryWorkspace>[0];

const makeBranch = (overrides: Partial<ClientBranch> = {}): ClientBranch => ({
  id: 'branch-active',
  companyId: 'company-1',
  nome: 'Unidade Centro',
  cnpj: '32.833.113/0002-45',
  email: '',
  telefone: '',
  cidade: 'Aracaju',
  uf: 'SE',
  ativo: true,
  documentFolderPath: 'Filiais/Unidade Centro',
  ...overrides,
});

const makeCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 'company-1',
  nome: 'Casa do Fazendeiro',
  razaoSocial: 'Casa do Fazendeiro LTDA',
  cnpj: '32.833.113/0001-64',
  tipo: 'Lucro Real',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  polos: [makeBranch()],
  pastasDocumentos: ['Filiais/Unidade Centro'],
  ...overrides,
});

const branchEntryKey = 'company:company-1:branch:branch-active';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCompanyLibraryWorkspace', () => {
  it('restaura a filial indicada pela entry key mesmo quando também recebe o id da matriz', async () => {
    const onFolderChange = vi.fn();
    const onCompanyChange = vi.fn();
    const { result } = renderHook(() => useCompanyLibraryWorkspace({
      companies: [makeCompany()],
      statusFilter: 'Ativa',
      initialSelectedCompanyId: 'company-1',
      initialSelectedEntryKey: branchEntryKey,
      selectedFolder: 'Filiais/Unidade Centro',
      onFolderChange,
      onCompanyChange,
    }));

    expect(result.current.selectedEntryKey).toBe(branchEntryKey);
    expect(result.current.selectedEntry?.branch?.id).toBe('branch-active');
    expect(result.current.selectedEntry?.tipoEstabelecimento).toBe('Filial');
    expect(result.current.selectedCompany?.id).toBe('company-1');
    expect(result.current.workspaceRootPath).toBe('Filiais/Unidade Centro');
    await waitFor(() => expect(onCompanyChange).toHaveBeenCalledWith(
      'company-1',
      'Unidade Centro',
      branchEntryKey,
    ));
  });

  it('separa matriz e filiais conforme o status ativo ou inativo', () => {
    const company = makeCompany({
      polos: [
        makeBranch(),
        makeBranch({
          id: 'branch-inactive',
          nome: 'Unidade Encerrada',
          ativo: false,
          documentFolderPath: 'Filiais/Unidade Encerrada',
        }),
      ],
      pastasDocumentos: [
        'Filiais/Unidade Centro',
        'Filiais/Unidade Encerrada',
      ],
    });
    const baseOptions: WorkspaceOptions = {
      companies: [company],
      statusFilter: 'Ativa',
      selectedFolder: null,
      onFolderChange: vi.fn(),
    };
    const { result, rerender } = renderHook(
      (options: WorkspaceOptions) => useCompanyLibraryWorkspace(options),
      { initialProps: baseOptions },
    );

    expect(result.current.entries.map((entry) => entry.displayName)).toEqual([
      'Casa do Fazendeiro',
      'Unidade Centro',
    ]);

    rerender({ ...baseOptions, statusFilter: 'Inativa' });

    expect(result.current.entries.map((entry) => entry.displayName)).toEqual([
      'Unidade Encerrada',
    ]);
    expect(result.current.entries[0].tipoEstabelecimento).toBe('Filial');
  });

  it('sincroniza a pasta externa para a raiz da filial selecionada', async () => {
    const onFolderChange = vi.fn();
    const { result } = renderHook(() => useCompanyLibraryWorkspace({
      companies: [makeCompany()],
      statusFilter: 'Ativa',
      initialSelectedEntryKey: branchEntryKey,
      selectedFolder: 'Fiscal/2026',
      onFolderChange,
    }));

    expect(result.current.currentFolder).toBe('Filiais/Unidade Centro');
    await waitFor(() => expect(onFolderChange).toHaveBeenCalledWith('Filiais/Unidade Centro'));
  });

  it('ressincroniza a pasta quando a raiz física da filial muda', async () => {
    const onFolderChange = vi.fn();
    const initialCompany = makeCompany();
    const baseOptions: WorkspaceOptions = {
      companies: [initialCompany],
      statusFilter: 'Ativa',
      initialSelectedEntryKey: branchEntryKey,
      selectedFolder: 'Filiais/Unidade Centro',
      onFolderChange,
    };
    const { result, rerender } = renderHook(
      (options: WorkspaceOptions) => useCompanyLibraryWorkspace(options),
      { initialProps: baseOptions },
    );
    const nextRoot = 'Filiais/Unidade Centro Atualizada';
    const updatedCompany = makeCompany({
      polos: [makeBranch({ documentFolderPath: nextRoot })],
      pastasDocumentos: [nextRoot],
    });

    onFolderChange.mockClear();
    rerender({ ...baseOptions, companies: [updatedCompany] });

    expect(result.current.workspaceRootPath).toBe(nextRoot);
    expect(result.current.currentFolder).toBe(nextRoot);
    await waitFor(() => expect(onFolderChange).toHaveBeenCalledWith(nextRoot));
  });
});
