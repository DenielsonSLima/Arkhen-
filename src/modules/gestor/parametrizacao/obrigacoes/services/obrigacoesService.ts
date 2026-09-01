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
const SAVE_RPC = 'salvar_obrigacao_unificada';

const asRecord = (value: unknown): JsonRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
);

const asString = (value: unknown) => typeof value === 'string' ? value : '';

const asInteger = (value: unknown, fallback: number) => (
  typeof value === 'number' && Number.isInteger(value) ? value : fallback
);

const clampDay = (value: unknown, fallback: number) => (
  Math.min(Math.max(asInteger(value, fallback), 1), 31)
);

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
    referenciaMesAnterior: item.referenciaMesAnterior !== false,
    diaPrimeiraQuinzena: clampDay(item.diaPrimeiraQuinzena, 15),
    diaSegundaQuinzena: clampDay(item.diaSegundaQuinzena, 30),
    etapas: normalizeEtapas(item.etapas),
    ativo: item.ativo !== false,
    ordem: asInteger(item.ordem, 100),
    atualizadoEm: asString(item.atualizadoEm).trim() || null,
  };
};

const buildPayload = (draft: ObrigacaoModeloDraft) => ({
  ...(draft.id ? { id: draft.id } : {}),
  ...(draft.codigo ? { codigo: draft.codigo } : {}),
  ...(draft.atualizadoEm ? { atualizadoEm: draft.atualizadoEm } : {}),
  nome: draft.nome.trim(),
  categoria: draft.categoria.trim(),
  orgao: draft.orgao.trim(),
  descricao: draft.descricao.trim(),
  regimes: normalizeRegimes(draft.regimes),
  periodicidade: normalizePeriodicidade(draft.periodicidade),
  origemPadrao: normalizeOrigem(draft.origemPadrao),
  temVencimento: draft.temVencimento,
  diaVencimento: clampDay(draft.diaVencimento, 20),
  referenciaMesAnterior: draft.referenciaMesAnterior,
  diaPrimeiraQuinzena: clampDay(draft.diaPrimeiraQuinzena, 15),
  diaSegundaQuinzena: clampDay(draft.diaSegundaQuinzena, 30),
  etapas: normalizeEtapas(draft.etapas),
  ativo: draft.ativo,
});

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
};

export const obrigacoesService = {
  async list(): Promise<ObrigacaoModelo[]> {
    const { data, error } = await supabase.rpc(LIST_RPC);
    if (error) throw new Error(error.message || 'Não foi possível carregar as obrigações.');
    if (!Array.isArray(data)) throw new Error('O banco retornou um catálogo de obrigações inválido.');
    return data.map(normalizeObrigacao);
  },

  async save(draft: ObrigacaoModeloDraft): Promise<ObrigacaoModelo> {
    const { data, error } = await supabase.rpc(SAVE_RPC, { p_payload: buildPayload(draft) });
    if (error) throw mapSaveError(error);
    return normalizeObrigacao(data);
  },
};
