// ============================================================
// SERVICE — Cálculos Trabalhistas e Fiscais
// Funções puras que simulam RPCs do Supabase
// REGRA: Nenhuma fórmula de cálculo nos componentes .tsx
// ============================================================

import type {
  AnexoDasParametro,
  RegimePisCofinsParametro,
  TipoRescisaoParametro,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

// ── Tabelas INSS 2024 ─────────────────────────────────────
interface FaixaINSS { limite: number; aliquota: number; }
const TABELA_INSS_2024: FaixaINSS[] = [
  { limite: 1518.00, aliquota: 0.075 },
  { limite: 2793.88, aliquota: 0.09 },
  { limite: 4190.83, aliquota: 0.12 },
  { limite: 8157.41, aliquota: 0.14 },
];

// ── Tabela IRRF 2024 ──────────────────────────────────────
interface FaixaIRRF { limite: number; aliquota: number; deducao: number; }
const TABELA_IRRF_2024: FaixaIRRF[] = [
  { limite: 2259.20, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { limite: Infinity, aliquota: 0.275, deducao: 896.00 },
];

const DEDUCAO_DEPENDENTE_IRRF = 189.59;
const TETO_INSS = 908.86;

export interface HoraExtraFolha {
  quantidade: number;
  valorHora: number;
  multiplicador: number;
}

export interface FolhaParamsCalculo {
  tipoFuncionario: string;
  competencia: string;
  regiao: string;
  salarioBruto: number;
  dependentes: number;
  adicionalPericulosidade: number;
  adicionalNoturnoPercentual: number;
  insalubridadePercentual: number;
  adicionalTempoServicoAtivo: boolean;
  adicionalTempoServicoTipo: string;
  adicionalTempoServicoAnos: number;
  adicionalTempoServicoPercentual: number;
  adicionalTempoServicoValor: number;
  horasExtras: HoraExtraFolha[];
  valeTransporteAtivo: boolean;
  valorValeTransporte: number;
  valeAlimentacaoEmpresa: number;
  valeAlimentacaoDesconto: number;
  planoSaudeEmpresa: number;
  planoSaudeDesconto: number;
  odontologicoEmpresa: number;
  odontologicoDesconto: number;
  pensaoAlimenticia: number;
  faltasDias: number;
  atestadosDias: number;
  descontoManualValor: number;
  adicionalManualValor: number;
  salarioComparacao: number;
  aumentoPercentual: number;
}

export interface ResultadoFolhaComparacao {
  salario: number;
  inss: number;
  irrf: number;
  fgts: number;
  salarioLiquido: number;
  custoEmpregador: number;
  diferencaCusto: number;
}

export interface ResultadoFolhaAumento {
  percentual: number;
  novoSalario: number;
  novoCusto: number;
  diferencaMensal: number;
  diferencaAnual: number;
}

export interface ResultadoFolha {
  salarioBruto: number;
  totalVencimentos: number;
  descontosFuncionario: number;
  encargosEmpresa: number;
  inss: number;
  baseIRRF: number;
  irrf: number;
  fgts: number;
  encargosPrevidenciarios: number;
  beneficiosEmpresa: number;
  valeTransporteDesconto: number;
  valeAlimentacaoDesconto: number;
  planoSaudeDesconto: number;
  odontologicoDesconto: number;
  pensaoAlimenticia: number;
  faltas: number;
  descontoManual: number;
  adicionalManual: number;
  horasExtrasTotal: number;
  adicionalNoturno: number;
  insalubridade: number;
  adicionalTempoServico: number;
  salarioFamilia: number;
  salarioLiquido: number;
  custoEmpregador: number;
  comparacao?: ResultadoFolhaComparacao;
  aumento?: ResultadoFolhaAumento;
  observacoes: string[];
  detalhamento: {
    tipoFuncionarioLabel: string;
    competenciaLabel: string;
    regiaoLabel: string;
    fgtsPercentual: number;
    encargosPercentual: number;
    aliquotaIrrf: number;
    faixaIrrfLabel: string;
    atestadosAbonados: number;
  };
}

/**
 * RPC simulado: calcular_folha_pagamento
 * Futuramente: supabase.rpc('calcular_folha', { p_salario, p_dependentes, p_adicional_periculosidade, p_horas_extras })
 */
export function rpc_calcularFolha(params: FolhaParamsCalculo): ResultadoFolha {
  const resultado = calcularFolhaInterna(params);

  if (params.salarioComparacao > 0 && params.salarioComparacao !== params.salarioBruto) {
    const comparado = calcularFolhaInterna({
      ...params,
      salarioBruto: params.salarioComparacao,
      salarioComparacao: 0,
      aumentoPercentual: 0,
    });
    resultado.comparacao = {
      salario: comparado.salarioBruto,
      inss: comparado.inss,
      irrf: comparado.irrf,
      fgts: comparado.fgts,
      salarioLiquido: comparado.salarioLiquido,
      custoEmpregador: comparado.custoEmpregador,
      diferencaCusto: round2(comparado.custoEmpregador - resultado.custoEmpregador),
    };
  }

  if (params.aumentoPercentual > 0) {
    const novoSalario = params.salarioBruto * (1 + params.aumentoPercentual / 100);
    const aumentado = calcularFolhaInterna({
      ...params,
      salarioBruto: novoSalario,
      salarioComparacao: 0,
      aumentoPercentual: 0,
    });
    resultado.aumento = {
      percentual: params.aumentoPercentual,
      novoSalario: round2(novoSalario),
      novoCusto: aumentado.custoEmpregador,
      diferencaMensal: round2(aumentado.custoEmpregador - resultado.custoEmpregador),
      diferencaAnual: round2((aumentado.custoEmpregador - resultado.custoEmpregador) * 12),
    };
  }

  resultado.observacoes = buildObservacoes(resultado, params);
  return resultado;
}

function calcularFolhaInterna(params: FolhaParamsCalculo): ResultadoFolha {
  const tipo = getTipoFuncionarioConfig(params.tipoFuncionario);
  const regiao = getRegiaoConfig(params.regiao);
  const horasExtrasTotal = params.horasExtras.reduce((total, horaExtra) => {
    return total + horaExtra.quantidade * horaExtra.valorHora * horaExtra.multiplicador;
  }, 0);
  const adicionalNoturno = params.salarioBruto * (Math.max(0, params.adicionalNoturnoPercentual) / 100);
  const insalubridade = params.salarioBruto * (Math.max(0, params.insalubridadePercentual) / 100);
  const adicionalTempoServico = calcularAdicionalTempoServico(
    params.salarioBruto,
    params.adicionalTempoServicoAnos,
    params.adicionalTempoServicoAtivo,
    params.adicionalTempoServicoTipo,
    params.adicionalTempoServicoPercentual,
    params.adicionalTempoServicoValor,
  );
  const faltas = Math.max(0, params.faltasDias) * (params.salarioBruto / 30);
  const salarioFamilia = tipo.salarioFamilia && params.salarioBruto <= 1819.26
    ? params.dependentes * 65
    : 0;
  const baseRemuneracao = Math.max(0, params.salarioBruto + params.adicionalPericulosidade
    + adicionalNoturno + insalubridade + adicionalTempoServico + horasExtrasTotal
    + params.adicionalManualValor - faltas);
  const totalVencimentos = baseRemuneracao + salarioFamilia;
  const inss = tipo.inss === 'progressivo'
    ? calcularInssProgressivo(baseRemuneracao)
    : tipo.inss === 'prolabore'
      ? Math.min(baseRemuneracao * 0.11, TETO_INSS)
      : 0;
  const deducaoDependentes = params.dependentes * DEDUCAO_DEPENDENTE_IRRF;
  const baseIRRF = tipo.irrf
    ? Math.max(0, baseRemuneracao - inss - deducaoDependentes - params.pensaoAlimenticia)
    : 0;
  const irrf = tipo.irrf ? calcularIrrf(baseIRRF) : 0;
  const fgts = baseRemuneracao * tipo.fgts;
  const encargosPrevidenciarios = baseRemuneracao * (tipo.encargos + regiao.satFap);
  const beneficiosEmpresa = params.valeAlimentacaoEmpresa + params.planoSaudeEmpresa
    + params.odontologicoEmpresa + (params.valeTransporteAtivo ? params.valorValeTransporte : 0);
  const valeTransporteDesconto = params.valeTransporteAtivo
    ? Math.min(params.valorValeTransporte, params.salarioBruto * 0.06)
    : 0;
  const descontosFuncionario = inss + irrf + valeTransporteDesconto + params.valeAlimentacaoDesconto
    + params.planoSaudeDesconto + params.odontologicoDesconto + params.pensaoAlimenticia
    + params.descontoManualValor;
  const encargosEmpresa = fgts + encargosPrevidenciarios + beneficiosEmpresa;
  const faixaIrrf = getFaixaIrrf(baseIRRF);

  return {
    salarioBruto: round2(baseRemuneracao),
    totalVencimentos: round2(totalVencimentos),
    descontosFuncionario: round2(descontosFuncionario),
    encargosEmpresa: round2(encargosEmpresa),
    inss: round2(inss),
    baseIRRF: round2(baseIRRF),
    irrf: round2(irrf),
    fgts: round2(fgts),
    encargosPrevidenciarios: round2(encargosPrevidenciarios),
    beneficiosEmpresa: round2(beneficiosEmpresa),
    valeTransporteDesconto: round2(valeTransporteDesconto),
    valeAlimentacaoDesconto: round2(params.valeAlimentacaoDesconto),
    planoSaudeDesconto: round2(params.planoSaudeDesconto),
    odontologicoDesconto: round2(params.odontologicoDesconto),
    pensaoAlimenticia: round2(params.pensaoAlimenticia),
    faltas: round2(faltas),
    descontoManual: round2(params.descontoManualValor),
    adicionalManual: round2(params.adicionalManualValor),
    horasExtrasTotal: round2(horasExtrasTotal),
    adicionalNoturno: round2(adicionalNoturno),
    insalubridade: round2(insalubridade),
    adicionalTempoServico: round2(adicionalTempoServico),
    salarioFamilia: round2(salarioFamilia),
    salarioLiquido: round2(totalVencimentos - descontosFuncionario),
    custoEmpregador: round2(baseRemuneracao + encargosEmpresa),
    observacoes: [],
    detalhamento: {
      tipoFuncionarioLabel: tipo.label,
      competenciaLabel: params.competencia,
      regiaoLabel: regiao.label,
      fgtsPercentual: tipo.fgts * 100,
      encargosPercentual: (tipo.encargos + regiao.satFap) * 100,
      aliquotaIrrf: faixaIrrf.aliquota * 100,
      faixaIrrfLabel: faixaIrrf.label,
      atestadosAbonados: Math.max(0, params.atestadosDias),
    },
  };
}

function calcularInssProgressivo(totalBruto: number): number {
  let inss = 0;
  let limiteAnterior = 0;
  for (const faixa of TABELA_INSS_2024) {
    if (totalBruto <= limiteAnterior) break;
    const base = Math.min(totalBruto, faixa.limite) - limiteAnterior;
    inss += base * faixa.aliquota;
    limiteAnterior = faixa.limite;
  }
  return Math.min(inss, TETO_INSS);
}

function calcularAdicionalTempoServico(
  salario: number,
  anosCompletos: number,
  ativo: boolean,
  tipo: string,
  percentual: number,
  valorManual: number,
): number {
  if (!ativo) return 0;
  if (tipo === 'manual') return Math.max(0, valorManual || 0);

  const anosPorPeriodo = tipo === 'quinquenio' ? 5 : 3;
  const periodos = Math.max(0, Math.floor((anosCompletos || 0) / anosPorPeriodo));
  return salario * (Math.max(0, percentual || 0) / 100) * periodos;
}

function calcularIrrf(baseIRRF: number): number {
  for (const faixa of TABELA_IRRF_2024) {
    if (baseIRRF <= faixa.limite) {
      return Math.max(0, baseIRRF * faixa.aliquota - faixa.deducao);
    }
  }
  return 0;
}

function getFaixaIrrf(baseIRRF: number): { aliquota: number; label: string } {
  const faixa = TABELA_IRRF_2024.find((item) => baseIRRF <= item.limite) ?? TABELA_IRRF_2024[TABELA_IRRF_2024.length - 1];
  const limite = Number.isFinite(faixa.limite) ? `até ${formatCurrency(faixa.limite)}` : 'acima da última faixa';
  return { aliquota: faixa.aliquota, label: `${limite} (${formatPercent(faixa.aliquota * 100)})` };
}

function getTipoFuncionarioConfig(tipo: string) {
  const configs: Record<string, { label: string; inss: 'progressivo' | 'prolabore' | 'isento'; irrf: boolean; fgts: number; encargos: number; salarioFamilia: boolean }> = {
    clt: { label: 'CLT', inss: 'progressivo', irrf: true, fgts: 0.08, encargos: 0.2698, salarioFamilia: true },
    aprendiz: { label: 'Aprendiz', inss: 'progressivo', irrf: true, fgts: 0.02, encargos: 0.2698, salarioFamilia: true },
    estagiario: { label: 'Estagiário', inss: 'isento', irrf: true, fgts: 0, encargos: 0, salarioFamilia: false },
    domestico: { label: 'Doméstico', inss: 'progressivo', irrf: true, fgts: 0.08, encargos: 0.12, salarioFamilia: true },
    diretor: { label: 'Diretor', inss: 'progressivo', irrf: true, fgts: 0, encargos: 0.20, salarioFamilia: false },
    prolabore: { label: 'Pró-labore', inss: 'prolabore', irrf: true, fgts: 0, encargos: 0.20, salarioFamilia: false },
  };
  return configs[tipo] ?? configs.clt;
}

function getRegiaoConfig(regiao: string) {
  const configs: Record<string, { label: string; satFap: number }> = {
    nacional: { label: 'Brasil', satFap: 0 },
    norte: { label: 'Norte', satFap: 0.004 },
    nordeste: { label: 'Nordeste', satFap: 0.003 },
    centro_oeste: { label: 'Centro-Oeste', satFap: 0.0035 },
    sudeste: { label: 'Sudeste', satFap: 0.0025 },
    sul: { label: 'Sul', satFap: 0.002 },
  };
  return configs[regiao] ?? configs.nacional;
}

function buildObservacoes(resultado: ResultadoFolha, params: FolhaParamsCalculo): string[] {
  const custoSobreLiquido = resultado.salarioLiquido > 0
    ? ((resultado.custoEmpregador / resultado.salarioLiquido) - 1) * 100
    : 0;
  const observacoes = [
    `O funcionário está na faixa de IRRF ${resultado.detalhamento.faixaIrrfLabel}.`,
    `O custo da empresa representa ${formatPercent(custoSobreLiquido)} acima do salário líquido.`,
  ];

  if (resultado.aumento) {
    observacoes.push(`Um aumento de ${formatPercent(params.aumentoPercentual)} gera ${formatCurrency(resultado.aumento.diferencaMensal)} de custo mensal adicional.`);
  }

  if (params.tipoFuncionario === 'prolabore') {
    observacoes.push('Como pró-labore, a simulação desconsidera FGTS e verbas típicas de empregado CLT.');
  }

  return observacoes;
}

export interface ResultadoRescisao {
  tipo: string;
  salarioBaseCalculo: number;
  adicionalTempoServico: number;
  saldoSalario: number;
  decimoTerceiroProporcional: number;
  feriasProporcionais: number;
  adicionalFerias: number;
  feriasVencidas: number;
  adicionalFeriasVencidas: number;
  avisoPrevio: number;
  avisoPrevioDesconto: number;
  multaFGTS: number;
  totalBruto: number;
  inssRescisao: number;
  irrfRescisao: number;
  totalLiquido: number;
}

export interface AdicionalTempoServicoRescisao {
  ativo: boolean;
  tipo: string;
  percentual: number;
  valorManual: number;
}

/**
 * RPC simulado: calcular_rescisao
 */
export function rpc_calcularRescisao(
  tipo: string,
  salario: number,
  dataAdmissao: string,
  dataDemissao: string,
  saldoFGTS: number = 0,
  tipoParametro?: TipoRescisaoParametro,
  avisoPrevioModo: 'cumprido' | 'descontado' | 'indenizado' = 'indenizado',
  feriasVencidasPeriodos: number = 0,
  feriasVencidasEmDobro: boolean = false,
  adicionalTempoServicoParams?: AdicionalTempoServicoRescisao,
): ResultadoRescisao {
  const admissao = new Date(dataAdmissao);
  const demissao = new Date(dataDemissao);
  const diasTrabalhados = demissao.getDate();
  const mesesTrabalhados = Math.max(
    0,
    (demissao.getFullYear() - admissao.getFullYear()) * 12
      + (demissao.getMonth() - admissao.getMonth()),
  );
  const anosTrabalhados = mesesTrabalhados / 12;
  const anosCompletos = Math.floor(anosTrabalhados);
  const adicionalTempoServico = calcularAdicionalTempoServicoRescisao(
    salario,
    anosCompletos,
    adicionalTempoServicoParams,
  );
  const salarioBaseCalculo = salario + adicionalTempoServico;
  const periodosVencidos = Math.max(0, Math.floor(feriasVencidasPeriodos || 0));
  const multiplicadorFeriasVencidas = feriasVencidasEmDobro ? 2 : 1;

  const saldoSalario = (salarioBaseCalculo / 30) * diasTrabalhados;
  const decimoTerceiroProp = (salarioBaseCalculo / 12) * (demissao.getMonth() + 1);
  const feriasProp = (salarioBaseCalculo / 12) * Math.min(mesesTrabalhados % 12, 11);
  const adicionalFerias = feriasProp / 3;
  const feriasVencidas = salarioBaseCalculo * periodosVencidos * multiplicadorFeriasVencidas;
  const adicionalFeriasVencidas = feriasVencidas / 3;

  let avisoPrevio = 0;
  let avisoPrevioDesconto = 0;
  let multaFGTS = 0;

  const geraAvisoPrevio = tipoParametro?.geraAvisoPrevio ?? tipo === 'sem_justa_causa';
  const geraMultaFgts = tipoParametro?.geraMultaFgts ?? tipo === 'sem_justa_causa';

  if (geraAvisoPrevio && avisoPrevioModo === 'indenizado') {
    const diasAviso = Math.min(30 + (Math.floor(anosTrabalhados) * 3), 90);
    avisoPrevio = (salarioBaseCalculo / 30) * diasAviso;
  }

  if (avisoPrevioModo === 'descontado') {
    avisoPrevioDesconto = salarioBaseCalculo;
  }

  if (geraMultaFgts) {
    multaFGTS = saldoFGTS * 0.40;
  }

  const totalBruto = saldoSalario + decimoTerceiroProp + feriasProp + adicionalFerias
    + feriasVencidas + adicionalFeriasVencidas + avisoPrevio;
  const baseDescontosRescisao = Math.max(0, saldoSalario + decimoTerceiroProp + avisoPrevio);
  const inssRescisao = Math.min(baseDescontosRescisao * 0.14, TETO_INSS);
  const baseIRRF = Math.max(0, baseDescontosRescisao - inssRescisao);
  let irrfRescisao = 0;
  for (const faixa of TABELA_IRRF_2024) {
    if (baseIRRF <= faixa.limite) {
      irrfRescisao = Math.max(0, baseIRRF * faixa.aliquota - faixa.deducao);
      break;
    }
  }

  return {
    tipo,
    salarioBaseCalculo: round2(salarioBaseCalculo),
    adicionalTempoServico: round2(adicionalTempoServico),
    saldoSalario: round2(saldoSalario),
    decimoTerceiroProporcional: round2(decimoTerceiroProp),
    feriasProporcionais: round2(feriasProp),
    adicionalFerias: round2(adicionalFerias),
    feriasVencidas: round2(feriasVencidas),
    adicionalFeriasVencidas: round2(adicionalFeriasVencidas),
    avisoPrevio: round2(avisoPrevio),
    avisoPrevioDesconto: round2(avisoPrevioDesconto),
    multaFGTS: round2(multaFGTS),
    totalBruto: round2(totalBruto),
    inssRescisao: round2(inssRescisao),
    irrfRescisao: round2(irrfRescisao),
    totalLiquido: round2(totalBruto + multaFGTS - avisoPrevioDesconto - inssRescisao - irrfRescisao),
  };
}

function calcularAdicionalTempoServicoRescisao(
  salario: number,
  anosCompletos: number,
  params?: AdicionalTempoServicoRescisao,
): number {
  if (!params?.ativo) return 0;
  if (params.tipo === 'manual') return Math.max(0, params.valorManual || 0);

  const anosPorPeriodo = params.tipo === 'quinquenio' ? 5 : 3;
  const periodos = Math.max(0, Math.floor(anosCompletos / anosPorPeriodo));
  const percentual = Math.max(0, params.percentual || 0) / 100;
  return salario * percentual * periodos;
}

export interface ResultadoProLabore {
  valorProLabore: number;
  inss: number;
  irrf: number;
  liquido: number;
}

/** RPC simulado: calcular_pro_labore */
export function rpc_calcularProLabore(valorProLabore: number): ResultadoProLabore {
  const inss = Math.min(valorProLabore * 0.11, TETO_INSS);
  const baseIRRF = Math.max(0, valorProLabore - inss);
  let irrf = 0;
  for (const faixa of TABELA_IRRF_2024) {
    if (baseIRRF <= faixa.limite) {
      irrf = Math.max(0, baseIRRF * faixa.aliquota - faixa.deducao);
      break;
    }
  }
  return {
    valorProLabore: round2(valorProLabore),
    inss: round2(inss),
    irrf: round2(irrf),
    liquido: round2(valorProLabore - inss - irrf),
  };
}

export interface ResultadoDAS {
  faturamento12Meses: number;
  faixaNumero: number;
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  valorDAS: number;
  valorDeduzir: number;
}

/** RPC simulado: calcular_das_simples */
export function rpc_calcularDAS(
  faturamentoMensal: number,
  faturamento12Meses: number,
  anexo: string = 'III',
  anexosConfig?: AnexoDasParametro[],
): ResultadoDAS {
  const tabelas: Record<string, { limite: number; aliquota: number; deducao: number }[]> = {
    'I':   [{ limite: 180000, aliquota: 4.0, deducao: 0 },{ limite: 360000, aliquota: 7.3, deducao: 5940 },{ limite: 720000, aliquota: 9.5, deducao: 13860 },{ limite: 1800000, aliquota: 10.7, deducao: 22500 },{ limite: 3600000, aliquota: 14.3, deducao: 87300 },{ limite: Infinity, aliquota: 19.0, deducao: 378000 }],
    'II':  [{ limite: 180000, aliquota: 4.5, deducao: 0 },{ limite: 360000, aliquota: 7.8, deducao: 5940 },{ limite: 720000, aliquota: 10.0, deducao: 13860 },{ limite: 1800000, aliquota: 11.2, deducao: 22500 },{ limite: 3600000, aliquota: 14.7, deducao: 85500 },{ limite: Infinity, aliquota: 30.0, deducao: 720000 }],
    'III': [{ limite: 180000, aliquota: 6.0, deducao: 0 },{ limite: 360000, aliquota: 11.2, deducao: 9360 },{ limite: 720000, aliquota: 13.5, deducao: 17640 },{ limite: 1800000, aliquota: 16.0, deducao: 35640 },{ limite: 3600000, aliquota: 21.0, deducao: 125640 },{ limite: Infinity, aliquota: 33.0, deducao: 648000 }],
    'IV':  [{ limite: 180000, aliquota: 4.5, deducao: 0 },{ limite: 360000, aliquota: 9.0, deducao: 8100 },{ limite: 720000, aliquota: 10.2, deducao: 12420 },{ limite: 1800000, aliquota: 14.0, deducao: 39780 },{ limite: 3600000, aliquota: 22.0, deducao: 183780 },{ limite: Infinity, aliquota: 33.0, deducao: 828000 }],
    'V':   [{ limite: 180000, aliquota: 15.5, deducao: 0 },{ limite: 360000, aliquota: 18.0, deducao: 4500 },{ limite: 720000, aliquota: 19.5, deducao: 9900 },{ limite: 1800000, aliquota: 20.5, deducao: 17100 },{ limite: 3600000, aliquota: 23.0, deducao: 62100 },{ limite: Infinity, aliquota: 30.5, deducao: 540000 }],
  };
  const config = anexosConfig?.find((item) => item.id === anexo);
  const tabela = config?.faixas.length
    ? config.faixas.map((faixa) => ({
        limite: faixa.limiteSuperior,
        aliquota: faixa.aliquota,
        deducao: faixa.deducao,
      }))
    : tabelas[anexo] ?? tabelas['III'];
  let faixaIdx = 0;
  for (let i = 0; i < tabela.length; i++) {
    if (faturamento12Meses <= tabela[i].limite) { faixaIdx = i; break; }
    if (i === tabela.length - 1) { faixaIdx = i; }
  }
  const faixa = tabela[faixaIdx];
  const aliquotaEfetiva = faturamento12Meses > 0
    ? ((faturamento12Meses * (faixa.aliquota / 100) - faixa.deducao) / faturamento12Meses) * 100
    : 0;
  const valorDAS = faturamentoMensal * (aliquotaEfetiva / 100);
  return {
    faturamento12Meses,
    faixaNumero: faixaIdx + 1,
    aliquotaNominal: faixa.aliquota,
    aliquotaEfetiva: round2(Math.max(0, aliquotaEfetiva)),
    valorDAS: round2(Math.max(0, valorDAS)),
    valorDeduzir: faixa.deducao,
  };
}

export interface ResultadoPisCofins {
  regime: string;
  faturamento: number;
  creditosApurados: number;
  debitoPIS: number;
  debitoCOFINS: number;
  saldoPIS: number;
  saldoCOFINS: number;
  totalPagar: number;
}

/** RPC simulado: calcular_pis_cofins */
export function rpc_calcularPisCofins(
  faturamento: number,
  regime: string,
  creditosEntrada: number = 0,
  regimeConfig?: RegimePisCofinsParametro,
): ResultadoPisCofins {
  const permiteCreditoEntrada = regimeConfig?.permiteCreditoEntrada ?? regime === 'nao_cumulativo';
  const aliquotaPIS = regimeConfig ? regimeConfig.aliquotaPis / 100 : regime === 'cumulativo' ? 0.0065 : 0.0165;
  const aliquotaCOFINS = regimeConfig ? regimeConfig.aliquotaCofins / 100 : regime === 'cumulativo' ? 0.03 : 0.076;
  const debitoPIS = faturamento * aliquotaPIS;
  const debitoCOFINS = faturamento * aliquotaCOFINS;
  const creditosPIS = permiteCreditoEntrada ? creditosEntrada * aliquotaPIS : 0;
  const creditosCOFINS = permiteCreditoEntrada ? creditosEntrada * aliquotaCOFINS : 0;
  const saldoPIS = Math.max(0, debitoPIS - creditosPIS);
  const saldoCOFINS = Math.max(0, debitoCOFINS - creditosCOFINS);
  return {
    regime,
    faturamento,
    creditosApurados: round2(creditosPIS + creditosCOFINS),
    debitoPIS: round2(debitoPIS),
    debitoCOFINS: round2(debitoCOFINS),
    saldoPIS: round2(saldoPIS),
    saldoCOFINS: round2(saldoCOFINS),
    totalPagar: round2(saldoPIS + saldoCOFINS),
  };
}

export interface ResultadoMulta {
  valorOriginal: number;
  diasAtraso: number;
  jurosPercentual: number;
  jurosValor: number;
  multaPercentual: number;
  multaValor: number;
  totalPagar: number;
}

/** RPC simulado: calcular_multa_juros_darf */
export function rpc_calcularMultaJuros(
  valorOriginal: number,
  dataVencimento: string,
  dataPagamento: string,
): ResultadoMulta {
  const venc = new Date(dataVencimento);
  const pag = new Date(dataPagamento);
  const diasAtraso = Math.max(0, Math.floor((pag.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
  const taxaSelic = 0.1075; // taxa Selic anual simulada
  const jurosPercentual = Math.min((taxaSelic / 365) * diasAtraso * 100, 999);
  const jurosValor = valorOriginal * (jurosPercentual / 100);
  const multaPercentual = Math.min(0.33 * diasAtraso, 20);
  const multaValor = valorOriginal * (multaPercentual / 100);
  return {
    valorOriginal,
    diasAtraso,
    jurosPercentual: round2(jurosPercentual),
    jurosValor: round2(jurosValor),
    multaPercentual: round2(multaPercentual),
    multaValor: round2(multaValor),
    totalPagar: round2(valorOriginal + jurosValor + multaValor),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}
