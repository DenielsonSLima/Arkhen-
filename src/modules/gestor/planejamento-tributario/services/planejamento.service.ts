// ============================================================
// SERVICE — Planejamento Tributário
// Funções de cálculo isoladas (prontas para virar supabase.rpc())
// REGRA: Frontend nunca faz cálculo. Estas funções simulam RPCs.
// ============================================================

import type { AnexoDasParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

const LIMITE_SIMPLES_NACIONAL = 4800000;

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

export interface ClienteAnaliseTributariaInput {
  regimeAtual: string;
  faturamento12Meses: number;
  folhaPagamentoMensal: number;
  funcionarios: number;
  cnaeDescricao: string;
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

/**
 * RPC simulado: Calcula a carga tributária estimada para os três regimes
 * Futuramente: supabase.rpc('calcular_comparativo_regimes', { p_faturamento_anual })
 */
export function rpc_calcularComparativoRegimes(
  faturamentoAnual: number,
  anexoSimples: string = 'III',
  anexosConfig?: AnexoDasParametro[],
): ComparativoRegimes {
  // Simples Nacional — cálculo simplificado por faixa
  const anexoConfig = anexosConfig?.find((anexo) => anexo.id === anexoSimples);
  const faixasSN = anexoConfig?.faixas.length
    ? anexoConfig.faixas
    : [
        { limiteSuperior: 180000, aliquota: 6.0, deducao: 0 },
        { limiteSuperior: 360000, aliquota: 11.2, deducao: 9360 },
        { limiteSuperior: 720000, aliquota: 13.5, deducao: 17640 },
        { limiteSuperior: 1800000, aliquota: 16.0, deducao: 35640 },
        { limiteSuperior: 3600000, aliquota: 21.0, deducao: 125640 },
        { limiteSuperior: 4800000, aliquota: 33.0, deducao: 648000 },
      ];
  const faixaSN = faixasSN.find((faixa) => faturamentoAnual <= faixa.limiteSuperior) ?? faixasSN[faixasSN.length - 1];
  const aliquotaSN = faixaSN.aliquota;
  const deducaoSN = faixaSN.deducao;

  const aliquotaEfetivaSN = faturamentoAnual > 0
    ? ((faturamentoAnual * (aliquotaSN / 100) - deducaoSN) / faturamentoAnual) * 100
    : 0;
  const impostoSN = faturamentoAnual * (aliquotaSN / 100) - deducaoSN;

  // Lucro Presumido — presunção 32% serviços, alíquota efetiva ~11.33%
  const presuncaoLP = 0.32;
  const aliquotaIRPJ_LP = 0.15;
  const aliquotaCSLL_LP = 0.09;
  const aliquotaPIS_LP = 0.0065;
  const aliquotaCOFINS_LP = 0.03;
  const basePresumidaLP = faturamentoAnual * presuncaoLP;
  const impostoLP =
    basePresumidaLP * aliquotaIRPJ_LP +
    basePresumidaLP * aliquotaCSLL_LP +
    faturamentoAnual * aliquotaPIS_LP +
    faturamentoAnual * aliquotaCOFINS_LP;
  const aliquotaEfetivaLP = faturamentoAnual > 0 ? (impostoLP / faturamentoAnual) * 100 : 0;

  // Lucro Real — estimativa com margem líquida de 20%
  const margemLiquidaLR = 0.20;
  const lucroRealEstimado = faturamentoAnual * margemLiquidaLR;
  const aliquotaIRPJ_LR = lucroRealEstimado > 240000 ? 0.25 : 0.15;
  const aliquotaCSLL_LR = 0.09;
  const aliquotaPIS_LR = 0.0165;
  const aliquotaCOFINS_LR = 0.076;
  const impostoLR =
    lucroRealEstimado * aliquotaIRPJ_LR +
    lucroRealEstimado * aliquotaCSLL_LR +
    faturamentoAnual * aliquotaPIS_LR +
    faturamentoAnual * aliquotaCOFINS_LR;
  const aliquotaEfetivaLR = faturamentoAnual > 0 ? (impostoLR / faturamentoAnual) * 100 : 0;

  const resultadosBase: Omit<ResultadoRegime, 'comparacoes'>[] = [
    {
      regime: 'Simples Nacional',
      aliquotaEfetiva: Math.max(0, aliquotaEfetivaSN),
      impostoAnual: Math.max(0, impostoSN),
      impostoMensal: Math.max(0, impostoSN / 12),
      descricao: `Anexo ${anexoSimples} — Recolhimento unificado via DAS`,
      vantagens: ['Guia única (DAS)', 'Menos obrigações acessórias', 'Crédito de ICMS facilitado'],
      desvantagens: ['Limite de faturamento R$4,8M/ano', 'Teto de alíquota pode ser alto'],
    },
    {
      regime: 'Lucro Presumido',
      aliquotaEfetiva: aliquotaEfetivaLP,
      impostoAnual: impostoLP,
      impostoMensal: impostoLP / 12,
      descricao: 'Base de cálculo presumida — IRPJ + CSLL + PIS + COFINS',
      vantagens: ['Previsibilidade', 'Adequado para margens altas', 'Sem limite de faturamento'],
      desvantagens: ['Mais obrigações (SPED, EFD)', 'PIS/COFINS cumulativo sem créditos'],
    },
    {
      regime: 'Lucro Real',
      aliquotaEfetiva: aliquotaEfetivaLR,
      impostoAnual: impostoLR,
      impostoMensal: impostoLR / 12,
      descricao: 'Base real de lucro — créditos de PIS/COFINS não-cumulativos',
      vantagens: ['Créditos de PIS/COFINS', 'Ideal para margens baixas', 'Prejuízo compensável'],
      desvantagens: ['Maior complexidade', 'Mais contadores necessários', 'Risco de autuações'],
    },
  ];

  const resultados: ResultadoRegime[] = resultadosBase.map((resultado) => ({
    ...resultado,
    comparacoes: resultadosBase
      .filter((comparado) => comparado.regime !== resultado.regime)
      .map((comparado) => {
        const diferenca = comparado.impostoAnual - resultado.impostoAnual;
        return {
          regime: comparado.regime,
          tipo: diferenca > 0 ? 'economia' : diferenca < 0 ? 'custo_adicional' : 'igual',
          valor: Math.abs(diferenca),
        };
      }),
  }));

  const ordenados = [...resultados].sort((a, b) => a.impostoAnual - b.impostoAnual);
  const melhor = ordenados[0];
  const segundo = ordenados[1];
  const economiaEstimada = segundo.impostoAnual - melhor.impostoAnual;
  const recomendacaoMotivos = getMotivosRecomendacao(melhor.regime, faturamentoAnual, anexoSimples);

  return {
    faturamentoAnual,
    resultados,
    regimeSugerido: melhor.regime,
    economiaEstimada: Math.max(0, economiaEstimada),
    recomendacaoMotivos,
    limiteSimplesNacional: LIMITE_SIMPLES_NACIONAL,
  };
}

export function rpc_consultarEnquadramentoSimples(
  faturamento12Meses: number,
  anexoSimples: string = 'III',
  anexosConfig?: AnexoDasParametro[],
): ConsultaEnquadramentoSimples {
  const anexoConfig = anexosConfig?.find((anexo) => anexo.id === anexoSimples);
  const faixas = anexoConfig?.faixas.length
    ? anexoConfig.faixas
    : [
        { faixa: 1, limiteSuperior: 180000, aliquota: 6.0, deducao: 0 },
        { faixa: 2, limiteSuperior: 360000, aliquota: 11.2, deducao: 9360 },
        { faixa: 3, limiteSuperior: 720000, aliquota: 13.5, deducao: 17640 },
        { faixa: 4, limiteSuperior: 1800000, aliquota: 16.0, deducao: 35640 },
        { faixa: 5, limiteSuperior: 3600000, aliquota: 21.0, deducao: 125640 },
        { faixa: 6, limiteSuperior: 4800000, aliquota: 33.0, deducao: 648000 },
      ];
  const faixaIndex = faixas.findIndex((faixa) => faturamento12Meses <= faixa.limiteSuperior);
  const index = faixaIndex >= 0 ? faixaIndex : faixas.length - 1;
  const faixa = faixas[index];
  const limiteInferior = index === 0 ? 0 : faixas[index - 1].limiteSuperior + 0.01;
  const aliquotaEfetiva = faturamento12Meses > 0
    ? Math.max(0, ((faturamento12Meses * (faixa.aliquota / 100)) - faixa.deducao) / faturamento12Meses * 100)
    : 0;
  const distanciaProximaFaixa = Math.max(0, faixa.limiteSuperior - faturamento12Meses);

  return {
    anexo: anexoSimples,
    anexoLabel: anexoConfig?.label ?? `Anexo ${anexoSimples}`,
    faixa: faixa.faixa,
    limiteInferior,
    limiteSuperior: faixa.limiteSuperior,
    aliquotaNominal: faixa.aliquota,
    aliquotaEfetiva,
    valorDeduzir: faixa.deducao,
    distanciaProximaFaixa,
    mensagem: faturamento12Meses > LIMITE_SIMPLES_NACIONAL
      ? 'Faturamento acima do limite anual do Simples Nacional.'
      : `Enquadramento encontrado no ${anexoConfig?.label ?? `Anexo ${anexoSimples}`}, faixa ${faixa.faixa}.`,
  };
}

function getMotivosRecomendacao(regime: string, faturamentoAnual: number, anexoSimples: string): string[] {
  const motivos = ['Menor carga tributária'];

  if (regime === 'Simples Nacional') {
    if (faturamentoAnual <= LIMITE_SIMPLES_NACIONAL) {
      motivos.push('Empresa abaixo do limite do Simples Nacional');
    }
    motivos.push('Menos obrigações acessórias');
    motivos.push(['III', 'V'].includes(anexoSimples) ? 'Melhor para empresas de software e serviços' : 'Boa aderência ao anexo selecionado');
    return motivos;
  }

  if (regime === 'Lucro Presumido') {
    motivos.push('Previsibilidade na base de cálculo');
    motivos.push('Boa opção para margens de lucro altas');
    motivos.push('Sem limite anual de faturamento');
    return motivos;
  }

  motivos.push('Permite aproveitar créditos de PIS/COFINS');
  motivos.push('Melhor para margens líquidas menores');
  motivos.push('Adequado para estruturas com custos dedutíveis');
  return motivos;
}

export function rpc_gerarDiagnosticoTributario(
  cliente: ClienteAnaliseTributariaInput,
  comparativo: ComparativoRegimes,
): DiagnosticoTributario {
  const regimeAtual = comparativo.resultados.find((resultado) => resultado.regime === cliente.regimeAtual);
  const economiaAnual = regimeAtual
    ? Math.max(0, regimeAtual.impostoAnual - comparativo.resultados.find((resultado) => resultado.regime === comparativo.regimeSugerido)!.impostoAnual)
    : comparativo.economiaEstimada;
  const economiaSobreAtual = regimeAtual?.impostoAnual ? economiaAnual / regimeAtual.impostoAnual : 0;
  const estrelas = getEstrelasRecomendacao(economiaAnual, economiaSobreAtual, cliente.regimeAtual !== comparativo.regimeSugerido);
  const confiancaAnalise = getConfiancaAnalise(economiaSobreAtual, cliente.faturamento12Meses, cliente.funcionarios);

  return {
    regimeAtual: cliente.regimeAtual,
    regimeRecomendado: comparativo.regimeSugerido,
    economiaAnual,
    grauRecomendacao: getGrauRecomendacao(estrelas),
    estrelas,
    confiancaAnalise,
    explicacoes: getExplicacoesRecomendacao(cliente, comparativo, economiaAnual),
    pontosAtencao: getPontosAtencao(cliente, comparativo),
  };
}

function getEstrelasRecomendacao(economiaAnual: number, economiaSobreAtual: number, existeMudanca: boolean): number {
  if (!existeMudanca) return 4;
  if (economiaAnual >= 10000 || economiaSobreAtual >= 0.08) return 5;
  if (economiaAnual >= 5000 || economiaSobreAtual >= 0.04) return 4;
  if (economiaAnual >= 1500 || economiaSobreAtual >= 0.015) return 3;
  return 2;
}

function getGrauRecomendacao(estrelas: number): string {
  if (estrelas >= 5) return 'Muito alta';
  if (estrelas === 4) return 'Alta';
  if (estrelas === 3) return 'Moderada';
  return 'Baixa';
}

function getConfiancaAnalise(economiaSobreAtual: number, faturamento12Meses: number, funcionarios: number): number {
  const base = 86;
  const ganhoPorEconomia = Math.min(8, Math.round(economiaSobreAtual * 70));
  const ganhoPorDados = faturamento12Meses > 0 && funcionarios >= 0 ? 2 : 0;
  return Math.min(96, base + ganhoPorEconomia + ganhoPorDados);
}

function getExplicacoesRecomendacao(
  cliente: ClienteAnaliseTributariaInput,
  comparativo: ComparativoRegimes,
  economiaAnual: number,
): string[] {
  const recomendacao = comparativo.regimeSugerido;
  const atividade = cliente.cnaeDescricao.toLowerCase();
  const explicacoes = [
    cliente.regimeAtual === recomendacao
      ? `A empresa já está no regime que apresentou a menor carga tributária estimada.`
      : `O faturamento já está em uma faixa onde o ${recomendacao} ficou mais vantajoso.`,
  ];

  if (atividade.includes('software') && recomendacao === 'Lucro Presumido') {
    explicacoes.push('A atividade de desenvolvimento de software possui boa tributação nesse regime.');
  } else if (cliente.folhaPagamentoMensal > 0) {
    explicacoes.push('A folha de pagamento foi considerada como um ponto relevante para revisar o enquadramento.');
  } else {
    explicacoes.push('A atividade informada tem boa aderência ao regime recomendado na simulação.');
  }

  explicacoes.push(`A diferença estimada é de aproximadamente ${formatCurrency(economiaAnual)} por ano.`);
  return explicacoes;
}

function getPontosAtencao(
  cliente: ClienteAnaliseTributariaInput,
  comparativo: ComparativoRegimes,
): string[] {
  const pontos = ['Se o faturamento diminuir, o Simples pode voltar a ser vantajoso.', 'Recalcular essa análise em Janeiro.'];

  if (comparativo.regimeSugerido !== 'Simples Nacional') {
    pontos.push('Verificar margem de lucro antes da migração.');
  }

  if (cliente.faturamento12Meses > LIMITE_SIMPLES_NACIONAL * 0.8 && cliente.regimeAtual === 'Simples Nacional') {
    pontos.push('Acompanhar proximidade do limite anual do Simples Nacional.');
  }

  return pontos;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}
