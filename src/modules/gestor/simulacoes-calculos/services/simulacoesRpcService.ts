import { supabase } from '../../../../lib/supabase';
import type { ResultadoRescisao } from './calculos.service';

export interface ResultadosSimulacoes {
  rescisao: ResultadoRescisao;
}

export interface SimulacaoEnvelope<T> {
  tipo: string;
  competencia: string;
  versoesParametros: Array<{ codigo: string; versao: string | number }>;
  resultado: T;
  memoriaCalculo: Array<{ descricao: string; base?: number; aliquota?: number | null; valor: number }>;
  alertas: string[];
  estimativa: boolean;
  historicoId?: string;
}

export const EMPTY_RESULTADO_RESCISAO: ResultadoRescisao = {
  tipo: '',
  salarioBaseCalculo: 0,
  adicionalTempoServico: 0,
  saldoSalario: 0,
  decimoTerceiroProporcional: 0,
  feriasProporcionais: 0,
  adicionalFerias: 0,
  feriasVencidas: 0,
  adicionalFeriasVencidas: 0,
  avisoPrevio: 0,
  avisoPrevioDesconto: 0,
  multaFGTS: 0,
  totalBruto: 0,
  inssRescisao: 0,
  irrfRescisao: 0,
  totalDescontos: 0,
  totalLiquido: 0,
};

export async function calcularSimulacaoRescisao(
  parametros: Record<string, unknown>,
): Promise<SimulacaoEnvelope<ResultadoRescisao>> {
  const { data, error } = await supabase.rpc('simular_rescisao', { p: parametros });
  if (error) throw new Error(`Erro ao calcular rescisão: ${error.message}`);
  return data as SimulacaoEnvelope<ResultadoRescisao>;
}
