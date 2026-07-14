import { supabase } from '../../../../lib/supabase';
import type { ClienteEmpresa, HistoricoPlanejamento } from './planejamento.types';

export interface ResultadoComparacao {
  regime: string;
  tipo: 'economia' | 'custo_adicional' | 'igual';
  valor: number;
}

export interface ResultadoRegime {
  regime: string;
  aliquotaEfetiva: number;
  impostoAnual: number;
  impostoMensal: number;
  descricao: string;
  vantagens: string[];
  desvantagens: string[];
  comparacoes: ResultadoComparacao[];
}

export interface ComparativoRegimes {
  faturamentoAnual: number;
  resultados: ResultadoRegime[];
  regimeSugerido: string;
  economiaEstimada: number;
  recomendacaoMotivos: string[];
  limiteSimplesNacional: number;
}

export interface DiagnosticoTributario {
  regimeAtual: string;
  regimeRecomendado: string;
  economiaAnual: number;
  grauRecomendacao: string;
  estrelas: number;
  confiancaAnalise: number;
  explicacoes: string[];
  pontosAtencao: string[];
}

export interface ConsultaEnquadramentoSimples {
  anexo: string;
  anexoLabel: string;
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  valorDeduzir: number;
  distanciaProximaFaixa: number;
  mensagem: string;
}

export const emptyComparativo: ComparativoRegimes = {
  faturamentoAnual: 0,
  resultados: [],
  regimeSugerido: 'Aguardando cálculo',
  economiaEstimada: 0,
  recomendacaoMotivos: [],
  limiteSimplesNacional: 4800000,
};

export const emptyDiagnostico: DiagnosticoTributario = {
  regimeAtual: 'Não informado', regimeRecomendado: 'Aguardando cálculo', economiaAnual: 0,
  grauRecomendacao: 'Aguardando cálculo', estrelas: 0, confiancaAnalise: 0, explicacoes: [], pontosAtencao: [],
};

export const emptyEnquadramento: ConsultaEnquadramentoSimples = {
  anexo: 'III', anexoLabel: 'Anexo III', faixa: 1, limiteInferior: 0, limiteSuperior: 180000,
  aliquotaNominal: 0, aliquotaEfetiva: 0, valorDeduzir: 0, distanciaProximaFaixa: 0, mensagem: 'Aguardando cálculo.',
};

export async function rpc_calcularComparativoRegimes(faturamentoAnual: number, anexoSimples = 'III'): Promise<ComparativoRegimes> {
  const { data, error } = await supabase.rpc('calcular_planejamento_tributario', {
    p_faturamento_anual: faturamentoAnual,
    p_anexo: anexoSimples,
  });
  if (error) throw new Error(`Erro ao calcular planejamento tributário: ${error.message}`);
  return data as ComparativoRegimes;
}

export async function rpc_consultarEnquadramentoSimples(faturamento12Meses: number, anexoSimples = 'III'): Promise<ConsultaEnquadramentoSimples> {
  const { data, error } = await supabase.rpc('consultar_enquadramento_simples_json', {
    p_faturamento_12: faturamento12Meses,
    p_anexo: anexoSimples,
  });
  if (error) throw new Error(`Erro ao consultar enquadramento: ${error.message}`);
  return data as ConsultaEnquadramentoSimples;
}

export async function rpc_gerarDiagnosticoTributario(cliente: ClienteEmpresa, comparativo: ComparativoRegimes): Promise<DiagnosticoTributario> {
  const { data, error } = await supabase.rpc('gerar_diagnostico_tributario_json', {
    p_cliente: cliente,
    p_comparativo: comparativo,
  });
  if (error) throw new Error(`Erro ao gerar diagnóstico tributário: ${error.message}`);
  return data as DiagnosticoTributario;
}

export async function getPlanejamentoClientes(): Promise<ClienteEmpresa[]> {
  const { data, error } = await supabase.rpc('get_planejamento_clientes');
  if (error) throw new Error(`Erro ao carregar clientes do planejamento: ${error.message}`);
  return Array.isArray(data) ? data as ClienteEmpresa[] : [];
}

export async function getPlanejamentoHistorico(): Promise<HistoricoPlanejamento[]> {
  const { data, error } = await supabase.rpc('get_planejamento_historico');
  if (error) throw new Error(`Erro ao carregar histórico do planejamento: ${error.message}`);
  return Array.isArray(data) ? data as HistoricoPlanejamento[] : [];
}

export async function salvarPlanejamento(clienteId: string, observacao?: string): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_planejamento_tributario', {
    p_cliente_id: clienteId,
    p_observacao: observacao || null,
  });
  if (error) throw new Error(`Erro ao salvar planejamento tributário: ${error.message}`);
  return String(data);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}
