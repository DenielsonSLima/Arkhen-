import { supabase } from '../../../../lib/supabase';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { planosContratacaoService } from '../../configuracoes/armazenamento/services/planosContratacaoService';
import { normalizeFolderPath, normalizeFolderPaths } from '../utils/folderPaths';
import { documentosPreferencesService } from './documentosPreferencesService';

export interface DocumentCategory {
  id: string;
  nome: string;
  ativo: boolean;
  sistema?: boolean;
}

type StoredDocumentCategory = DocumentCategory | string;
export type DocumentScope = 'pessoal' | 'empresa';

export interface MeusDocumentosData {
  pastas: string[];
  categorias: DocumentCategory[];
  documentos: CompanyDocument[];
}

export interface UploadDocumentInput {
  file: File;
  category: string;
  description: string;
  targetFolder: string;
  dataValidade?: string;
}

export interface UploadCompanyDocumentInput extends UploadDocumentInput {
  companyId: string;
}

interface DocumentRow {
  id: string;
  scope: DocumentScope;
  cliente_id: string | null;
  storage_bucket: string;
  storage_path: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  pasta: string | null;
  data_upload: string | null;
  data_validade: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string | null;
}

interface EmpresaRow {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  status: string | null;
  tipo: Company['tipo'] | null;
  tipo_estabelecimento: Company['tipoEstabelecimento'] | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  pastas_documentos: string[] | null;
  categorias_documentos: string[] | null;
}

interface DocumentCategoryRow {
  id: string;
  cliente_id: string | null;
  nome: string;
  ativo: boolean | null;
  sistema: boolean | null;
  ordem: number | null;
}

interface DocumentMetadataUpdate {
  id: string;
  nome?: string;
  pasta?: string | null;
}

const STORAGE_BUCKET = 'documentos';
const SAMPLE_XML_BUCKET = 'amostras_xml';
const DOCUMENT_TABLE = 'documentos';
const DOCUMENT_CATEGORIES_TABLE = 'documentos_categorias';
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_CATEGORY_ORDER = new Map(DEFAULT_DOCUMENT_CATEGORY_NAMES.map((name, index) => [normalizeCategoryKey(name), index]));

const mapCategoryRow = (row: DocumentCategoryRow): DocumentCategory => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo !== false,
  sistema: row.sistema === true || isDefaultDocumentCategoryName(row.nome),
});

const mergeDocumentCategories = (
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

const SEED_MEUS_DOCUMENTOS: MeusDocumentosData = {
  pastas: [],
  categorias: DEFAULT_DOCUMENT_CATEGORY_NAMES.map((nome) => createDocumentCategory(nome, true)),
  documentos: [],
};

const normalize = (data: Partial<MeusDocumentosData> | null | undefined): MeusDocumentosData => {
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

  return {
    pastas,
    categorias: Array.from(byName.values()),
    documentos: [],
  };
};

const formatBytes = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const sanitizeStoragePathPart = (value: string) => (
  value.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
);

const sanitizeFolderPart = (value: string) => (
  value.trim()
    .replace(/[\\:*?"<>|]/g, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
);

const normalizeFolder = (folder?: string) => (
  folder
    ? folder.split('/').map(sanitizeFolderPart).filter(Boolean).join('/')
    : ''
);

const mapRow = (row: DocumentRow): CompanyDocument => {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    dataUpload: (row.data_upload || row.created_at || '').slice(0, 10),
    tamanho: formatBytes(row.tamanho_bytes),
    url: row.storage_bucket === SAMPLE_XML_BUCKET ? row.storage_path : undefined,
    pasta: row.pasta ? normalizeFolderPath(row.pasta) : undefined,
    descricao: row.descricao || undefined,
    dataValidade: row.data_validade || undefined,
    storagePath: row.storage_path,
    mimeType: row.mime_type || undefined,
    tamanhoBytes: row.tamanho_bytes ?? undefined,
    scope: row.scope,
    companyId: row.cliente_id || undefined,
  };
};

const mapRows = (rows: DocumentRow[]) => rows.map(mapRow);

const mapEmpresaRow = (row: EmpresaRow): Company => ({
  id: row.id,
  nome: row.nome,
  razaoSocial: row.razao_social || row.nome,
  cnpj: row.cnpj || '',
  tipo: row.tipo || 'Simples Nacional',
  tipoEstabelecimento: row.tipo_estabelecimento || 'Matriz',
  funcionariosCount: 0,
  status: row.status === 'Inativa' ? 'Inativa' : 'Ativa',
  email: row.email || '',
  telefone: row.telefone || '',
  endereco: row.endereco || '',
  cidade: row.cidade || '',
  uf: row.uf || '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  pastasDocumentos: normalizeFolderPaths(row.pastas_documentos),
  categoriasDocumentos: normalizeDocumentCategoryNames(row.categorias_documentos),
});

const getUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Sessão expirada. Faça login novamente para continuar.');
  }
  return data.user.id;
};

const getEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) {
    throw new Error('Usuário sem empresa vinculada no Supabase.');
  }
  return String(data);
};

const readMeusDocumentSettings = async (): Promise<MeusDocumentosData> => {
  const stored = await documentosPreferencesService.getMeusDocumentosPreferences();
  return normalize({
    ...SEED_MEUS_DOCUMENTOS,
    ...stored,
  });
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

const listDocumentCategoryRowsByClientes = async (clienteIds: string[]): Promise<DocumentCategoryRow[]> => {
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

const listGlobalDocumentCategories = async () => {
  const [systemRows, tenantRows] = await Promise.all([
    listSystemDocumentCategoryRows(),
    listDocumentCategoryRows(null),
  ]);
  return mergeDocumentCategories([
    ...systemRows.map(mapCategoryRow),
    ...tenantRows.filter((row) => row.sistema !== true).map(mapCategoryRow),
  ]);
};

const saveScopedDocumentCategories = async (
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
      const { error } = await supabase
        .from(DOCUMENT_CATEGORIES_TABLE)
        .update(payload)
        .eq('id', existingRow.id);
      if (error) throw new Error(`Erro ao atualizar categoria de documentos: ${error.message}`);
      return;
    }

    const { error } = await supabase
      .from(DOCUMENT_CATEGORIES_TABLE)
      .insert(payload);
    if (error) throw new Error(`Erro ao salvar categoria de documentos: ${error.message}`);
  }));

  const rowsToDelete = existingRows.filter((row) => (
    row.sistema !== true
    && !isDefaultDocumentCategoryName(row.nome)
    && !desiredIds.has(row.id)
    && !desiredNames.has(normalizeCategoryKey(row.nome))
  ));

  if (rowsToDelete.length > 0) {
    const { error } = await supabase
      .from(DOCUMENT_CATEGORIES_TABLE)
      .delete()
      .in('id', rowsToDelete.map((row) => row.id));
    if (error) throw new Error(`Erro ao excluir categoria de documentos: ${error.message}`);
  }
};

const uploadAndCreateRecord = async (
  scope: DocumentScope,
  input: UploadDocumentInput,
  companyId?: string,
) => {
  await planosContratacaoService.assertCanUpload(input.file.size);

  const [userId, empresaId] = await Promise.all([getUserId(), getEmpresaId()]);
  const safeFolder = normalizeFolder(input.targetFolder);
  const storageFolder = safeFolder.split('/').map(sanitizeStoragePathPart).filter(Boolean).join('/');
  const safeName = sanitizeStoragePathPart(input.file.name);
  const basePath = scope === 'empresa'
    ? `${empresaId}/clientes/${sanitizeStoragePathPart(companyId || '')}`
    : `${empresaId}/pessoal/${userId}`;
  const storagePath = `${basePath}${storageFolder ? `/${storageFolder}` : ''}/${Date.now()}-${safeName}`;

  const upload = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, input.file, {
    cacheControl: '3600',
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  });

  if (upload.error) {
    throw new Error(`Falha no upload do arquivo: ${upload.error.message}`);
  }

  const { data, error } = await supabase.from(DOCUMENT_TABLE).insert({
    scope,
    cliente_id: scope === 'empresa' ? companyId : null,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    nome: input.file.name,
    tipo: input.category || 'Outros',
    descricao: input.description || null,
    pasta: safeFolder || null,
    data_validade: input.dataValidade || null,
    mime_type: input.file.type || null,
    tamanho_bytes: input.file.size,
  }).select('*').single();

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Falha ao registrar documento: ${error.message}`);
  }

  return mapRow(data as DocumentRow);
};

export const documentosService = {
  async getMeusDocumentos(): Promise<MeusDocumentosData> {
    const localSettings = await readMeusDocumentSettings();
    const categorias = await listGlobalDocumentCategories();
    return {
      ...localSettings,
      categorias,
    };
  },

  async saveMeusDocumentos(data: MeusDocumentosData): Promise<void> {
    const normalized = normalize(data);
    await documentosPreferencesService.saveMeusDocumentosPreferences({
      pastas: normalized.pastas,
      categorias: normalized.categorias,
    });
    await saveScopedDocumentCategories(data.categorias || [], null);
  },

  async ensureCompanyFolder(companyName: string): Promise<void> {
    const folderName = companyName.trim();
    if (!folderName) return;
    const data = await readMeusDocumentSettings();
    if (data.pastas.includes(folderName)) return;
    await this.saveMeusDocumentos(normalize({
      ...data,
      pastas: [...data.pastas, folderName],
    }));
  },

  async listPersonalDocumentos(): Promise<CompanyDocument[]> {
    const { data, error } = await supabase
      .from(DOCUMENT_TABLE)
      .select('*')
      .eq('scope', 'pessoal')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar documentos pessoais: ${error.message}`);
    return mapRows((data || []) as DocumentRow[]);
  },

  async listCompanyDocumentos(): Promise<CompanyDocument[]> {
    const { data, error } = await supabase
      .from(DOCUMENT_TABLE)
      .select('*')
      .eq('scope', 'empresa')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar documentos de empresas: ${error.message}`);
    return mapRows((data || []) as DocumentRow[]);
  },

  async listCompanies(): Promise<Company[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nome,razao_social,cnpj,status,tipo,tipo_estabelecimento,email,telefone,endereco,cidade,uf,pastas_documentos,categorias_documentos')
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao buscar clientes no Supabase: ${error.message}`);
    const rows = (data || []) as EmpresaRow[];
    const globalCategories = await listGlobalDocumentCategories();
    const categoryRows = await listDocumentCategoryRowsByClientes(rows.map((row) => row.id));
    const categoriesByClienteId = new Map<string, DocumentCategory[]>();
    categoryRows.forEach((row) => {
      if (!row.cliente_id) return;
      const categories = categoriesByClienteId.get(row.cliente_id) || [];
      categories.push(mapCategoryRow(row));
      categoriesByClienteId.set(row.cliente_id, categories);
    });

    return rows.map((row) => {
      const legacyCustomCategories = normalizeDocumentCategoryNames(row.categorias_documentos, {
        includeDefaults: false,
        stripDefaults: true,
      });
      const categorias = mergeDocumentCategories([
        ...globalCategories,
        ...(categoriesByClienteId.get(row.id) || []),
        ...legacyCustomCategories,
      ]).filter((category) => category.ativo).map((category) => category.nome);

      return {
        ...mapEmpresaRow(row),
        categoriasDocumentos: categorias,
      };
    });
  },

  async updateCompanyDocumentSettings(
    companyId: string,
    settings: Pick<Company, 'pastasDocumentos' | 'categoriasDocumentos'>,
  ): Promise<void> {
    await saveScopedDocumentCategories(
      mergeDocumentCategories(settings.categoriasDocumentos || []).map((category) => ({
        ...category,
        sistema: isDefaultDocumentCategoryName(category.nome),
      })),
      companyId,
    );

    const { error } = await supabase
      .from('clientes')
      .update({
        pastas_documentos: normalizeFolderPaths(settings.pastasDocumentos),
        categorias_documentos: normalizeDocumentCategoryNames(settings.categoriasDocumentos, {
          includeDefaults: false,
          stripDefaults: true,
        }),
      })
      .eq('id', companyId);

    if (error) throw new Error(`Erro ao atualizar preferências de documentos: ${error.message}`);
  },

  async uploadPersonalDocument(input: UploadDocumentInput): Promise<CompanyDocument> {
    return uploadAndCreateRecord('pessoal', input);
  },

  async uploadCompanyDocument(input: UploadCompanyDocumentInput): Promise<CompanyDocument> {
    return uploadAndCreateRecord('empresa', input, input.companyId);
  },

  async updateDocumentMetadata(documentId: string, changes: Omit<DocumentMetadataUpdate, 'id'>): Promise<void> {
    const payload: Partial<Pick<DocumentRow, 'nome' | 'pasta'>> = {};
    if (changes.nome !== undefined) payload.nome = changes.nome.trim();
    if (changes.pasta !== undefined) payload.pasta = normalizeFolder(changes.pasta || '') || null;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from(DOCUMENT_TABLE).update(payload).eq('id', documentId);
    if (error) throw new Error(`Erro ao atualizar documento: ${error.message}`);
  },

  async updateDocumentsMetadata(updates: DocumentMetadataUpdate[]): Promise<void> {
    await Promise.all(updates.map(({ id, ...changes }) => this.updateDocumentMetadata(id, changes)));
  },

  async renameDocument(documentId: string, newName: string): Promise<void> {
    await this.updateDocumentMetadata(documentId, { nome: newName });
  },

  async moveDocument(documentId: string, targetFolder: string): Promise<void> {
    await this.updateDocumentMetadata(documentId, { pasta: targetFolder });
  },

  async deleteDocument(documentId: string): Promise<void> {
    await this.deleteDocuments([documentId]);
  },

  async deleteDocuments(documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) return;

    const { data, error } = await supabase
      .from(DOCUMENT_TABLE)
      .select('storage_bucket, storage_path')
      .in('id', documentIds);
    if (error) throw new Error(`Erro ao localizar documento: ${error.message}`);

    const storagePaths = ((data || []) as { storage_bucket?: string; storage_path?: string }[])
      .filter((item) => item.storage_bucket === STORAGE_BUCKET && item.storage_path)
      .map((item) => item.storage_path as string);

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
      if (storageError) throw new Error(`Erro ao remover arquivo do storage: ${storageError.message}`);
    }

    const { error: deleteError } = await supabase.from(DOCUMENT_TABLE).delete().in('id', documentIds);
    if (deleteError) throw new Error(`Erro ao excluir documento: ${deleteError.message}`);
  },

  async downloadDocument(doc: CompanyDocument): Promise<void> {
    const url = await this.getDocumentAccessUrl(doc);

    if (!url) throw new Error('Não foi possível gerar o link de download deste arquivo.');

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = doc.nome;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },

  async getDocumentAccessUrl(doc: Pick<CompanyDocument, 'url' | 'storagePath'>): Promise<string | null> {
    if (doc.url) return doc.url;
    if (!doc.storagePath) return null;

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storagePath, 60 * 60);
    if (error) throw new Error(`Não foi possível gerar a URL assinada: ${error.message}`);
    return data?.signedUrl || null;
  },
};
