import { supabase } from '../../../../lib/supabase';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { planosContratacaoService } from '../../configuracoes/armazenamento/services/planosContratacaoService';
import { normalizeFolderPath, normalizeFolderPaths } from '../utils/folderPaths';
import {
  isDefaultDocumentCategoryName,
  listDocumentCategoryRowsByClientes,
  listGlobalDocumentCategories,
  mapDocumentCategoryRow,
  mergeDocumentCategories,
  normalizeDocumentCategoryNames,
  normalizeDocumentSettings,
  saveScopedDocumentCategories,
  SEED_MEUS_DOCUMENTOS,
} from './documentCategoryService';
import { documentosPreferencesService } from './documentosPreferencesService';
import type {
  DocumentCategory,
  DocumentMetadataUpdate,
  DocumentRow,
  DocumentScope,
  EmpresaRow,
  MeusDocumentosData,
  UploadCompanyDocumentInput,
  UploadDocumentInput,
} from './documentosService.types';

export type {
  DocumentCategory,
  DocumentScope,
  MeusDocumentosData,
  UploadCompanyDocumentInput,
  UploadDocumentInput,
} from './documentosService.types';
export {
  CORE_DOCUMENT_CATEGORY_NAMES,
  DEFAULT_DOCUMENT_CATEGORY_NAMES,
  createDocumentCategory,
  isDefaultDocumentCategoryName,
  normalizeDocumentCategoryNames,
} from './documentCategoryService';

const STORAGE_BUCKET = 'documentos';
const SAMPLE_XML_BUCKET = 'amostras_xml';
const DOCUMENT_TABLE = 'documentos';

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
  tipo: row.tipo || 'Não informado',
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
  return normalizeDocumentSettings({
    ...SEED_MEUS_DOCUMENTOS,
    ...stored,
  });
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
    const normalized = normalizeDocumentSettings(data);
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
    await this.saveMeusDocumentos(normalizeDocumentSettings({
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
      categories.push(mapDocumentCategoryRow(row));
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
