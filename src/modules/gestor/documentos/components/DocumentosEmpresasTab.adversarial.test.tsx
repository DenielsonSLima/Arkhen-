/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientBranch,
  Company,
  CompanyDocument,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentosEmpresasTab } from './DocumentosEmpresasTab';

vi.mock('./DocumentMoveDrawer', () => ({
  DocumentMoveDrawer: () => null,
}));

vi.mock('./OrganizedDocumentList', () => ({
  OrganizedDocumentList: () => null,
}));

const selectedBranchRoot = 'Filiais/Unidade Centro';
const otherBranchFolder = 'Filiais/Unidade Sul/Arquivo';

const matrixDocument: CompanyDocument = {
  id: 'matrix-document',
  nome: 'contrato-social.pdf',
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
  pasta: 'Fiscal',
};

const selectedBranchDocument: CompanyDocument = {
  id: 'branch-centro-document',
  nome: 'alvara-centro.pdf',
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
  pasta: selectedBranchRoot,
};

const otherBranchDocument: CompanyDocument = {
  id: 'branch-sul-document',
  nome: 'alvara-sul.pdf',
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
  pasta: otherBranchFolder,
};

const branches: ClientBranch[] = [
  {
    id: 'branch-centro',
    companyId: 'company-1',
    nome: 'Unidade Centro',
    cnpj: '32.833.113/0002-45',
    email: '',
    telefone: '',
    cidade: 'Aracaju',
    uf: 'SE',
    ativo: true,
    documentFolderPath: selectedBranchRoot,
  },
  {
    id: 'branch-sul',
    companyId: 'company-1',
    nome: 'Unidade Sul',
    cnpj: '32.833.113/0003-26',
    email: '',
    telefone: '',
    cidade: 'Aracaju',
    uf: 'SE',
    ativo: true,
    documentFolderPath: 'Filiais/Unidade Sul',
  },
];

const company: Company = {
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
  documentos: [matrixDocument, selectedBranchDocument, otherBranchDocument],
  pastasDocumentos: [
    'Fiscal',
    selectedBranchRoot,
    `${selectedBranchRoot}/Entrada`,
    'Filiais/Unidade Sul',
    otherBranchFolder,
  ],
  polos: branches,
};

const makeDataTransfer = (payload: object) => ({
  types: ['application/x-documentos-item'],
  dropEffect: 'none',
  effectAllowed: 'all',
  getData: vi.fn((type: string) => (
    type === 'application/x-documentos-item' ? JSON.stringify(payload) : ''
  )),
  setData: vi.fn(),
});

const renderSelectedBranch = (onSaveCompanyDocs = vi.fn()) => {
  const result = render(
    <DocumentosEmpresasTab
      companies={[company]}
      statusFilter="Ativa"
      selectedDocIds={[]}
      toggleSelectDoc={vi.fn()}
      searchTerm=""
      selectedCategoryFilter="Todos"
      fileTypeFilter="Todos"
      initialSelectedCompanyId="company-1"
      initialSelectedEntryKey="company:company-1:branch:branch-centro"
      viewMode="grid"
      onSaveCompanyDocs={onSaveCompanyDocs}
      selectedFolder={selectedBranchRoot}
      onFolderChange={vi.fn()}
      groupBy="none"
      sortBy="recent"
    />,
  );

  return {
    ...result,
    dropSurface: result.container.firstElementChild as HTMLElement,
    onSaveCompanyDocs,
  };
};

afterEach(cleanup);

describe('DocumentosEmpresasTab: isolamento adversarial da filial', () => {
  it('rejeita o id de um documento da matriz solto no workspace da filial', async () => {
    const { dropSurface, onSaveCompanyDocs } = renderSelectedBranch();

    fireEvent.drop(dropSurface, {
      dataTransfer: makeDataTransfer({ kind: 'document', id: matrixDocument.id }),
    });

    expect(await screen.findByText('Movimentação inválida')).toBeTruthy();
    expect(screen.getByText(
      'O arquivo ou a pasta de destino não pertence à empresa ou filial selecionada.',
    )).toBeTruthy();
    expect(onSaveCompanyDocs).not.toHaveBeenCalled();
  });

  it('rejeita o path de uma pasta de outra filial solto no workspace selecionado', async () => {
    const { dropSurface, onSaveCompanyDocs } = renderSelectedBranch();

    fireEvent.drop(dropSurface, {
      dataTransfer: makeDataTransfer({ kind: 'folder', path: otherBranchFolder }),
    });

    expect(await screen.findByText('Movimentação inválida')).toBeTruthy();
    expect(screen.getByText(
      'A pasta não pertence à empresa ou filial selecionada.',
    )).toBeTruthy();
    expect(onSaveCompanyDocs).not.toHaveBeenCalled();
  });
});
