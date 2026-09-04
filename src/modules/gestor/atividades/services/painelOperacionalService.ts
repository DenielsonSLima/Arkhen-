import { supabase } from '../../../../lib/supabase';

export type PainelPeriodo = 'dia' | 'semana' | 'mes' | 'todos';
export type NivelRiscoOperacional = 'critico' | 'alto' | 'medio' | 'baixo' | 'concluido';

export interface PainelMetricas {
  total: number;
  concluidas: number;
  emAndamento: number;
  pendentes: number;
  atrasadas: number;
  comPendencia: number;
  vencendoHoje: number;
  vencendoSeteDias: number;
  emRisco: number;
  taxaNoPrazo: number;
}

export interface ColaboradorOperacional extends PainelMetricas {
  responsavelConfigUsuarioId?: string;
  responsavel: string;
  percentualConcluido: number;
}

export interface RankingOperacional {
  id?: string;
  nome: string;
  total: number;
  atrasadas: number;
  emRisco: number;
}

export interface RiscoOperacional {
  tarefaId: string;
  titulo: string;
  clienteId?: string;
  cliente: string;
  responsavelConfigUsuarioId?: string;
  responsavel: string;
  categoria: string;
  prioridade: string;
  status: string;
  prazoLegal: string;
  prazoInterno: string;
  diasEmAtraso: number;
  diasParaVencimento: number;
  nivelRisco: NivelRiscoOperacional;
  motivoPendencia: string;
  evidenciaRegistrada: boolean;
  revisaoPendente: boolean;
  ultimaMovimentacao: string;
}

export interface PainelOperacional {
  periodo: PainelPeriodo;
  dataReferencia: string;
  metricas: PainelMetricas;
  colaboradores: ColaboradorOperacional[];
  rankings: {
    clientes: RankingOperacional[];
    rotinas: RankingOperacional[];
  };
  riscos: RiscoOperacional[];
}

type JsonRecord = Record<string, unknown>;

const EMPTY_METRICS: PainelMetricas = {
  total: 0,
  concluidas: 0,
  emAndamento: 0,
  pendentes: 0,
  atrasadas: 0,
  comPendencia: 0,
  vencendoHoje: 0,
  vencendoSeteDias: 0,
  emRisco: 0,
  taxaNoPrazo: 0,
};

const isRecord = (value: unknown): value is JsonRecord => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const textValue = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value.trim() : fallback
);

const optionalText = (value: unknown) => textValue(value) || undefined;

const integerValue = (value: unknown, maximum = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
};

const signedIntegerValue = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value);
};

const normalizeMetrics = (value: unknown): PainelMetricas => {
  if (!isRecord(value)) return { ...EMPTY_METRICS };
  return {
    total: integerValue(value.total),
    concluidas: integerValue(value.concluidas),
    emAndamento: integerValue(value.emAndamento),
    pendentes: integerValue(value.pendentes),
    atrasadas: integerValue(value.atrasadas),
    comPendencia: integerValue(value.comPendencia),
    vencendoHoje: integerValue(value.vencendoHoje),
    vencendoSeteDias: integerValue(value.vencendoSeteDias),
    emRisco: integerValue(value.emRisco),
    taxaNoPrazo: integerValue(value.taxaNoPrazo, 100),
  };
};

const normalizeColaborador = (value: unknown): ColaboradorOperacional | null => {
  if (!isRecord(value)) return null;
  const responsavel = textValue(value.responsavel);
  if (!responsavel) return null;
  return {
    ...normalizeMetrics(value),
    responsavelConfigUsuarioId: optionalText(value.responsavelConfigUsuarioId),
    responsavel,
    percentualConcluido: integerValue(value.percentualConcluido, 100),
  };
};

const normalizeRanking = (value: unknown): RankingOperacional | null => {
  if (!isRecord(value)) return null;
  const nome = textValue(value.nome);
  if (!nome) return null;
  return {
    id: optionalText(value.id),
    nome,
    total: integerValue(value.total),
    atrasadas: integerValue(value.atrasadas),
    emRisco: integerValue(value.emRisco),
  };
};

const RISK_LEVELS = new Set<NivelRiscoOperacional>([
  'critico', 'alto', 'medio', 'baixo', 'concluido',
]);

const normalizeRisk = (value: unknown): RiscoOperacional | null => {
  if (!isRecord(value)) return null;
  const tarefaId = textValue(value.tarefaId);
  const titulo = textValue(value.titulo);
  const rawLevel = textValue(value.nivelRisco) as NivelRiscoOperacional;
  if (!tarefaId || !titulo || !RISK_LEVELS.has(rawLevel)) return null;
  return {
    tarefaId,
    titulo,
    clienteId: optionalText(value.clienteId),
    cliente: textValue(value.cliente, 'Escritório'),
    responsavelConfigUsuarioId: optionalText(value.responsavelConfigUsuarioId),
    responsavel: textValue(value.responsavel, 'Sem responsável'),
    categoria: textValue(value.categoria, 'Atividade'),
    prioridade: textValue(value.prioridade, 'Média'),
    status: textValue(value.status, 'Pendente'),
    prazoLegal: textValue(value.prazoLegal),
    prazoInterno: textValue(value.prazoInterno),
    diasEmAtraso: integerValue(value.diasEmAtraso),
    diasParaVencimento: signedIntegerValue(value.diasParaVencimento),
    nivelRisco: rawLevel,
    motivoPendencia: textValue(value.motivoPendencia),
    evidenciaRegistrada: value.evidenciaRegistrada === true,
    revisaoPendente: value.revisaoPendente === true,
    ultimaMovimentacao: textValue(value.ultimaMovimentacao),
  };
};

const normalizeArray = <T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
) => Array.isArray(value)
  ? value.map(normalize).filter((item): item is T => item !== null)
  : [];

export const normalizePainelOperacional = (
  value: unknown,
  fallbackPeriodo: PainelPeriodo,
  fallbackDate: string,
): PainelOperacional => {
  const row = isRecord(value) ? value : {};
  const rankings = isRecord(row.rankings) ? row.rankings : {};
  const periodo = textValue(row.periodo) as PainelPeriodo;
  return {
    periodo: ['dia', 'semana', 'mes', 'todos'].includes(periodo)
      ? periodo
      : fallbackPeriodo,
    dataReferencia: textValue(row.dataReferencia, fallbackDate),
    metricas: normalizeMetrics(row.metricas),
    colaboradores: normalizeArray(row.colaboradores, normalizeColaborador),
    rankings: {
      clientes: normalizeArray(rankings.clientes, normalizeRanking),
      rotinas: normalizeArray(rankings.rotinas, normalizeRanking),
    },
    riscos: normalizeArray(row.riscos, normalizeRisk),
  };
};

export const painelOperacionalService = {
  async get(
    periodo: PainelPeriodo,
    dataReferencia: string,
    clienteId?: string,
  ): Promise<PainelOperacional> {
    const { data, error } = await supabase.rpc('obter_painel_operacional', {
      p_periodo: periodo,
      p_data_referencia: dataReferencia,
      p_cliente_id: clienteId || null,
    });
    if (error) throw error;
    return normalizePainelOperacional(data, periodo, dataReferencia);
  },
};
