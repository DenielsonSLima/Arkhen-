import { supabase } from '../../../../lib/supabase';
import type { FiscalAmbiente, FiscalDraftData } from './faturamentoFiscalTypes';

export interface RecorrenciaConfig {
  meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  descontoPercentual: number; jurosPercentual: number; multaPercentual: number; mensagemBoleto: string;
  diaProcessamento: number; primeiraCompetencia: string; competenciaOffset: 0 | -1;
  modoFiscal: 'sem_nfse' | 'rascunho' | 'na_data' | 'no_pagamento';
  ambiente: FiscalAmbiente; fiscalConfigId: string; dadosFiscais: Partial<FiscalDraftData>;
}
export interface RecorrenciaInput {
  id?: string; clienteEmpresaId: string; descricaoServico: string; valorMensal: number; diaVencimento: number;
  ativo: boolean; recorrenciaAtiva: boolean; gerarPrimeiraCobranca: boolean; recorrenciaConfig: RecorrenciaConfig;
}
export interface RecorrenciaExecucao {
  id: string; contratoId: string; competencia: string; status: string; etapa: string;
  mensagem?: string; cobrancaId?: string; rascunhoId?: string; nfseId?: string;
}
export interface SavedRecorrencia { contrato: { id: string }; execucao?: RecorrenciaExecucao | null }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error('Resposta da recorrência indisponível.');
  return data as T;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
// Only an opaque request identifier is kept in the browser. Terms and recovery live in the database.
export async function recurrenceRequestId(input: RecorrenciaInput, userId: string): Promise<{ id: string; key: string }> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(input)));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `arkhen:recorrencia:${userId}:${fingerprint}`;
  let id: string;
  try {
    const existing = localStorage.getItem(key);
    id = existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing) ? existing : crypto.randomUUID();
    localStorage.setItem(key, id);
  } catch {
    throw new Error('Não foi possível preservar a referência do cadastro neste navegador. Libere o armazenamento antes de salvar a recorrência.');
  }
  return { id, key };
}
export const recorrenciaService = {
  async save(input: RecorrenciaInput) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error('Entre novamente para salvar a recorrência.');
    const request = await recurrenceRequestId(input, data.user.id);
    const { recorrenciaAtiva, recorrenciaConfig, ...contract } = input;
    const saved = await rpc<SavedRecorrencia>('salvar_recorrencia_financeira', { p_request_id: request.id,
      p_payload: { ...contract, automacaoAtiva: recorrenciaAtiva, config: { ...recorrenciaConfig, gerarCobranca: true } } });
    // A storage cleanup failure after a successful RPC must not report that the
    // contract failed: repeating that operation could create a second contract.
    try { localStorage.removeItem(request.key); } catch { /* Same request remains safely reusable. */ }
    return saved;
  },
  list: (contratoId?: string) => rpc<RecorrenciaExecucao[]>('listar_execucoes_recorrencia', { p_contrato_id: contratoId || null }),
  async config(contratoId: string): Promise<RecorrenciaInput> {
    const data = await rpc<Omit<RecorrenciaInput, 'recorrenciaAtiva' | 'recorrenciaConfig'> & { automacaoAtiva: boolean; config: RecorrenciaConfig }>(
      'obter_configuracao_recorrencia', { p_contrato_id: contratoId });
    return { id: data.id, clienteEmpresaId: data.clienteEmpresaId, descricaoServico: data.descricaoServico,
      valorMensal: data.valorMensal, diaVencimento: data.diaVencimento, ativo: data.ativo,
      gerarPrimeiraCobranca: false, recorrenciaAtiva: data.automacaoAtiva, recorrenciaConfig: data.config };
  },
  async run(execucaoId: string) {
    const { data, error } = await supabase.functions.invoke('recurrence-worker', { body: { execucaoId } });
    if (error) {
      const context = 'context' in error ? error.context : null;
      const detail = context instanceof Response ? await context.clone().json().catch(() => null) : null;
      throw new Error(detail?.error || error.message);
    }
    if (!data || data.ok === false) throw new Error(data?.error || 'Processamento não confirmado. Consulte a execução antes de tentar novamente.');
    if (data.pending === true) throw new Error(data.message || 'Nenhuma etapa disponível agora. Confira a situação no histórico da recorrência.');
    return data;
  },
};
