import { describe, expect, it } from 'vitest';
import type {
  ClientBranch,
  Company,
  CompanyDocument,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  buildCompanyLibraryEntries,
  getBranchRootPath,
  isBranchLibraryPath,
  isDocumentWithinRoot,
  isPathWithinRoot,
} from './companyLibraryEntries';

const makeDocument = (id: string, pasta?: string): CompanyDocument => ({
  id,
  nome: `${id}.pdf`,
  tipo: 'Contratos',
  dataUpload: '2026-08-31',
  tamanho: '1 KB',
  pasta,
});

const makeBranch = (overrides: Partial<ClientBranch>): ClientBranch => ({
  id: 'branch-default',
  companyId: 'company-1',
  nome: 'Filial Padrão',
  cnpj: '00.000.000/0002-00',
  email: '',
  telefone: '',
  cidade: '',
  uf: '',
  ativo: true,
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
  ...overrides,
});

describe('companyLibraryEntries', () => {
  it('gera a matriz e cada filial no mesmo nível com chaves visuais estáveis', () => {
    const company = makeCompany({
      polos: [
        makeBranch({ id: 'north', nome: 'Unidade Norte', documentFolderPath: 'Filiais/Unidade Norte' }),
        makeBranch({ id: 'south', nome: 'Unidade Sul', documentFolderPath: 'Filiais/Unidade Sul', ativo: false }),
      ],
      pastasDocumentos: ['Filiais/Unidade Norte', 'Filiais/Unidade Sul'],
    });

    const entries = buildCompanyLibraryEntries([company]);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.displayName)).toEqual([
      'Casa do Fazendeiro',
      'Unidade Norte',
      'Unidade Sul',
    ]);
    expect(entries.map((entry) => entry.tipoEstabelecimento)).toEqual(['Matriz', 'Filial', 'Filial']);
    expect(entries[1].key).toContain('company-1');
    expect(entries[1].key).toContain('north');
    expect(entries[2].status).toBe('Inativa');
  });

  it('segrega documentos e pastas físicas sem duplicar arquivos entre matriz e filiais', () => {
    const documents = [
      makeDocument('root'),
      makeDocument('fiscal', 'Fiscal/2026'),
      makeDocument('north-root', 'Filiais/Unidade Norte'),
      makeDocument('north-child', 'Filiais/Unidade Norte/Fiscal'),
      makeDocument('south-root', 'Filiais/Unidade Sul'),
    ];
    const company = makeCompany({
      documentos: documents,
      pastasDocumentos: [
        'Fiscal/2026',
        'Filiais/Unidade Norte/Fiscal',
        'Filiais/Unidade Sul',
      ],
      polos: [
        makeBranch({ id: 'north', nome: 'Unidade Norte', documentFolderPath: 'Filiais/Unidade Norte' }),
        makeBranch({ id: 'south', nome: 'Unidade Sul', documentFolderPath: 'Filiais/Unidade Sul' }),
      ],
    });

    const [matrix, north, south] = buildCompanyLibraryEntries([company]);

    expect(matrix.documents.map((document) => document.id)).toEqual(['root', 'fiscal']);
    expect(matrix.folders).toEqual(['Fiscal', 'Fiscal/2026']);
    expect(north.documents.map((document) => document.id)).toEqual(['north-root', 'north-child']);
    expect(north.folders).toEqual(['Filiais/Unidade Norte', 'Filiais/Unidade Norte/Fiscal']);
    expect(south.documents.map((document) => document.id)).toEqual(['south-root']);
    expect(south.rootFolderPath).toBe('Filiais/Unidade Sul');

    const assignedDocumentIds = [matrix, north, south].flatMap((entry) => entry.documents.map((document) => document.id));
    expect(assignedDocumentIds).toHaveLength(documents.length);
    expect(new Set(assignedDocumentIds).size).toBe(documents.length);
  });

  it('cria uma filial arquivada para uma raiz física sem polo correspondente', () => {
    const company = makeCompany({
      pastasDocumentos: ['Filiais/Unidade Encerrada/2025'],
      documentos: [makeDocument('legacy', 'Filiais/Unidade Encerrada/2025')],
    });

    const entries = buildCompanyLibraryEntries([company]);
    const archived = entries.find((entry) => entry.isArchived);

    expect(entries).toHaveLength(2);
    expect(entries[0].documents).toEqual([]);
    expect(archived).toMatchObject({
      displayName: 'Unidade Encerrada',
      tipoEstabelecimento: 'Filial',
      status: 'Inativa',
      rootFolderPath: 'Filiais/Unidade Encerrada',
    });
    expect(archived?.branch).toBeUndefined();
    expect(archived?.key).toContain('company-1');
    expect(archived?.key).toContain('Filiais/Unidade Encerrada');
    expect(archived?.documents.map((document) => document.id)).toEqual(['legacy']);
    expect(archived?.folders).toEqual([
      'Filiais/Unidade Encerrada',
      'Filiais/Unidade Encerrada/2025',
    ]);
  });

  it('mantém filial sem raiz válida isolada em vez de abrir documentos da matriz', () => {
    const company = makeCompany({
      documentos: [
        makeDocument('matrix-root'),
        makeDocument('unlinked', 'Filiais/Sem Vínculo'),
      ],
      polos: [makeBranch({ id: 'missing-path', nome: 'Filial sem pasta', documentFolderPath: undefined })],
    });

    const entries = buildCompanyLibraryEntries([company]);
    const branch = entries.find((entry) => entry.branch?.id === 'missing-path');
    const archived = entries.find((entry) => entry.isArchived);

    expect(branch).toMatchObject({ rootFolderPath: null, documents: [], folders: [] });
    expect(branch?.key).toContain('missing-path');
    expect(entries[0].documents.map((document) => document.id)).toEqual(['matrix-root']);
    expect(archived?.documents.map((document) => document.id)).toEqual(['unlinked']);
  });

  it('não reclassifica caminho malformado de filial como documento da matriz', () => {
    const [matrix] = buildCompanyLibraryEntries([makeCompany({
      documentos: [makeDocument('unsafe', 'Filiais/Unidade Norte/../Fiscal')],
    })]);

    expect(matrix.documents).toEqual([]);
  });

  it('reconhece somente raízes e descendentes corporativos válidos', () => {
    expect(getBranchRootPath('Filiais/Unidade Norte/Fiscal/2026')).toBe('Filiais/Unidade Norte');
    expect(getBranchRootPath('Filiais')).toBeNull();
    expect(getBranchRootPath('Fiscal/Unidade Norte')).toBeNull();
    expect(getBranchRootPath('Filiais/../Fiscal')).toBeNull();
    expect(getBranchRootPath('filiais/Unidade Norte/Fiscal')).toBe('filiais/Unidade Norte');

    expect(isPathWithinRoot('filiais/Unidade Norte/Fiscal', 'Filiais/Unidade Norte')).toBe(true);
    expect(isPathWithinRoot('Filiais/Unidade Norte/../Fiscal', 'Filiais/Unidade Norte')).toBe(false);
    expect(isPathWithinRoot('Filiais/Unidade Sul', 'Filiais/Unidade Norte')).toBe(false);
    expect(isPathWithinRoot('Fiscal', null)).toBe(false);
    expect(isDocumentWithinRoot(makeDocument('doc', 'Filiais/Unidade Norte'), 'Filiais/Unidade Norte')).toBe(true);
    expect(isBranchLibraryPath('Filiais')).toBe(true);
    expect(isBranchLibraryPath('Filiais/Unidade Norte')).toBe(true);
    expect(isBranchLibraryPath('Filiais/Unidade Norte/../Fiscal')).toBe(true);
    expect(isBranchLibraryPath('Fiscal/2026')).toBe(false);
  });
});
