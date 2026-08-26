import { supabase } from '../../../../lib/supabase';
import { normalizeFolderPaths } from '../utils/folderPaths';
import type {
  DocumentCategory,
  DocumentCategoryRow,
  MeusDocumentosData,
  StoredDocumentCategory,
} from './documentosService.types';

const DOCUMENT_CATEGORIES_TABLE = 'documentos_categorias';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (options.includeDefaults !== false) DEFAULT_DOCUMENT_CATEGORY_NAMES.forEach(push);
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

const mapCategoryRow = (row: DocumentCategoryRow): DocumentCategory => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo !== false,
  sistema: row.sistema === true || isDefaultDocumentCategoryName(row.nome),
});

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

export const normalizeDocumentSettings = (
  data: Partial<MeusDocumentosData> | null | undefined,
): MeusDocumentosData => {
  const pastas = normalizeFolderPaths(data?.pastas).filter((pasta) => !CORE_DOCUMENT_CATEGORY_NAMES.includes(pasta));
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

  return { pastas, categorias: Array.from(byName.values()), documentos: [] };
};

const listDocumentCategoryRows = async (clienteId: string | null): Promise<DocumentCategoryRow[]> => {
  let query = supabase
    .from(DOCUMENT_CATEGORIES_TABLE)
    .select('id,cliente_id,nome,ativo,sistema,ordem')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });
  query = clienteId ? query.eq('cliente_id', clienteId) : query.is('cliente_id', null);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar categorias de documentos: ${error.message}`);
  return (data || []) as DocumentCategoryRow[];
};

const listSystemDocumentCategoryRows = async (): Promise<DocumentCategoryRow[]> => {
  const { data, error } = await supabase
    .from(DOCUMENT_CATEGORIES_TABLE)
    .select('id,cliente_id,nome,ativo,sistema,ordem')
    .is('empresa_id', null)
    .is('cliente_id', null)
    .eq('sistema', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao buscar categorias padrão de documentos: ${error.message}`);
  return (data || []) as DocumentCategoryRow[];
};

export const listDocumentCategoryRowsByClientes = async (
  clienteIds: string[],
): Promise<DocumentCategoryRow[]> => {
  if (clienteIds.length === 0) return [];
  const { data, error } = await supabase
    .from(DOCUMENT_CATEGORIES_TABLE)
    .select('id,cliente_id,nome,ativo,sistema,ordem')
    .in('cliente_id', clienteIds)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao buscar categorias por empresa: ${error.message}`);
  return (data || []) as DocumentCategoryRow[];
};

export const listGlobalDocumentCategories = async () => {
  const [systemRows, tenantRows] = await Promise.all([
    listSystemDocumentCategoryRows(),
    listDocumentCategoryRows(null),
  ]);
  return mergeDocumentCategories([
    ...systemRows.map(mapCategoryRow),
    ...tenantRows.filter((row) => row.sistema !== true).map(mapCategoryRow),
  ]);
};

export const saveScopedDocumentCategories = async (
  categories: DocumentCategory[],
  clienteId: string | null,
) => {
  const existingRows = await listDocumentCategoryRows(clienteId);
  const customCategories = categories.filter((category) => (
    !category.sistema && !isDefaultDocumentCategoryName(category.nome)
  ));
  const desiredIds = new Set(customCategories.map((category) => category.id).filter((id) => UUID_PATTERN.test(id)));
  const desiredNames = new Set(customCategories.map((category) => normalizeCategoryKey(category.nome)));

  await Promise.all(customCategories.map(async (category) => {
    const categoryKey = normalizeCategoryKey(category.nome);
    const existingRow = existingRows.find((row) => (
      row.id === category.id || normalizeCategoryKey(row.nome) === categoryKey
    ));
    const payload = {
      cliente_id: clienteId,
      nome: category.nome.trim(),
      ativo: category.ativo !== false,
      sistema: false,
      ordem: 100,
    };

    if (existingRow) {
      const { error } = await supabase.from(DOCUMENT_CATEGORIES_TABLE).update(payload).eq('id', existingRow.id);
      if (error) throw new Error(`Erro ao atualizar categoria de documentos: ${error.message}`);
      return;
    }

    const { error } = await supabase.from(DOCUMENT_CATEGORIES_TABLE).insert(payload);
    if (error) throw new Error(`Erro ao salvar categoria de documentos: ${error.message}`);
  }));

  const rowsToDelete = existingRows.filter((row) => (
    row.sistema !== true
    && !isDefaultDocumentCategoryName(row.nome)
    && !desiredIds.has(row.id)
    && !desiredNames.has(normalizeCategoryKey(row.nome))
  ));
  if (rowsToDelete.length === 0) return;

  const { error } = await supabase
    .from(DOCUMENT_CATEGORIES_TABLE)
    .delete()
    .in('id', rowsToDelete.map((row) => row.id));
  if (error) throw new Error(`Erro ao excluir categoria de documentos: ${error.message}`);
};

export const mapDocumentCategoryRow = mapCategoryRow;
