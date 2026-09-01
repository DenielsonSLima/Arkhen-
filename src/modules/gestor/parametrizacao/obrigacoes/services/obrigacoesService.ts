import { supabase } from '../../../../../lib/supabase';
import {
  OBRIGACAO_ORIGENS,
  OBRIGACAO_PERIODICIDADES,
  OBRIGACAO_REGIMES,
  type ObrigacaoModelo,
  type ObrigacaoModeloDraft,
  type ObrigacaoOrigem,
  type ObrigacaoPeriodicidade,
  type ObrigacaoRegime,
} from '../obrigacoes.types';

type JsonRecord = Record<string, unknown>;

const LIST_RPC = 'listar_obrigacoes_unificadas';
const SUMMARY_RPC = 'obter_resumo_obrigacoes_unificadas';
const SAVE_RPC = 'salvar_obrigacao_unificada';

export interface ObrigacoesResumo {
  total: number;
  ativos: number;
  comPrazo: number;
  etapas: number;
}

const asRecord = (value: unknown): JsonRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
);

const asString = (value: unknown) => typeof value === 'string' ? value : '';

const asInteger = (value: unknown, fallback: number) => (
  typeof value === 'number' && Number.isInteger(value) ? value : fallback
);

const requireNonNegativeInteger = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`O banco retornou um resumo inválido (${field}).`);
  }
  return value;
};

const clampDay = (value: unknown, fallback: number) => (
  Math.min(Math.max(asInteger(value, fallback), 1), 31)
);

const asIntegerInRange = (value: unknown, min: number, max: number) => (
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined
);

const normalizeIsoDate = (value: unknown) => {
  const text = asString(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? text
    : undefined;
};

const normalizeRegimes = (value: unknown): ObrigacaoRegime[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value.map((regime) => regime === 'Isento' ? 'Isenta' : regime);
  return OBRIGACAO_REGIMES.filter((regime) => normalized.includes(regime));
};

const normalizeEtapas = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((etapa): etapa is string => typeof etapa === 'string')
    .map((etapa) => etapa.trim())
    .filter(Boolean);
};

const normalizePeriodicidade = (value: unknown): ObrigacaoPeriodicidade => (
  OBRIGACAO_PERIODICIDADES.includes(value as ObrigacaoPeriodicidade)
    ? value as ObrigacaoPeriodicidade
    : 'mensal'
);

const normalizeOrigem = (value: unknown): ObrigacaoOrigem => (
  OBRIGACAO_ORIGENS.includes(value as ObrigacaoOrigem)
    ? value as ObrigacaoOrigem
    : 'Ambos'
);

export const normalizeObrigacao = (value: unknown): ObrigacaoModelo => {
  const item = asRecord(value);
  const id = asString(item?.id).trim();
  const codigo = asString(item?.codigo).trim();
  const nome = asString(item?.nome).trim();
  if (!item || !id || !codigo || !nome) {
    throw new Error('O banco retornou uma obrigação inválida.');
  }

  return {
    id,
    codigo,
    nome,
    categoria: asString(item.categoria).trim() || 'Fiscal',
    orgao: asString(item.orgao).trim(),
    descricao: asString(item.descricao).trim(),
    regimes: normalizeRegimes(item.regimes),
    periodicidade: normalizePeriodicidade(item.periodicidade),
    origemPadrao: normalizeOrigem(item.origemPadrao),
    temVencimento: item.temVencimento !== false,
    diaVencimento: clampDay(item.diaVencimento, 20),
    diaSemana: asIntegerInRange(item.diaSemana, 1, 7),
    dataVencimento: normalizeIsoDate(item.dataVencimento),
    mesVencimento: asIntegerInRange(item.mesVencimento, 1, 12),
    referenciaMesAnterior: item.referenciaMesAnterior !== false,
    diaPrimeiraQuinzena: clampDay(item.diaPrimeiraQuinzena, 15),
    diaSegundaQuinzena: clampDay(item.diaSegundaQuinzena, 30),
    etapas: normalizeEtapas(item.etapas),
    ativo: item.ativo !== false,
    ordem: asInteger(item.ordem, 100),
    atualizadoEm: asString(item.atualizadoEm).trim() || null,
  };
};

export const normalizeObrigacoesResumo = (value: unknown): ObrigacoesResumo => {
  const item = asRecord(value);
  if (!item) throw new Error('O banco retornou um resumo de obrigações inválido.');

  const resumo = {
    total: requireNonNegativeInteger(item.total, 'total'),
    ativos: requireNonNegativeInteger(item.ativos, 'ativos'),
    comPrazo: requireNonNegativeInteger(item.comPrazo, 'comPrazo'),
    etapas: requireNonNegativeInteger(item.etapas, 'etapas'),
  };

  if (resumo.ativos > resumo.total || resumo.comPrazo > resumo.ativos) {
    throw new Error('O banco retornou um resumo de obrigações inconsistente.');
  }

  return resumo;
};

export const buildObrigacaoPayload = (draft: ObrigacaoModeloDraft) => {
  const periodicidade = normalizePeriodicidade(draft.periodicidade);
  const agenda: JsonRecord = {};

  if (periodicidade === 'unica') {
    const dataVencimento = normalizeIsoDate(draft.dataVencimento);
    if (dataVencimento) agenda.dataVencimento = dataVencimento;
  } else if (periodicidade === 'semanal') {
    const diaSemana = asIntegerInRange(draft.diaSemana, 1, 7);
    if (diaSemana !== undefined) agenda.diaSemana = diaSemana;
  } else if (periodicidade === 'anual') {
    agenda.diaVencimento = clampDay(draft.diaVencimento, 20);
    const mesVencimento = asIntegerInRange(draft.mesVencimento, 1, 12);
    if (mesVencimento !== undefined) agenda.mesVencimento = mesVencimento;
  } else if (draft.temVencimento) {
    if (periodicidade === 'quinzenal') {
      agenda.diaVencimento = clampDay(draft.diaSegundaQuinzena, 30);
      agenda.diaPrimeiraQuinzena = clampDay(draft.diaPrimeiraQuinzena, 15);
      agenda.diaSegundaQuinzena = clampDay(draft.diaSegundaQuinzena, 30);
    } else if (periodicidade !== 'diaria') {
      agenda.diaVencimento = clampDay(draft.diaVencimento, 20);
    }
  }

  return {
    ...(draft.id ? { id: draft.id } : {}),
    ...(draft.codigo ? { codigo: draft.codigo } : {}),
    ...(draft.atualizadoEm ? { atualizadoEm: draft.atualizadoEm } : {}),
    nome: draft.nome.trim(),
    categoria: draft.categoria.trim(),
    orgao: draft.orgao.trim(),
    descricao: draft.descricao.trim(),
    regimes: normalizeRegimes(draft.regimes),
    periodicidade,
    origemPadrao: normalizeOrigem(draft.origemPadrao),
    temVencimento: draft.temVencimento,
    referenciaMesAnterior: draft.referenciaMesAnterior,
    etapas: normalizeEtapas(draft.etapas),
    ativo: draft.ativo,
    ...agenda,
  };
};

const mapSaveError = (error: { code?: string; message?: string }) => {
  if (error.code === '40001') {
    return new Error('Essa obrigação foi alterada em outra tela. Reabra o card e tente novamente.');
  }
  if (error.code === '42501') {
    return new Error('Seu perfil não tem permissão para alterar as obrigações.');
  }
  if (error.code === '22023') {
    return new Error(error.message || 'Revise os dados, regimes e etapas da obrigação.');
  }
  return new Error(error.message || 'Não foi possível salvar a obrigação.');
};

export const obrigacoesKeys = {
  all: ['parametrizacao', 'obrigacoes-unificadas'] as const,
  list: () => [...obrigacoesKeys.all, 'list'] as const,
  summary: () => [...obrigacoesKeys.all, 'summary'] as const,
};

export const obrigacoesService = {
  async list(): Promise<ObrigacaoModelo[]> {
    const { data, error } = await supabase.rpc(LIST_RPC);
    if (error) throw new Error(error.message || 'Não foi possível carregar as obrigações.');
    if (!Array.isArray(data)) throw new Error('O banco retornou um catálogo de obrigações inválido.');
    return data.map(normalizeObrigacao);
  },

  async summary(): Promise<ObrigacoesResumo> {
    const { data, error } = await supabase.rpc(SUMMARY_RPC);
    if (error) throw new Error(error.message || 'Não foi possível carregar o resumo das obrigações.');
    return normalizeObrigacoesResumo(data);
  },

  async save(draft: ObrigacaoModeloDraft): Promise<ObrigacaoModelo> {
    const { data, error } = await supabase.rpc(SAVE_RPC, {
      p_payload: buildObrigacaoPayload(draft),
    });
    if (error) throw mapSaveError(error);
    return normalizeObrigacao(data);
  },
};
