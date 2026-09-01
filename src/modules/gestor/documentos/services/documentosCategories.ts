import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { normalizeFolderPaths } from '../utils/folderPaths';

export interface DocumentCategory {
  id: string;
  nome: string;
  ativo: boolean;
  sistema?: boolean;
}

type StoredDocumentCategory = DocumentCategory | string;

export interface MeusDocumentosData {
  pastas: string[];
  categorias: DocumentCategory[];
  documentos: CompanyDocument[];
}

export const CORE_DOCUMENT_CATEGORY_NAMES = ['Contratos', 'Procurações', 'Certidões'];
export const DEFAULT_DOCUMENT_CATEGORY_NAMES = [
  ...CORE_DOCUMENT_CATEGORY_NAMES,
  'Impostos',
  'Trabalhista',
  'Outros',
];

const normalizeCategoryKey = (name: string) => (
  name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
);

export const isDefaultDocumentCategoryName = (name: string) => (
  DEFAULT_DOCUMENT_CATEGORY_NAMES.some((category) => normalizeCategoryKey(category) === normalizeCategoryKey(name))
);

export const normalizeDocumentCategoryNames = (
  categories: string[] | null | undefined,
  options: { includeDefaults?: boolean; stripDefaults?: boolean } = {},
) => {
  const result: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    const key = normalizeCategoryKey(normalizedName);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalizedName);
  };

  if (options.includeDefaults !== false) {
    DEFAULT_DOCUMENT_CATEGORY_NAMES.forEach(push);
  }
  (categories || []).forEach((name) => {
    if (options.stripDefaults && isDefaultDocumentCategoryName(name)) return;
    push(name);
  });
  return result;
};

export const createDocumentCategory = (nome: string, sistema = false): DocumentCategory => ({
  id: nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-'),
  nome,
  ativo: true,
  sistema,
});

const DEFAULT_CATEGORY_ORDER = new Map(
  DEFAULT_DOCUMENT_CATEGORY_NAMES.map((name, index) => [normalizeCategoryKey(name), index]),
);

export const mergeDocumentCategories = (
  categories: Array<DocumentCategory | string>,
  options: { includeDefaults?: boolean } = {},
) => {
  const byName = new Map<string, DocumentCategory>();
  const push = (category: DocumentCategory | string) => {
    const next: DocumentCategory = typeof category === 'string'
      ? createDocumentCategory(category, isDefaultDocumentCategoryName(category))
      : {
        ...category,
        ativo: category.ativo !== false,
        sistema: category.sistema === true || isDefaultDocumentCategoryName(category.nome),
      };
    const key = normalizeCategoryKey(next.nome);
    if (!key) return;
    const current = byName.get(key);
    byName.set(key, current
      ? {
        ...current,
        ...next,
        ativo: Boolean(current.ativo || next.ativo || next.sistema),
        sistema: Boolean(current.sistema || next.sistema),
      }
      : next);
  };

  if (options.includeDefaults !== false) {
    DEFAULT_DOCUMENT_CATEGORY_NAMES.forEach((name) => push(createDocumentCategory(name, true)));
  }
  categories.forEach(push);

  return Array.from(byName.values()).sort((a, b) => {
    const orderA = DEFAULT_CATEGORY_ORDER.get(normalizeCategoryKey(a.nome)) ?? 999;
    const orderB = DEFAULT_CATEGORY_ORDER.get(normalizeCategoryKey(b.nome)) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
};

export const SEED_MEUS_DOCUMENTOS: MeusDocumentosData = {
  pastas: [],
  categorias: DEFAULT_DOCUMENT_CATEGORY_NAMES.map((nome) => createDocumentCategory(nome, true)),
  documentos: [],
};

export const normalizeMeusDocumentos = (
  data: Partial<MeusDocumentosData> | null | undefined,
): MeusDocumentosData => {
  const pastas = normalizeFolderPaths(data?.pastas).filter(
    (pasta) => !CORE_DOCUMENT_CATEGORY_NAMES.includes(pasta),
  );
  const rawCategories = (data?.categorias || []) as StoredDocumentCategory[];
  const parsedCategories = rawCategories.map((category) => (
    typeof category === 'string'
      ? createDocumentCategory(category)
      : { ...category, ativo: category.ativo !== false, sistema: category.sistema === true }
  ));
  const byName = new Map(parsedCategories.map((category) => [category.nome, category]));

  DEFAULT_DOCUMENT_CATEGORY_NAMES.forEach((nome) => {
    byName.set(nome, {
      ...createDocumentCategory(nome, true),
      ...byName.get(nome),
      sistema: true,
      ativo: true,
    });
  });

  return {
    pastas,
    categorias: Array.from(byName.values()),
    documentos: [],
  };
};
