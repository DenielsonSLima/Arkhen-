import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { documentosPreferencesService } from '../services/documentosPreferencesService';

export type DocumentGroupBy = 'none' | 'type' | 'category' | 'folder' | 'company';
export type DocumentSortBy = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'last-opened';

export interface DocumentGroup {
  key: string;
  label: string;
  documents: CompanyDocument[];
}

type Unsubscribe = () => void;
let loadedDocumentAccess = false;
let loadingDocumentAccess: Promise<Record<string, number>> | null = null;
const documentAccessMap: Record<string, number> = {};
const documentAccessSubscribers = new Set<() => void>();

const notifyDocumentAccessChanged = () => {
  documentAccessSubscribers.forEach((listener) => {
    listener();
  });
};

const getAccessMap = (): Record<string, number> => {
  return { ...documentAccessMap };
};

const normalizeDocumentAccessMap = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const normalized = entries.reduce((acc, [key, value]) => {
    if (Number.isFinite(Number(value))) {
      acc[key] = Number(value);
    }
    return acc;
  }, {} as Record<string, number>);
  return normalized;
};

const ensureDocumentAccessLoaded = async (): Promise<Record<string, number>> => {
  if (loadedDocumentAccess) return getAccessMap();
  if (loadingDocumentAccess) {
    const loaded = await loadingDocumentAccess;
    return loaded;
  }

  loadingDocumentAccess = documentosPreferencesService
    .getDocumentsLastOpenMap()
    .then((result) => {
      const normalized = normalizeDocumentAccessMap(result);
      Object.keys(documentAccessMap).forEach((key) => {
        delete documentAccessMap[key];
      });
      Object.assign(documentAccessMap, normalized);
      loadedDocumentAccess = true;
      return getAccessMap();
    })
    .finally(() => {
      loadingDocumentAccess = null;
      notifyDocumentAccessChanged();
    });

  return loadingDocumentAccess;
};

const saveDocumentAccessMap = async (nextMap: Record<string, number>): Promise<void> => {
  await documentosPreferencesService.setDocumentsLastOpenMap(nextMap);
};

export const recordDocumentAccess = (documentId: string) => {
  if (!documentId) return;
  void (async () => {
    const accessMap = await ensureDocumentAccessLoaded();
    accessMap[documentId] = Date.now();
    Object.keys(documentAccessMap).forEach((key) => {
      delete documentAccessMap[key];
    });
    Object.assign(documentAccessMap, accessMap);
    notifyDocumentAccessChanged();
    await saveDocumentAccessMap({ ...documentAccessMap });
  })();
};

export const initDocumentAccessMap = async (): Promise<void> => {
  await ensureDocumentAccessLoaded();
};

export const subscribeDocumentAccess = (listener: () => void): Unsubscribe => {
  documentAccessSubscribers.add(listener);
  return () => {
    documentAccessSubscribers.delete(listener);
  };
};

export const getDocumentAccessSnapshot = (): Record<string, number> => getAccessMap();

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
