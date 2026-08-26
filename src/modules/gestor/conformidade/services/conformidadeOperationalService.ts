import { supabase } from '../../../../lib/supabase';

export type ConformidadeTipo = 'fiscal' | 'folha' | 'contabil' | 'atendimento' | 'atividade';
export type ConformidadePrioridade = 'verde' | 'amarelo' | 'vermelho' | 'sem-prazo';
export type ConformidadeStatus = 'Pendente' | 'Em andamento' | 'Concluído';
export type ConformidadeOrigem = 'atividade' | 'solicitacoes-documentos';
export type SolicitacaoDocumentoStatus = 'Pendente' | 'Recebido' | 'Em conferência';

export interface ConformidadeSolicitacaoDocumento {
  id: string;
  nome: string;
  status: SolicitacaoDocumentoStatus;
  solicitadoEm: string;
  atualizadoEm: string;
  dataLimite: string;
}

export interface ConformidadeEtapa {
  id: string;
  label: string;
  concluida: boolean;
  concluidaEm?: string;
  responsavel?: string;
}

export interface ConformidadeRegraContrato {
  prazoDias: number;
  impacto: 1 | 2 | 3 | 4 | 5;
  consequencia: string;
}

export interface ConformidadeObrigacao {
  id: string;
  origem: ConformidadeOrigem;
  tipo: ConformidadeTipo;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  competencia: string;
  rotina: string;
  descricao: string;
  responsavel: string;
  vencimento: string;
  diasParaVencimento: number | null;
  prioridade: ConformidadePrioridade;
  status: ConformidadeStatus;
  atrasoDias: number;
  podeAtualizar: boolean;
  regraContrato: ConformidadeRegraContrato | null;
  etapas: ConformidadeEtapa[];
  solicitacoesDocumentos: ConformidadeSolicitacaoDocumento[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConformidadeResultado {
  dataReferencia: string;
  obrigacoes: ConformidadeObrigacao[];
  solicitacoesDocumentaisVisiveis: boolean;
  metricas: ConformidadeMetricas;
}

export interface ConformidadeMetricItem {
  label: string;
  quantidade: number;
}

export interface ConformidadeMetricas {
  total: number;
  pendente: number;
  andamento: number;
  concluidas: number;
  atrasadas: number;
  vencendoHoje: number;
  comPrazoDefinido: number;
  semPrazo: number;
  atrasadasPorResponsavel: ConformidadeMetricItem[];
  atrasadasPorCliente: ConformidadeMetricItem[];
  atrasadasPorRotina: ConformidadeMetricItem[];
}

export const EMPTY_CONFORMIDADE_METRICAS: ConformidadeMetricas = {
  total: 0,
  pendente: 0,
  andamento: 0,
  concluidas: 0,
  atrasadas: 0,
  vencendoHoje: 0,
  comPrazoDefinido: 0,
  semPrazo: 0,
  atrasadasPorResponsavel: [],
  atrasadasPorCliente: [],
  atrasadasPorRotina: [],
};

type RpcRecord = Record<string, unknown>;

const tipos = new Set<ConformidadeTipo>(['fiscal', 'folha', 'contabil', 'atendimento', 'atividade']);
const prioridades = new Set<ConformidadePrioridade>(['verde', 'amarelo', 'vermelho', 'sem-prazo']);
const statusValidos = new Set<ConformidadeStatus>(['Pendente', 'Em andamento', 'Concluído']);
const origens = new Set<ConformidadeOrigem>(['atividade', 'solicitacoes-documentos']);
const statusSolicitacaoValidos = new Set<SolicitacaoDocumentoStatus>([
  'Pendente',
  'Recebido',
  'Em conferência',
]);

const requiredString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Registro de conformidade sem ${field}.`);
  }
  return value.trim();
};

const optionalString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeEtapas = (value: unknown): ConformidadeEtapa[] => {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Etapa ${index + 1} inválida na conformidade.`);
    }
    const item = raw as RpcRecord;
    return {
      id: requiredString(item.id, 'identificador da etapa'),
      label: requiredString(item.label, 'nome da etapa'),
      concluida: item.concluida === true,
      concluidaEm: optionalString(item.concluidaEm) || undefined,
      responsavel: optionalString(item.responsavel) || undefined,
    };
  });
};

const normalizeSolicitacao = (raw: unknown, index: number): ConformidadeSolicitacaoDocumento => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Solicitação documental ${index + 1} inválida na conformidade.`);
  }
  const item = raw as RpcRecord;
  const status = optionalString(item.status) as SolicitacaoDocumentoStatus;
  if (!statusSolicitacaoValidos.has(status)) {
    throw new Error('Solicitação documental com status inválido na conformidade.');
  }

  return {
    id: requiredString(item.id, 'identificador da solicitação documental'),
    nome: requiredString(item.nome, 'nome da solicitação documental'),
    status,
    solicitadoEm: optionalString(item.solicitadoEm),
    atualizadoEm: optionalString(item.atualizadoEm),
    dataLimite: optionalString(item.dataLimite),
  };
};

const normalizeObrigacao = (raw: unknown): ConformidadeObrigacao => {
  if (!raw || typeof raw !== 'object') throw new Error('Registro de conformidade inválido.');
  const item = raw as RpcRecord;
  const origem = optionalString(item.origem) as ConformidadeOrigem;
  const tipo = optionalString(item.tipo) as ConformidadeTipo;
  const prioridade = optionalString(item.prioridade) as ConformidadePrioridade;
  const status = optionalString(item.status) as ConformidadeStatus;
  if (!origens.has(origem) || !tipos.has(tipo) || !prioridades.has(prioridade) || !statusValidos.has(status)) {
    throw new Error('Registro de conformidade com classificação inválida.');
  }

  const atrasoDias = typeof item.atrasoDias === 'number' && Number.isFinite(item.atrasoDias)
    ? Math.max(0, Math.trunc(item.atrasoDias))
    : 0;
  const diasParaVencimento = item.diasParaVencimento === null
    ? null
    : typeof item.diasParaVencimento === 'number' && Number.isFinite(item.diasParaVencimento)
      ? Math.trunc(item.diasParaVencimento)
      : Number.NaN;
  if (Number.isNaN(diasParaVencimento)) {
    throw new Error('Registro de conformidade sem distância de vencimento válida.');
  }
  return {
    id: requiredString(item.id, 'identificador'),
    origem,
    tipo,
    clienteId: requiredString(item.clienteId, 'cliente'),
    clienteNome: requiredString(item.clienteNome, 'nome do cliente'),
    cnpj: optionalString(item.cnpj),
    competencia: requiredString(item.competencia, 'competência'),
    rotina: requiredString(item.rotina, 'rotina'),
    descricao: optionalString(item.descricao),
    responsavel: optionalString(item.responsavel),
    vencimento: optionalString(item.vencimento),
    diasParaVencimento,
    prioridade,
    status,
    atrasoDias,
    podeAtualizar: item.podeAtualizar === true,
    regraContrato: null,
    etapas: normalizeEtapas(item.etapas),
    solicitacoesDocumentos: Array.isArray(item.solicitacoesDocumentos)
      ? item.solicitacoesDocumentos.map(normalizeSolicitacao)
      : [],
    criadoEm: optionalString(item.criadoEm),
    atualizadoEm: optionalString(item.atualizadoEm),
  };
};

const normalizeCount = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Métricas de conformidade sem ${field}.`);
  }
  return Math.trunc(value);
};

const normalizeMetricList = (value: unknown, field: string): ConformidadeMetricItem[] => {
  if (!Array.isArray(value)) throw new Error(`Métricas de conformidade sem ${field}.`);
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Métrica ${field} inválida.`);
    const item = raw as RpcRecord;
    return {
      label: requiredString(item.label, `rótulo de ${field}`),
      quantidade: normalizeCount(item.quantidade, `quantidade de ${field}`),
    };
  });
};

const normalizeMetricas = (value: unknown): ConformidadeMetricas => {
  if (!value || typeof value !== 'object') throw new Error('Métricas de conformidade inválidas.');
  const item = value as RpcRecord;
  return {
    total: normalizeCount(item.total, 'total'),
    pendente: normalizeCount(item.pendente, 'pendências'),
    andamento: normalizeCount(item.andamento, 'itens em andamento'),
    concluidas: normalizeCount(item.concluidas, 'itens concluídos'),
    atrasadas: normalizeCount(item.atrasadas, 'itens atrasados'),
    vencendoHoje: normalizeCount(item.vencendoHoje, 'itens vencendo hoje'),
    comPrazoDefinido: normalizeCount(item.comPrazoDefinido, 'itens com prazo'),
    semPrazo: normalizeCount(item.semPrazo, 'itens sem prazo'),
    atrasadasPorResponsavel: normalizeMetricList(item.atrasadasPorResponsavel, 'atrasos por responsável'),
    atrasadasPorCliente: normalizeMetricList(item.atrasadasPorCliente, 'atrasos por cliente'),
    atrasadasPorRotina: normalizeMetricList(item.atrasadasPorRotina, 'atrasos por rotina'),
  };
};

const normalizeResultado = (raw: unknown): ConformidadeResultado => {
  if (!raw || typeof raw !== 'object') throw new Error('A consulta de conformidade retornou um formato inválido.');
  const payload = raw as RpcRecord;
  if (!Array.isArray(payload.obrigacoes) || typeof payload.solicitacoesDocumentaisVisiveis !== 'boolean') {
    throw new Error('A consulta de conformidade retornou um formato inválido.');
  }
  return {
    dataReferencia: requiredString(payload.dataReferencia, 'data de referência'),
    obrigacoes: payload.obrigacoes.map(normalizeObrigacao),
    solicitacoesDocumentaisVisiveis: payload.solicitacoesDocumentaisVisiveis,
    metricas: normalizeMetricas(payload.metricas),
  };
};

export const conformidadeService = {
  async getObrigacoes(companyId?: string): Promise<ConformidadeResultado> {
    const { data, error } = await supabase.rpc('get_resumo_conformidade', {
      p_cliente_id: companyId || null,
    });
    if (error) throw error;
    return normalizeResultado(data);
  },

  async toggleEtapa(obrigacaoId: string, etapaId: string, checked: boolean) {
    const { error } = await supabase.rpc('atualizar_atividade_checklist', {
      p_instancia_id: obrigacaoId,
      p_etapa: etapaId,
      p_concluida: checked,
    });
    if (error) throw error;
    return conformidadeService.getObrigacoes();
  },

  getTipoLabel(tipo: ConformidadeTipo) {
    const labels: Record<ConformidadeTipo, string> = {
      fiscal: 'Fiscal',
      folha: 'Folha',
      contabil: 'Contábil',
      atendimento: 'Atendimento',
      atividade: 'Atividade',
    };
    return labels[tipo];
  },
};
