import { supabase } from '../../../../lib/supabase';

export type ManualSettlementInput = {
  cobrancaId: string;
  dataPagamento: string;
  formaPagamento: string;
  valorRecebido: number;
  desconto: number;
  juros: number;
  observacao: string;
  baixarParcial: boolean;
  contaBancariaId?: string;
};

type SettlementCharge = {
  valor: number | string;
  financeiro_cobrancas_integracoes?: { provedor: string }[];
};

export const baixarManualCobranca = async (dados: ManualSettlementInput): Promise<void> => {
  const { data: charge, error: chargeError } = await supabase
    .from('financeiro_cobrancas')
    .select('valor,financeiro_cobrancas_integracoes(provedor)')
    .eq('id', dados.cobrancaId)
    .single();
  if (chargeError) throw new Error(`Erro ao validar cobrança: ${chargeError.message}`);

  const cobranca = charge as SettlementCharge;
  if (cobranca.financeiro_cobrancas_integracoes?.some((item) => item.provedor === 'inter')) {
    throw new Error('Cobranças Banco Inter são conciliadas pelo webhook. Cancele a cobrança externa antes de registrar uma baixa manual.');
  }

  const { error } = await supabase.rpc('baixar_manual_cobranca_custom', {
    p_cobranca_id: dados.cobrancaId,
    p_data_pagamento: dados.dataPagamento,
    p_forma_pagamento: dados.formaPagamento,
    p_valor_recebido: dados.valorRecebido,
    p_desconto: dados.desconto,
    p_juros: dados.juros,
    p_observacao: dados.observacao,
    p_baixar_parcial: dados.baixarParcial,
    p_conta_bancaria_id: dados.contaBancariaId || null,
  });
  if (error) throw new Error(`Erro ao registrar baixa manual: ${error.message}`);
};
