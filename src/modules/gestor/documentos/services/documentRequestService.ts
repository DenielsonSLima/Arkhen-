import { supabase } from '../../../../lib/supabase';

export const DOCUMENT_REQUEST_STATUSES = [
  'Pendente',
  'Recebido',
  'Em conferência',
  'Concluído',
] as const;

export type DocumentRequestStatus = typeof DOCUMENT_REQUEST_STATUSES[number];

export interface DocumentRequestClient {
  id: string;
  nome: string;
  status: 'Ativa' | 'Inativa';
}

export interface DocumentRequestCapabilities {
  canCreate: boolean;
  canUpdate: boolean;
}

export interface DocumentRequest {
  id: string;
  clienteId: string;
  competencia: string;
  titulo: string;
  descricao: string;
  dataLimite: string;
  status: DocumentRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequestInput {
  clienteId: string;
  competencia: string;
  titulo: string;
  descricao?: string;
  dataLimite?: string;
}

interface DocumentRequestRow {
  id: string;
  cliente_id: string;
  competencia: string;
  titulo: string;
  descricao: string | null;
  data_limite: string | null;
  status: DocumentRequestStatus;
  created_at: string;
  updated_at: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUEST_TABLE = 'documentos_solicitacoes';

const mapRow = (row: DocumentRequestRow): DocumentRequest => ({
  id: row.id,
  clienteId: row.cliente_id,
  competencia: row.competencia.slice(0, 7),
  titulo: row.titulo,
  descricao: row.descricao || '',
  dataLimite: row.data_limite || '',
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) {
    throw new Error('Não foi possível identificar o escritório da sessão atual.');
  }
  return String(data);
};

const hasPermission = async (empresaId: string, permission: string) => {
  const { data, error } = await supabase.rpc('current_user_has_permission', {
    p_empresa_id: empresaId,
    p_permission: permission,
  });
  if (error) throw new Error(`Não foi possível validar a permissão ${permission}.`);
  return data === true;
};

const isValidDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const normalizeDocumentRequestInput = (input: CreateDocumentRequestInput) => {
  if (!UUID_PATTERN.test(input.clienteId)) {
    throw new Error('Selecione uma empresa cliente válida.');
  }

  const monthMatch = input.competencia.match(MONTH_PATTERN);
  const month = Number(monthMatch?.[2]);
  if (!monthMatch || month < 1 || month > 12) {
    throw new Error('Informe uma competência válida.');
  }

  const titulo = input.titulo.trim();
  if (titulo.length < 2 || titulo.length > 160) {
    throw new Error('O documento solicitado deve ter entre 2 e 160 caracteres.');
  }

  const descricao = input.descricao?.trim() || null;
  if (descricao && descricao.length > 2000) {
    throw new Error('As orientações devem ter no máximo 2.000 caracteres.');
  }

  const dataLimite = input.dataLimite?.trim() || null;
  if (dataLimite && !isValidDate(dataLimite)) {
    throw new Error('Informe uma data limite válida.');
  }

  return {
    cliente_id: input.clienteId,
    competencia: `${input.competencia}-01`,
    titulo,
    descricao,
    data_limite: dataLimite,
  };
};

export const documentRequestService = {
  async listClients(): Promise<DocumentRequestClient[]> {
    const { data, error } = await supabase.rpc('listar_clientes_solicitacoes_documentos');

    if (error) throw new Error(`Erro ao carregar empresas clientes: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.cliente_id),
      nome: String(row.cliente_nome || ''),
      status: row.cliente_status === 'Inativa' ? 'Inativa' : 'Ativa',
    }));
  },

  async getCapabilities(): Promise<DocumentRequestCapabilities> {
    const empresaId = await getCurrentEmpresaId();
    const [canCreate, canManage] = await Promise.all([
      hasPermission(empresaId, 'documentos:create'),
      hasPermission(empresaId, 'documentos:manage'),
    ]);
    return {
      canCreate: canCreate || canManage,
      canUpdate: canCreate || canManage,
    };
  },

  async list(): Promise<DocumentRequest[]> {
    const empresaId = await getCurrentEmpresaId();
    const { data, error } = await supabase
      .from(REQUEST_TABLE)
      .select('id,cliente_id,competencia,titulo,descricao,data_limite,status,created_at,updated_at')
      .eq('empresa_id', empresaId)
      .order('competencia', { ascending: false })
      .order('data_limite', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao carregar solicitações de documentos: ${error.message}`);
    return ((data || []) as DocumentRequestRow[]).map(mapRow);
  },

  async create(input: CreateDocumentRequestInput): Promise<DocumentRequest> {
    const empresaId = await getCurrentEmpresaId();
    const payload = normalizeDocumentRequestInput(input);
    const { data, error } = await supabase
      .from(REQUEST_TABLE)
      .insert({ empresa_id: empresaId, ...payload })
      .select('id,cliente_id,competencia,titulo,descricao,data_limite,status,created_at,updated_at')
      .single();

    if (error || !data) {
      throw new Error(`Erro ao criar solicitação: ${error?.message || 'registro não retornado'}`);
    }
    return mapRow(data as DocumentRequestRow);
  },

  async updateStatus(id: string, status: DocumentRequestStatus): Promise<DocumentRequest> {
    if (!UUID_PATTERN.test(id)) throw new Error('Solicitação inválida.');
    if (!DOCUMENT_REQUEST_STATUSES.includes(status)) throw new Error('Status inválido.');

    const empresaId = await getCurrentEmpresaId();
    const { data, error } = await supabase
      .from(REQUEST_TABLE)
      .update({ status })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id,cliente_id,competencia,titulo,descricao,data_limite,status,created_at,updated_at')
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar solicitação: ${error?.message || 'registro não encontrado'}`);
    }
    return mapRow(data as DocumentRequestRow);
  },
};
