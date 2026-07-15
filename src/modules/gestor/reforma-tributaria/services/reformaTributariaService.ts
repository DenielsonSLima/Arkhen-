import { supabase } from '../../../../lib/supabase';
import type {
  AdequacaoInput,
  ChecklistItemId,
  ReformaHistorico,
  ReformaPainel,
  SimulacaoResponse,
  XmlValidationResult,
} from './reformaTributaria.types';
import { extractRtcXml } from './xmlFiscalExtractor';

const rpc = async <T>(name: string, params?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
};

export const reformaTributariaService = {
  getPainel: () => rpc<ReformaPainel>('listar_reforma_tributaria_painel'),
  getHistorico: (clienteId?: string | null) => rpc<ReformaHistorico>('listar_reforma_tributaria_historico', {
    p_cliente_id: clienteId || null,
  }),
  saveAdequacao: (input: AdequacaoInput) => rpc<void>('salvar_reforma_tributaria_adequacao', {
    p_cliente_id: input.clienteId,
    p_payload: input,
  }),
  toggleChecklist: (clienteId: string, item: ChecklistItemId, concluido: boolean) => (
    rpc<string>('atualizar_reforma_tributaria_checklist', {
      p_cliente_id: clienteId,
      p_item: item,
      p_concluido: concluido,
    })
  ),
  validateXml: async (clienteId: string, file: File) => {
    const payload = await extractRtcXml(file);
    return rpc<XmlValidationResult>('validar_reforma_tributaria_xml', {
      p_cliente_id: clienteId,
      p_payload: payload,
    });
  },
  simulateIbsCbs: (clienteId: string, input: Record<string, string>) => (
    rpc<SimulacaoResponse>('salvar_reforma_simulacao_ibs_cbs', {
      p_cliente_id: clienteId,
      p_entrada: input,
    })
  ),
  simulateSplitPayment: (clienteId: string, input: Record<string, string>) => (
    rpc<SimulacaoResponse>('salvar_reforma_simulacao_split_payment', {
      p_cliente_id: clienteId,
      p_entrada: input,
    })
  ),
  saveDecisao: (clienteId: string, input: Record<string, string | null>) => (
    rpc<string>('salvar_reforma_tributaria_decisao', {
      p_cliente_id: clienteId,
      p_payload: input,
    })
  ),
};
