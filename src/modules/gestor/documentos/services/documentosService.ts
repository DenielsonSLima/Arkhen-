import { supabase } from '../../../../lib/supabase';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { planosContratacaoService } from '../../configuracoes/armazenamento/services/planosContratacaoService';

export interface DocumentCategory {
  id: string;
  nome: string;
  ativo: boolean;
  sistema?: boolean;
}

type StoredDocumentCategory = DocumentCategory | string;
type DocumentScope = 'pessoal' | 'empresa';

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

const STORAGE_BUCKET = 'documentos';
const SAMPLE_XML_BUCKET = 'amostras_xml';
const DOCUMENT_TABLE = 'documentos';
const LOCAL_STORAGE_KEY = 'contabil_gestor_meus_documentos';
const CORE_CATEGORIES = ['Contratos', 'Procurações', 'Certidões'];

const createCategory = (nome: string, sistema = false): DocumentCategory => ({
  id: nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-'),
  nome,
  ativo: true,
  sistema,
});

const SEED_MEUS_DOCUMENTOS: MeusDocumentosData = {
  pastas: [],
  categorias: [...CORE_CATEGORIES.map((nome) => createCategory(nome, true)), createCategory('Outros')],
  documentos: [],
};

const normalize = (data: Partial<MeusDocumentosData> | null | undefined): MeusDocumentosData => {
  const pastas = Array.from(new Set((data?.pastas || []).filter((pasta) => !CORE_CATEGORIES.includes(pasta))));
  const rawCategories = (data?.categorias || []) as StoredDocumentCategory[];
  const parsedCategories = rawCategories.map((category) => (
    typeof category === 'string'
      ? createCategory(category)
      : { ...category, ativo: category.ativo !== false }
  ));
  const byName = new Map(parsedCategories.map((category) => [category.nome, category]));

  CORE_CATEGORIES.forEach((nome) => {
    byName.set(nome, { ...createCategory(nome, true), ...byName.get(nome), sistema: true, ativo: true });
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

const sanitizePathPart = (value: string) => (
  value.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
);

const normalizeFolder = (folder?: string) => (
  folder
    ? folder.split('/').map(sanitizePathPart).filter(Boolean).join('/')
    : ''
);

const mapRow = async (row: DocumentRow): Promise<CompanyDocument> => {
  if (row.storage_bucket === SAMPLE_XML_BUCKET) {
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo,
      dataUpload: (row.data_upload || row.created_at || '').slice(0, 10),
      tamanho: formatBytes(row.tamanho_bytes),
      url: row.storage_path,
      pasta: row.pasta || undefined,
      descricao: row.descricao || undefined,
      dataValidade: row.data_validade || undefined,
      storagePath: row.storage_path,
      mimeType: row.mime_type || undefined,
      tamanhoBytes: row.tamanho_bytes ?? undefined,
      scope: row.scope,
      companyId: row.cliente_id || undefined,
    };
  }

  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(row.storage_path, 60 * 60);

  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    dataUpload: (row.data_upload || row.created_at || '').slice(0, 10),
    tamanho: formatBytes(row.tamanho_bytes),
    url: data?.signedUrl,
    pasta: row.pasta || undefined,
    descricao: row.descricao || undefined,
    dataValidade: row.data_validade || undefined,
    storagePath: row.storage_path,
    mimeType: row.mime_type || undefined,
    tamanhoBytes: row.tamanho_bytes ?? undefined,
    scope: row.scope,
    companyId: row.cliente_id || undefined,
  };
};

const mapRows = async (rows: DocumentRow[]) => Promise.all(rows.map(mapRow));

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
  pastasDocumentos: row.pastas_documentos || [],
  categoriasDocumentos: row.categorias_documentos || ['Contratos', 'Procurações', 'Certidões', 'Impostos', 'Trabalhista', 'Outros'],
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

const uploadAndCreateRecord = async (
  scope: DocumentScope,
  input: UploadDocumentInput,
  companyId?: string,
) => {
  await planosContratacaoService.assertCanUpload(input.file.size);

  const [userId, empresaId] = await Promise.all([getUserId(), getEmpresaId()]);
  const safeFolder = normalizeFolder(input.targetFolder);
  const safeName = sanitizePathPart(input.file.name);
  const basePath = scope === 'empresa'
    ? `${empresaId}/clientes/${sanitizePathPart(companyId || '')}`
    : `${empresaId}/pessoal/${userId}`;
  const storagePath = `${basePath}${safeFolder ? `/${safeFolder}` : ''}/${Date.now()}-${safeName}`;

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
  getMeusDocumentos(): MeusDocumentosData {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_MEUS_DOCUMENTOS));
      return SEED_MEUS_DOCUMENTOS;
    }

    try {
      const normalized = normalize(JSON.parse(data) as MeusDocumentosData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      return SEED_MEUS_DOCUMENTOS;
    }
  },

  saveMeusDocumentos(data: MeusDocumentosData): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalize(data)));
  },

  ensureCompanyFolder(companyName: string): void {
    const folderName = companyName.trim();
    if (!folderName) return;
    const data = this.getMeusDocumentos();
    if (data.pastas.includes(folderName)) return;
    this.saveMeusDocumentos({ ...data, pastas: [...data.pastas, folderName] });
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
    return ((data || []) as EmpresaRow[]).map(mapEmpresaRow);
  },

  async updateCompanyDocumentSettings(
    companyId: string,
    settings: Pick<Company, 'pastasDocumentos' | 'categoriasDocumentos'>,
  ): Promise<void> {
    const { error } = await supabase
      .from('clientes')
      .update({
        pastas_documentos: settings.pastasDocumentos || [],
        categorias_documentos: settings.categoriasDocumentos || [],
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

  async renameDocument(documentId: string, newName: string): Promise<void> {
    const { error } = await supabase.from(DOCUMENT_TABLE).update({ nome: newName.trim() }).eq('id', documentId);
    if (error) throw new Error(`Erro ao renomear documento: ${error.message}`);
  },

  async moveDocument(documentId: string, targetFolder: string): Promise<void> {
    const { error } = await supabase.from(DOCUMENT_TABLE).update({ pasta: normalizeFolder(targetFolder) || null }).eq('id', documentId);
    if (error) throw new Error(`Erro ao mover documento: ${error.message}`);
  },

  async deleteDocument(documentId: string): Promise<void> {
    const { data, error } = await supabase.from(DOCUMENT_TABLE).select('storage_bucket, storage_path').eq('id', documentId).maybeSingle();
    if (error) throw new Error(`Erro ao localizar documento: ${error.message}`);

    const { error: deleteError } = await supabase.from(DOCUMENT_TABLE).delete().eq('id', documentId);
    if (deleteError) throw new Error(`Erro ao excluir documento: ${deleteError.message}`);

    const storageData = data as { storage_bucket?: string; storage_path?: string } | null;
    const storagePath = storageData?.storage_path;
    if (storagePath && storageData?.storage_bucket === STORAGE_BUCKET) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
  },

  async downloadDocument(doc: CompanyDocument): Promise<void> {
    const url = doc.url || (doc.storagePath
      ? (await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storagePath, 60 * 60)).data?.signedUrl
      : null);

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
};
