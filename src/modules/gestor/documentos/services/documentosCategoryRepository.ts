import { supabase } from '../../../../lib/supabase';
import {
  isDefaultDocumentCategoryName,
  mergeDocumentCategories,
} from './documentosCategories';
import type { DocumentCategory } from './documentosCategories';

export interface DocumentCategoryRow {
  id: string;
  cliente_id: string | null;
  nome: string;
  ativo: boolean | null;
  sistema: boolean | null;
  ordem: number | null;
}

const TABLE = 'documentos_categorias';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizeCategoryKey = (name: string) => (
  name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
);

export const mapCategoryRow = (row: DocumentCategoryRow): DocumentCategory => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo !== false,
  sistema: row.sistema === true || isDefaultDocumentCategoryName(row.nome),
});

const listRows = async (clienteId: string | null): Promise<DocumentCategoryRow[]> => {
  let query = supabase
    .from(TABLE)
    .select('id,cliente_id,nome,ativo,sistema,ordem')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });
  query = clienteId ? query.eq('cliente_id', clienteId) : query.is('cliente_id', null);
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar categorias de documentos: ${error.message}`);
  return (data || []) as DocumentCategoryRow[];
};

const listSystemRows = async (): Promise<DocumentCategoryRow[]> => {
  const { data, error } = await supabase
    .from(TABLE)
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
    .from(TABLE)
    .select('id,cliente_id,nome,ativo,sistema,ordem')
    .in('cliente_id', clienteIds)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });
  if (error) throw new Error(`Erro ao buscar categorias por empresa: ${error.message}`);
  return (data || []) as DocumentCategoryRow[];
};

export const listGlobalDocumentCategories = async () => {
  const [systemRows, tenantRows] = await Promise.all([listSystemRows(), listRows(null)]);
  return mergeDocumentCategories([
    ...systemRows.map(mapCategoryRow),
    ...tenantRows.filter((row) => row.sistema !== true).map(mapCategoryRow),
  ]);
};

export const saveScopedDocumentCategories = async (
  categories: DocumentCategory[],
  clienteId: string | null,
) => {
  const existingRows = await listRows(clienteId);
  const customCategories = categories.filter((category) => (
    !category.sistema && !isDefaultDocumentCategoryName(category.nome)
  ));
  const desiredIds = new Set(
    customCategories.map((category) => category.id).filter((id) => UUID_PATTERN.test(id)),
  );
  const desiredNames = new Set(
    customCategories.map((category) => normalizeCategoryKey(category.nome)),
  );

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
      const { error } = await supabase.from(TABLE).update(payload).eq('id', existingRow.id);
      if (error) throw new Error(`Erro ao atualizar categoria de documentos: ${error.message}`);
      return;
    }
    const { error } = await supabase.from(TABLE).insert(payload);
    if (error) throw new Error(`Erro ao salvar categoria de documentos: ${error.message}`);
  }));

  const rowsToDelete = existingRows.filter((row) => (
    row.sistema !== true
    && !isDefaultDocumentCategoryName(row.nome)
    && !desiredIds.has(row.id)
    && !desiredNames.has(normalizeCategoryKey(row.nome))
  ));
  if (rowsToDelete.length > 0) {
    const { error } = await supabase.from(TABLE).delete().in(
      'id', rowsToDelete.map((row) => row.id),
    );
    if (error) throw new Error(`Erro ao excluir categoria de documentos: ${error.message}`);
  }
};
