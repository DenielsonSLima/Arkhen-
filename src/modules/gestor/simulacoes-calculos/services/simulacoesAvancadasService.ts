import { supabase } from '../../../../lib/supabase';
import type { SimulacaoEnvelope } from './simulacoesRpcService';

export type SimulacaoAvancada =
  | 'carne-leao'
  | 'irpf'
  | 'lucros-dividendos'
  | 'ganho-capital'
  | 'mei';

const RPCS: Record<SimulacaoAvancada, string> = {
  'carne-leao': 'simular_carne_leao',
  irpf: 'simular_irpf_anual',
  'lucros-dividendos': 'simular_prolabore_dividendos',
  'ganho-capital': 'simular_ganho_capital',
  mei: 'simular_mei',
};

export async function calcularSimulacaoAvancada<T>(
  tipo: SimulacaoAvancada,
  parametros: Record<string, unknown>,
): Promise<SimulacaoEnvelope<T>> {
  const { data, error } = await supabase.rpc(RPCS[tipo], { p: parametros });
  if (error) throw new Error(`Erro ao calcular ${tipo}: ${error.message}`);
  return data as SimulacaoEnvelope<T>;
}

export function versoesComoTexto(versoes: SimulacaoEnvelope<unknown>['versoesParametros']): string {
  if (!versoes?.length) return 'regra vigente';
  return versoes.map((item) => `${item.codigo} v${item.versao}`).join(' · ');
}
