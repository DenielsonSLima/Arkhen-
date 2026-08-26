import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentosTab } from '../hooks/useDocumentos';

const TAB_LABELS: Record<DocumentosTab, string> = {
  meus: 'Biblioteca',
  empresas: 'Por Empresa',
  inativas: 'Inativas',
  solicitacoes: 'Solicitações',
  todos: 'Todos os Documentos',
  compartilhados: 'Compartilhados',
};

export const getFolderLabel = (path?: string | null) => path?.split('/').at(-1) || '';

export const makeDocumentCategoryId = (name: string) => (
  `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-')}-${Date.now()}`
);

export const getFolderDocuments = (documents: CompanyDocument[], folderPath: string | null) => {
  if (folderPath === null) return documents;

  const prefix = `${folderPath}/`;
  return documents.filter((doc) => {
    const docFolder = doc.pasta || '';
    return docFolder === folderPath || docFolder.startsWith(prefix);
  });
};

export const getDocumentosTitleSuffix = (
  activeTab: DocumentosTab,
  personalFolder: string | null,
  companyName?: string,
) => {
  if (activeTab === 'meus') return getFolderLabel(personalFolder) || TAB_LABELS.meus;
  if (activeTab === 'empresas' || activeTab === 'inativas') return companyName || TAB_LABELS[activeTab];
  return TAB_LABELS[activeTab];
};
