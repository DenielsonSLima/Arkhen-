import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export type DocumentGroupBy = 'none' | 'type' | 'category' | 'folder' | 'company';
export type DocumentSortBy = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'last-opened';

export interface DocumentGroup {
  key: string;
  label: string;
  documents: CompanyDocument[];
}

const LAST_ACCESS_KEY = 'documentos_last_access_by_doc';

const getAccessMap = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(LAST_ACCESS_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

export const recordDocumentAccess = (documentId: string) => {
  const accessMap = getAccessMap();
  accessMap[documentId] = Date.now();
  localStorage.setItem(LAST_ACCESS_KEY, JSON.stringify(accessMap));
};

export const getFileTypeLabel = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'Word';
  if (['xls', 'xlsx'].includes(ext)) return 'Planilhas';
  if (['ppt', 'pptx'].includes(ext)) return 'Apresentações';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'Imagens';
  if (ext === 'ofx') return 'OFX';
  if (ext === 'txt') return 'Textos';
  return ext ? ext.toUpperCase() : 'Outros arquivos';
};

const parseDate = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortDocuments = <T extends CompanyDocument>(documents: T[], sortBy: DocumentSortBy): T[] => {
  const accessMap = getAccessMap();
  return [...documents].sort((a, b) => {
    if (sortBy === 'name-asc') return a.nome.localeCompare(b.nome, 'pt-BR');
    if (sortBy === 'name-desc') return b.nome.localeCompare(a.nome, 'pt-BR');
    if (sortBy === 'oldest') return parseDate(a.dataUpload) - parseDate(b.dataUpload);
    if (sortBy === 'last-opened') return (accessMap[b.id] || 0) - (accessMap[a.id] || 0);
    return parseDate(b.dataUpload) - parseDate(a.dataUpload);
  });
};

const getGroupLabel = (doc: CompanyDocument, groupBy: DocumentGroupBy) => {
  if (groupBy === 'type') return getFileTypeLabel(doc.nome);
  if (groupBy === 'category') return doc.tipo || 'Sem categoria';
  if (groupBy === 'folder') return doc.pasta || 'Sem pasta';
  if (groupBy === 'company') return (doc as CompanyDocument & { empresaNome?: string }).empresaNome || 'Biblioteca pessoal';
  return 'Todos';
};

export const organizeDocuments = <T extends CompanyDocument>(
  documents: T[],
  groupBy: DocumentGroupBy,
  sortBy: DocumentSortBy,
): DocumentGroup[] => {
  const sorted = sortDocuments(documents, sortBy);
  if (groupBy === 'none') return [{ key: 'all', label: 'Todos', documents: sorted }];

  const groups = new Map<string, T[]>();
  sorted.forEach((doc) => {
    const label = getGroupLabel(doc, groupBy);
    groups.set(label, [...(groups.get(label) || []), doc]);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([label, docs]) => ({ key: label, label, documents: docs }));
};
