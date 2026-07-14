import { supabase } from '../../../../lib/supabase';
import type {
  ResultadoDAS, ResultadoFolha, ResultadoMulta, ResultadoPisCofins,
  ResultadoProLabore, ResultadoRescisao,
} from './calculos.service';
import type {
  ResultadoComparativoRegime, ResultadoContratacao, ResultadoCustos,
  ResultadoEncargos, ResultadoFerias, ResultadoSimulacaoImposto, ResultadoTempoEmpresa,
} from './calculosNovas.service';

export interface ResultadosSimulacoes {
  folha: ResultadoFolha;
  rescisao: ResultadoRescisao;
  prolabore: ResultadoProLabore;
  das: ResultadoDAS;
  piscofins: ResultadoPisCofins;
  multas: ResultadoMulta;
  ferias: ResultadoFerias;
  'tempo-empresa': ResultadoTempoEmpresa;
  'encargos-trabalhistas': ResultadoEncargos;
  'simulacao-contratacao': ResultadoContratacao;
  'comparativo-regime': ResultadoComparativoRegime;
  'simulacao-imposto': ResultadoSimulacaoImposto;
  'simulacao-custos': ResultadoCustos;
}

export const EMPTY_RESULTADOS: ResultadosSimulacoes = {
  folha: {
    salarioBruto: 0, totalVencimentos: 0, descontosFuncionario: 0, encargosEmpresa: 0,
    inss: 0, baseIRRF: 0, irrf: 0, fgts: 0, encargosPrevidenciarios: 0, beneficiosEmpresa: 0,
    valeTransporteDesconto: 0, valeAlimentacaoDesconto: 0, planoSaudeDesconto: 0,
    odontologicoDesconto: 0, pensaoAlimenticia: 0, faltas: 0, descontoManual: 0,
    adicionalManual: 0, horasExtrasTotal: 0, adicionalNoturno: 0, insalubridade: 0,
    adicionalTempoServico: 0, salarioFamilia: 0, salarioLiquido: 0, custoEmpregador: 0,
    observacoes: [], detalhamento: { tipoFuncionarioLabel: '', competenciaLabel: '', regiaoLabel: '',
      fgtsPercentual: 0, encargosPercentual: 0, aliquotaIrrf: 0, faixaIrrfLabel: '', atestadosAbonados: 0 },
  },
  rescisao: { tipo: '', salarioBaseCalculo: 0, adicionalTempoServico: 0, saldoSalario: 0,
    decimoTerceiroProporcional: 0, feriasProporcionais: 0, adicionalFerias: 0, feriasVencidas: 0,
    adicionalFeriasVencidas: 0, avisoPrevio: 0, avisoPrevioDesconto: 0, multaFGTS: 0,
    totalBruto: 0, inssRescisao: 0, irrfRescisao: 0, totalLiquido: 0 },
  prolabore: { valorProLabore: 0, inss: 0, irrf: 0, liquido: 0, cpp: 0, custoEmpresa: 0 },
  das: { faturamento12Meses: 0, faixaNumero: 0, aliquotaNominal: 0, aliquotaEfetiva: 0, valorDAS: 0, valorDeduzir: 0 },
  piscofins: { regime: '', faturamento: 0, creditosApurados: 0, debitoPIS: 0, debitoCOFINS: 0, saldoPIS: 0, saldoCOFINS: 0, totalPagar: 0 },
  multas: { valorOriginal: 0, diasAtraso: 0, jurosPercentual: 0, jurosValor: 0, multaPercentual: 0, multaValor: 0, totalPagar: 0 },
  ferias: { valorFerias: 0, tercoConstitucional: 0, abonoPecuniario: 0, tercoAbono: 0, adiantamento13: 0, totalBruto: 0, inss: 0, irrf: 0, totalLiquido: 0, custoEmpresa: 0 },
  'tempo-empresa': { anos: 0, meses: 0, dias: 0, provisao13: 0, provisaoFerias: 0, provisaoTerco: 0, fgtsAcumulado: 0, multaFgtsProjetada: 0, custoTotalAcumulado: 0 },
  'encargos-trabalhistas': { inssPatronal: 0, ratAjustado: 0, terceirosValor: 0, fgts: 0, provisaoFerias13: 0, totalEncargosValor: 0, totalPercentual: 0 },
  'simulacao-contratacao': { custoCltMensal: 0, custoCltAnual: 0, custoPjMensal: 0, custoPjAnual: 0, custoEstagioMensal: 0, custoEstagioAnual: 0, liquidoClt: 0, liquidoPj: 0, liquidoEstagio: 0 },
  'comparativo-regime': { simplesNacional: 0, lucroPresumido: 0, lucroReal: 0, melhorOpcao: '', melhorOpcaoDesc: '', alertas: [] },
  'simulacao-imposto': { impostoTotal: 0, aliquotaEfetiva: 0, detalheImpostos: [] },
  'simulacao-custos': { pontoEquilibrio: 0, faturamentoAlvo: 0, margemContribuicaoPercentual: 0, lucroEstimado: 0 },
};

export async function calcularSimulacoesContabeis(
  solicitacoes: Record<keyof ResultadosSimulacoes, Record<string, unknown>>,
): Promise<ResultadosSimulacoes> {
  const { data, error } = await supabase.rpc('calcular_simulacoes_contabeis', {
    p_solicitacoes: solicitacoes,
  });
  if (error) throw new Error(`Erro ao calcular simulações: ${error.message}`);
  return data as ResultadosSimulacoes;
}
