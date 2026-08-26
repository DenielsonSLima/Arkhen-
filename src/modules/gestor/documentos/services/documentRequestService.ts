import { supabase } from '../../../../lib/supabase';

export const DOCUMENT_REQUEST_STATUSES = [
  'Pendente',
  'Recebido',
  'Em conferência',
  'Concluído',
  'Cancelado',
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

export interface DocumentRequestUserOption {
  id: string;
  nome: string;
}

export interface DocumentRequestTaskOption {
  id: string;
  titulo: string;
  clienteId: string;
  competencia: string;
}

export interface DocumentRequestDocumentOption {
  id: string;
  nome: string;
}

export interface DocumentRequestOptions {
  users: DocumentRequestUserOption[];
  tasks: DocumentRequestTaskOption[];
  documents: DocumentRequestDocumentOption[];
}

export interface DocumentRequestHistoryEntry {
  id: string;
  from: string;
  to: DocumentRequestStatus;
  occurredAt: string;
  actorName?: string;
  actorUserId?: string;
  justification?: string;
  documentId?: string;
}

export interface DocumentRequest {
  id: string;
  clienteId: string;
  competencia: string;
  titulo: string;
  descricao: string;
  dataLimite: string;
  status: DocumentRequestStatus;
  responsavelId: string;
  responsavelNome: string;
  revisorId: string;
  revisorNome: string;
  tarefaId: string;
  tarefaTitulo: string;
  documentoId: string;
  documentoNome: string;
  evidenciaTexto: string;
  auditoriaPendente: boolean;
  allowedActions: DocumentRequestStatus[];
  history: DocumentRequestHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequestInput {
  clienteId: string;
  competencia: string;
  titulo: string;
  descricao?: string;
  dataLimite: string;
  responsavelId: string;
  revisorId?: string;
  tarefaId?: string;
}

export interface TransitionDocumentRequestInput {
  id: string;
  status: DocumentRequestStatus;
  justification: string;
  documentId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const asString = (value: unknown) => typeof value === 'string' ? value : '';

const mapRequest = (value: unknown): DocumentRequest => {
  if (!value || typeof value !== 'object') throw new Error('Solicitação documental inválida.');
  const row = value as Record<string, unknown>;
  const status = asString(row.status) as DocumentRequestStatus;
  if (!DOCUMENT_REQUEST_STATUSES.includes(status)) throw new Error('Status de solicitação inválido.');
  const allowedActions = Array.isArray(row.allowedActions)
    ? row.allowedActions.filter((item): item is DocumentRequestStatus => (
      typeof item === 'string' && DOCUMENT_REQUEST_STATUSES.includes(item as DocumentRequestStatus)
    ))
    : [];
  const history = Array.isArray(row.history) ? row.history.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const to = asString(entry.to) as DocumentRequestStatus;
    if (!DOCUMENT_REQUEST_STATUSES.includes(to)) return [];
    return [{
      id: asString(entry.id),
      from: asString(entry.from),
      to,
      occurredAt: asString(entry.occurredAt),
      actorName: asString(entry.actorName) || undefined,
      actorUserId: asString(entry.actorUserId) || undefined,
      justification: asString(entry.justification) || undefined,
      documentId: asString(entry.documentId) || undefined,
    }];
  }) : [];
  return {
    id: asString(row.id),
    clienteId: asString(row.clienteId),
    competencia: asString(row.competencia).slice(0, 7),
    titulo: asString(row.titulo),
    descricao: asString(row.descricao),
    dataLimite: asString(row.dataLimite),
    status,
    responsavelId: asString(row.responsavelId),
    responsavelNome: asString(row.responsavelNome),
    revisorId: asString(row.revisorId),
    revisorNome: asString(row.revisorNome),
    tarefaId: asString(row.tarefaId),
    tarefaTitulo: asString(row.tarefaTitulo),
    documentoId: asString(row.documentoId),
    documentoNome: asString(row.documentoNome),
    evidenciaTexto: asString(row.evidenciaTexto),
    auditoriaPendente: row.auditoriaPendente === true,
    allowedActions,
    history,
    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
  };
};

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

  const dataLimite = input.dataLimite.trim();
  if (!isValidDate(dataLimite)) {
    throw new Error('Informe uma data limite válida.');
  }

  if (!UUID_PATTERN.test(input.responsavelId)) {
    throw new Error('Selecione um responsável ativo.');
  }
  if (input.revisorId && !UUID_PATTERN.test(input.revisorId)) {
    throw new Error('Selecione um revisor ativo.');
  }
  if (input.revisorId === input.responsavelId) {
    throw new Error('Responsável e revisor devem ser pessoas diferentes.');
  }
  if (input.tarefaId && !UUID_PATTERN.test(input.tarefaId)) {
    throw new Error('Selecione uma atividade válida.');
  }

  return {
    cliente_id: input.clienteId,
    competencia: `${input.competencia}-01`,
    titulo,
    descricao,
    data_limite: dataLimite,
    responsavel_id: input.responsavelId,
    revisor_id: input.revisorId || null,
    tarefa_id: input.tarefaId || null,
  };
};

export const normalizeDocumentRequestTransition = (input: TransitionDocumentRequestInput) => {
  if (!UUID_PATTERN.test(input.id)) throw new Error('Solicitação inválida.');
  if (!DOCUMENT_REQUEST_STATUSES.includes(input.status)) throw new Error('Status inválido.');
  const justification = input.justification.trim();
  if (justification.length < 8 || justification.length > 2000) {
    throw new Error('Informe uma evidência ou justificativa entre 8 e 2.000 caracteres.');
  }
  if (input.documentId && !UUID_PATTERN.test(input.documentId)) {
    throw new Error('Selecione um documento válido.');
  }
  return {
    p_id: input.id,
    p_status: input.status,
    p_justificativa: justification,
    p_documento_id: input.documentId || null,
  };
};

const mapOptions = (value: unknown): DocumentRequestOptions => {
  const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const mapList = (key: string) => Array.isArray(payload[key])
    ? payload[key] as Record<string, unknown>[]
    : [];
  return {
    users: mapList('users').map((row) => ({ id: asString(row.id), nome: asString(row.nome) })),
    tasks: mapList('tasks').map((row) => ({
      id: asString(row.id),
      titulo: asString(row.titulo),
      clienteId: asString(row.clienteId),
      competencia: asString(row.competencia),
    })),
    documents: mapList('documents').map((row) => ({ id: asString(row.id), nome: asString(row.nome) })),
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
    const { data, error } = await supabase.rpc('listar_solicitacoes_documentos_operacionais');
    if (error) throw new Error(`Erro ao carregar solicitações de documentos: ${error.message}`);
    if (!Array.isArray(data)) throw new Error('A consulta de solicitações retornou um formato inválido.');
    return data.map(mapRequest);
  },

  async listOptions(clienteId?: string, competencia?: string): Promise<DocumentRequestOptions> {
    if (clienteId && !UUID_PATTERN.test(clienteId)) throw new Error('Empresa cliente inválida.');
    const monthMatch = competencia?.match(MONTH_PATTERN);
    if (competencia && (!monthMatch || Number(monthMatch[2]) < 1 || Number(monthMatch[2]) > 12)) {
      throw new Error('Competência inválida.');
    }
    const { data, error } = await supabase.rpc('listar_opcoes_solicitacoes_documentos', {
      p_cliente_id: clienteId || null,
      p_competencia: competencia ? `${competencia}-01` : null,
    });
    if (error) throw new Error(`Erro ao carregar opções da solicitação: ${error.message}`);
    return mapOptions(data);
  },

  async create(input: CreateDocumentRequestInput): Promise<DocumentRequest> {
    const payload = normalizeDocumentRequestInput(input);
    const { data, error } = await supabase.rpc('criar_solicitacao_documento_operacional', {
      p_payload: payload,
    });
    if (error || !data) {
      throw new Error(`Erro ao criar solicitação: ${error?.message || 'registro não retornado'}`);
    }
    return mapRequest(data);
  },

  async transition(input: TransitionDocumentRequestInput): Promise<DocumentRequest> {
    const payload = normalizeDocumentRequestTransition(input);
    const { data, error } = await supabase.rpc('transicionar_solicitacao_documento_operacional', payload);
    if (error || !data) {
      throw new Error(`Erro ao atualizar solicitação: ${error?.message || 'registro não encontrado'}`);
    }
    return mapRequest(data);
  },
};
