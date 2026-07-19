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
  asaas_cobranca_id: string | null;
};

export const baixarManualCobranca = async (dados: ManualSettlementInput): Promise<void> => {
  const { data: charge, error: chargeError } = await supabase
    .from('financeiro_cobrancas')
    .select('valor,asaas_cobranca_id')
    .eq('id', dados.cobrancaId)
    .single();
  if (chargeError) throw new Error(`Erro ao validar cobrança: ${chargeError.message}`);

  const cobranca = charge as SettlementCharge;
  if (cobranca.asaas_cobranca_id) {
    const isExactSettlement = !dados.baixarParcial
      && dados.desconto === 0
      && dados.juros === 0
      && Math.abs(dados.valorRecebido - Number(cobranca.valor)) < 0.005;
    if (!isExactSettlement || dados.contaBancariaId) {
      throw new Error('Cobranças Asaas aceitam apenas baixa integral sem ajustes. A conciliação bancária deve ser feita após o retorno do provedor.');
    }

    // A Edge Function cancela o pagamento externo antes de confirmar a baixa
    // local. Se o provedor falhar, nada é marcado como pago no sistema.
    const { data, error } = await supabase.functions.invoke('asaas-manual-settlement', {
      body: { cobranca_id: dados.cobrancaId },
    });
    if (error) throw new Error(`Falha ao cancelar a cobrança no Asaas: ${error.message}`);
    if (!data?.ok) throw new Error(data?.error || 'O Asaas não confirmou o cancelamento da cobrança.');
    return;
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
