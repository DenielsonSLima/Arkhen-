import { supabase } from '../../../../lib/supabase';
import type { NivelRiscoOperacional } from './painelOperacionalService';

export interface TarefaProgressoOperacional {
  tarefaId: string;
  clienteId?: string;
  competencia?: string;
  etapasTotal: number;
  etapasConcluidas: number;
  percentual: number;
  prazoLegal?: string;
  prazoInterno?: string;
  diasEmAtraso: number;
  diasParaVencimento: number;
  nivelRisco?: NivelRiscoOperacional;
  pendenciaRegistrada: boolean;
  evidenciaRegistrada: boolean;
  revisaoPendente: boolean;
  ultimaMovimentacao?: string;
}

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const boundedInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
};

const signedInteger = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value);
};

const optionalText = (value: unknown) => (
  typeof value === 'string' && value.trim() ? value.trim() : undefined
);

const RISK_LEVELS = new Set<NivelRiscoOperacional>([
  'critico', 'alto', 'medio', 'baixo', 'concluido',
]);

const normalizeProgress = (value: unknown): TarefaProgressoOperacional | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as JsonRecord;
  const tarefaId = typeof item.tarefaId === 'string' ? item.tarefaId.trim() : '';
  if (!UUID_PATTERN.test(tarefaId)) return null;

  const etapasTotal = boundedInteger(item.etapasTotal);
  const risk = optionalText(item.nivelRisco) as NivelRiscoOperacional | undefined;
  return {
    tarefaId,
    clienteId: optionalText(item.clienteId),
    competencia: optionalText(item.competencia),
    etapasTotal,
    etapasConcluidas: Math.min(etapasTotal, boundedInteger(item.etapasConcluidas)),
    percentual: boundedInteger(item.percentual, 100),
    prazoLegal: optionalText(item.prazoLegal),
    prazoInterno: optionalText(item.prazoInterno),
    diasEmAtraso: boundedInteger(item.diasEmAtraso),
    diasParaVencimento: signedInteger(item.diasParaVencimento),
    nivelRisco: risk && RISK_LEVELS.has(risk) ? risk : undefined,
    pendenciaRegistrada: item.pendenciaRegistrada === true,
    evidenciaRegistrada: item.evidenciaRegistrada === true,
    revisaoPendente: item.revisaoPendente === true,
    ultimaMovimentacao: optionalText(item.ultimaMovimentacao),
  };
};

export const normalizeTarefasProgresso = (value: unknown) => {
  const result = new Map<string, TarefaProgressoOperacional>();
  if (!Array.isArray(value)) return result;

  value.forEach((entry) => {
    const progress = normalizeProgress(entry);
    if (progress) result.set(progress.tarefaId, progress);
  });
  return result;
};

export const tarefasProgressoService = {
  async getAll() {
    const { data, error } = await supabase.rpc('obter_progresso_tarefas_operacionais');
    if (error) throw error;
    return normalizeTarefasProgresso(data);
  },
};
