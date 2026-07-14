import { supabase } from '../../../../lib/supabase';

export interface FaturamentoReportData {
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  taxaInadimplencia: number;
  historicoMensal: { mes: string; faturado: number; recebido: number; inadimplente: number }[];
  clientesMaisFaturados: { nome: string; valor: number }[];
}

export interface ConformidadeReportData {
  totalObrigacoes: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxaConformidade: number;
  distribuicaoObrigacoes: { nome: string; total: number; concluidas: number }[];
}

export interface PessoalReportData {
  totalFuncionarios: number;
  funcionariosAtivos: number;
  custoFolhaMensal: number;
  mediaSalarial: number;
  documentosPendentes: number;
  distribuicaoCargos: { cargo: string; count: number }[];
}

export interface ComparativoRegimeData {
  regime: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  aliquotaEfetiva: number;
  impostoTotal: number;
  custoPrevidenciario: number;
  custoTotal: number;
  recomendado: boolean;
}

const asRecord = (data: unknown): Record<string, unknown> => (
  data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
);

const asNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const clientId = (value: string): string | null => value === 'Todos' ? null : value;
const optionalDate = (value: string): string | null => value || null;

const mapFaturamento = (data: unknown): FaturamentoReportData => {
  const row = asRecord(data);
  return {
    totalFaturado: asNumber(row.totalFaturado),
    totalRecebido: asNumber(row.totalRecebido),
    totalPendente: asNumber(row.totalPendente),
    taxaInadimplencia: asNumber(row.taxaInadimplencia),
    historicoMensal: asArray<FaturamentoReportData['historicoMensal'][number]>(row.historicoMensal),
    clientesMaisFaturados: asArray<FaturamentoReportData['clientesMaisFaturados'][number]>(row.clientesMaisFaturados),
  };
};

const mapConformidade = (data: unknown): ConformidadeReportData => {
  const row = asRecord(data);
  return {
    totalObrigacoes: asNumber(row.totalObrigacoes),
    concluidas: asNumber(row.concluidas),
    pendentes: asNumber(row.pendentes),
    atrasadas: asNumber(row.atrasadas),
    taxaConformidade: asNumber(row.taxaConformidade),
    distribuicaoObrigacoes: asArray<ConformidadeReportData['distribuicaoObrigacoes'][number]>(row.distribuicaoObrigacoes),
  };
};

const mapPessoal = (data: unknown): PessoalReportData => {
  const row = asRecord(data);
  return {
    totalFuncionarios: asNumber(row.totalFuncionarios),
    funcionariosAtivos: asNumber(row.funcionariosAtivos),
    custoFolhaMensal: asNumber(row.custoFolhaMensal),
    mediaSalarial: asNumber(row.mediaSalarial),
    documentosPendentes: asNumber(row.documentosPendentes),
    distribuicaoCargos: asArray<PessoalReportData['distribuicaoCargos'][number]>(row.distribuicaoCargos),
  };
};

export const relatoriosService = {
  async getFaturamentoReport(companyId: string, startDate: string, endDate: string): Promise<FaturamentoReportData> {
    const { data, error } = await supabase.rpc('get_relatorio_faturamento_json', {
      p_cliente_id: clientId(companyId),
      p_data_inicio: optionalDate(startDate),
      p_data_fim: optionalDate(endDate),
    });
    if (error) throw new Error(`Erro ao gerar relatório de faturamento: ${error.message}`);
    return mapFaturamento(data);
  },

  async getConformidadeReport(companyId: string): Promise<ConformidadeReportData> {
    const { data, error } = await supabase.rpc('get_relatorio_conformidade_json', {
      p_cliente_id: clientId(companyId),
    });
    if (error) throw new Error(`Erro ao gerar relatório de conformidade: ${error.message}`);
    return mapConformidade(data);
  },

  async getPessoalReport(companyId: string): Promise<PessoalReportData> {
    const { data, error } = await supabase.rpc('get_relatorio_pessoal_json', {
      p_cliente_id: clientId(companyId),
    });
    if (error) throw new Error(`Erro ao gerar relatório de pessoal: ${error.message}`);
    return mapPessoal(data);
  },

  async calcularComparativoRegimes(faturamentoAnual: number, custoFolhaAnual: number): Promise<ComparativoRegimeData[]> {
    const { data, error } = await supabase.rpc('calcular_comparativo_regimes_json', {
      p_faturamento_anual: faturamentoAnual,
      p_custo_folha_anual: custoFolhaAnual,
    });
    if (error) throw new Error(`Erro ao calcular comparativo tributário: ${error.message}`);
    return asArray<ComparativoRegimeData>(data).map((item) => ({
      ...item,
      aliquotaEfetiva: asNumber(item.aliquotaEfetiva),
      impostoTotal: asNumber(item.impostoTotal),
      custoPrevidenciario: asNumber(item.custoPrevidenciario),
      custoTotal: asNumber(item.custoTotal),
    }));
  },
};
