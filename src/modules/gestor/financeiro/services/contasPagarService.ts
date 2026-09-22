import { supabase } from '../../../../lib/supabase';

export interface ContasPagarResumo {
  pagarHojeVal: number; pagarHojeQty: number;
  emAtrasoVal: number; emAtrasoQty: number;
  pagoNoMesVal: number; pagoNoMesQty: number;
  previstoNoMesVal: number; previstoNoMesQty: number;
  pendenteVal: number; pendenteQty: number;
}
export const EMPTY_CONTAS_PAGAR_RESUMO: ContasPagarResumo = {
  pagarHojeVal: 0, pagarHojeQty: 0, emAtrasoVal: 0, emAtrasoQty: 0,
  pagoNoMesVal: 0, pagoNoMesQty: 0, previstoNoMesVal: 0, previstoNoMesQty: 0,
  pendenteVal: 0, pendenteQty: 0,
};
export const contasPagarService = {
  async getResumo(signal?: AbortSignal): Promise<ContasPagarResumo> {
    const { data, error } = await supabase.rpc('get_contas_pagar_resumo')
      .abortSignal(signal ?? new AbortController().signal);
    if (error) throw new Error(`Erro ao carregar resumo das despesas: ${error.message}`);
    const result = { ...EMPTY_CONTAS_PAGAR_RESUMO };
    for (const key of Object.keys(result) as Array<keyof ContasPagarResumo>) {
      const value = Number(data?.[key]);
      if (!Number.isFinite(value)) throw new Error('Resumo de despesas inválido. Tente novamente.');
      result[key] = value;
    }
    return result;
  },
  async preverPagamento(id: string, desconto: number, juros: number, signal?: AbortSignal): Promise<number> {
    const { data, error } = await supabase.rpc('prever_pagamento_despesa', {
      p_lancamento_id: id, p_desconto: desconto, p_juros: juros,
    }).abortSignal(signal ?? new AbortController().signal);
    if (error) throw new Error(error.message);
    const value = Number(data?.valorPago);
    if (!Number.isFinite(value)) throw new Error('Não foi possível calcular o valor do pagamento.');
    return value;
  },
};
