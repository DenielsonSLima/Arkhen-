/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientBranch,
  Company,
  CompanyDocument,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  buildCompanyLibraryEntries,
  type CompanyLibraryEntry,
} from '../utils/companyLibraryEntries';
import { DocumentosEmpresasBrowser } from './DocumentosEmpresasBrowser';

const matrixDocument: CompanyDocument = {
  id: 'matrix-document',
  nome: 'contrato-social.pdf',
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
};

const branchDocument: CompanyDocument = {
  id: 'branch-document',
  nome: 'alvara-filial.pdf',
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
  pasta: 'Filiais/Unidade Centro',
};

const branch: ClientBranch = {
  id: 'branch-centro',
  companyId: 'company-1',
  nome: 'Unidade Centro',
  cnpj: '32.833.113/0002-45',
  email: '',
  telefone: '',
  cidade: 'Aracaju',
  uf: 'SE',
  ativo: true,
  documentFolderPath: 'Filiais/Unidade Centro',
};

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
  documentos: [matrixDocument, branchDocument],
  pastasDocumentos: ['Filiais/Unidade Centro'],
  polos: [branch],
};

const entries = buildCompanyLibraryEntries([company]);

const renderBrowser = (
  libraryEntries: CompanyLibraryEntry[],
  onEntrySelect = vi.fn(),
) => render(
  <DocumentosEmpresasBrowser
    entries={libraryEntries}
    selectedEntryKey={null}
    selectedEntry={null}
    workspaceRootPath={null}
    selectedFolder={null}
    breadcrumbs={[]}
    filteredDocsCount={0}
    isGlobalSearchActive={false}
    isFolderNavigationVisible
    currentSubFolders={[]}
    documents={[]}
    draggedFolder={null}
    dropTargetFolder={null}
    onBackClick={vi.fn()}
    onFolderChange={vi.fn()}
    onEntrySelect={onEntrySelect}
    onDraggedFolderChange={vi.fn()}
    onDropTargetChange={vi.fn()}
    canDropOnFolder={() => true}
    onDropItem={vi.fn()}
    onDeleteFolder={vi.fn()}
  >
    <div>Lista de documentos</div>
  </DocumentosEmpresasBrowser>,
);

afterEach(cleanup);

describe('DocumentosEmpresasBrowser', () => {
  it('mostra matriz e filial como cards irmãos com os badges corretos e sem agregador', () => {
    const { container } = renderBrowser(entries);
    const matrixCard = screen.getByText('Casa do Fazendeiro').closest('.doc-folder-card');
    const branchCard = screen.getByText('Unidade Centro').closest('.doc-folder-card');

    expect(matrixCard).toBeTruthy();
    expect(branchCard).toBeTruthy();
    expect(matrixCard?.parentElement).toBe(branchCard?.parentElement);
    expect(container.querySelectorAll('.doc-folder-card')).toHaveLength(2);
    expect(within(matrixCard as HTMLElement).getByText('Matriz')).toBeTruthy();
    expect(within(branchCard as HTMLElement).getByText('Filial')).toBeTruthy();
    expect(screen.queryByText('Filiais')).toBeNull();
    expect(screen.queryByText('1 filial')).toBeNull();
    expect(screen.queryByText(/filiais cadastradas/i)).toBeNull();
    expect(screen.queryByTitle(/pastas das filiais/i)).toBeNull();
  });

  it('seleciona a chave própria de cada entry ao clicar no card correspondente', () => {
    const onEntrySelect = vi.fn();
    renderBrowser(entries, onEntrySelect);
    const matrixEntry = entries.find((entry) => entry.tipoEstabelecimento === 'Matriz');
    const branchEntry = entries.find((entry) => entry.branch?.id === 'branch-centro');

    fireEvent.click(screen.getByText('Casa do Fazendeiro').closest('.doc-folder-card') as HTMLElement);
    fireEvent.click(screen.getByText('Unidade Centro').closest('.doc-folder-card') as HTMLElement);

    expect(onEntrySelect).toHaveBeenNthCalledWith(1, matrixEntry?.key);
    expect(onEntrySelect).toHaveBeenNthCalledWith(2, branchEntry?.key);
    expect(matrixEntry?.key).not.toBe(branchEntry?.key);
  });
});
