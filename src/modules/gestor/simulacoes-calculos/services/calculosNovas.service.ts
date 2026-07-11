// ============================================================
// SERVICE — Novas Simulações Trabalhistas e Fiscais
// Funções puras que simulam RPCs adicionais do Supabase
// REGRA: Nenhuma fórmula de cálculo nos componentes .tsx
// ============================================================

import { type RegrasGeraisParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export interface FeriasParams {
  salarioBruto: number;
  diasFerias: number;
  abonoPecuniario: boolean;
  adiantamento13: boolean;
  dependentes: number;
  regrasGerais?: RegrasGeraisParametro;
}

export interface ResultadoFerias {
  valorFerias: number;
  tercoConstitucional: number;
  abonoPecuniario: number;
  tercoAbono: number;
  adiantamento13: number;
  totalBruto: number;
  inss: number;
  irrf: number;
  totalLiquido: number;
  custoEmpresa: number;
}

export interface TempoEmpresaParams {
  dataAdmissao: string;
  dataReferencia: string;
  salarioBase: number;
  regrasGerais?: RegrasGeraisParametro;
}

export interface ResultadoTempoEmpresa {
  anos: number;
  meses: number;
  dias: number;
  provisao13: number;
  provisaoFerias: number;
  provisaoTerco: number;
  fgtsAcumulado: number;
  multaFgtsProjetada: number;
  custoTotalAcumulado: number;
}

export interface EncargosParams {
  salarioBruto: number;
  regimeEmpresa: string; // 'simples_geral' | 'simples_anexo_iv' | 'lucro_presumido' | 'lucro_real'
  rat: number;
  fap: number;
  terceiros: number;
  regrasGerais?: RegrasGeraisParametro;
}

export interface ResultadoEncargos {
  inssPatronal: number;
  ratAjustado: number;
  terceirosValor: number;
  fgts: number;
  provisaoFerias13: number;
  totalEncargosValor: number;
  totalPercentual: number;
}

export interface ContratacaoParams {
  salarioProposto: number;
  valeTransporte: number;
  valeAlimentacao: number;
  planoSaude: number;
  regrasGerais?: RegrasGeraisParametro;
}

export interface ResultadoContratacao {
  custoCltMensal: number;
  custoCltAnual: number;
  custoPjMensal: number;
  custoPjAnual: number;
  custoEstagioMensal: number;
  custoEstagioAnual: number;
  liquidoClt: number;
  liquidoPj: number;
  liquidoEstagio: number;
}

export interface ComparativoRegimeParams {
  faturamentoAnual: number;
  comprasInsumosAnual: number;
  folhaAnual: number;
  margemLucro: number;
  tipoEmpresa?: string;
  naturezaJuridica?: string;
}

export interface ResultadoComparativoRegime {
  simplesNacional: number;
  lucroPresumido: number;
  lucroReal: number;
  melhorOpcao: string;
  melhorOpcaoDesc: string;
  alertas?: string[];
}

export interface SimulacaoImpostoParams {
  faturamentoMensal: number;
  tipoAtividade: string; // 'comercio' | 'servico' | 'industria'
  aliquotaEstimada: number;
}

export interface DetalheImposto {
  nome: string;
  valor: number;
  percentual: number;
}

export interface ResultadoSimulacaoImposto {
  impostoTotal: number;
  aliquotaEfetiva: number;
  detalheImpostos: DetalheImposto[];
}

export interface CustosParams {
  custosFixos: number;
  custosVariaveisPercentual: number;
  markupDesejado: number;
}

export interface ResultadoCustos {
  pontoEquilibrio: number;
  faturamentoAlvo: number;
  margemContribuicaoPercentual: number;
  lucroEstimado: number;
}

// Helper para arredondamento
const round2 = (value: number): number => Math.round(value * 100) / 100;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

// Tabelas simplificadas para INSS e IRRF (2024)
const TABELA_INSS = [
  { limite: 1412.00, aliquota: 0.075 },
  { limite: 2666.68, aliquota: 0.09 },
  { limite: 4000.03, aliquota: 0.12 },
  { limite: 7786.02, aliquota: 0.14 },
];
const TETO_INSS = 908.86;

const TABELA_IRRF = [
  { limite: 2259.20, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { limite: Infinity, aliquota: 0.275, deducao: 896.00 },
];
const DEDUCAO_DEPENDENTE = 189.59;

function calcularInssProgressivo(valor: number): number {
  let inss = 0;
  let limiteAnterior = 0;
  for (const faixa of TABELA_INSS) {
    if (valor <= limiteAnterior) break;
    const base = Math.min(valor, faixa.limite) - limiteAnterior;
    inss += base * faixa.aliquota;
    limiteAnterior = faixa.limite;
  }
  return round2(Math.min(inss, TETO_INSS));
}

function calcularIrrfProgressivo(valor: number): number {
  for (const faixa of TABELA_IRRF) {
    if (valor <= faixa.limite) {
      return round2(Math.max(0, valor * faixa.aliquota - faixa.deducao));
    }
  }
  return 0;
}

// 1. Simulação Férias
export function rpc_calcularFerias(params: FeriasParams): ResultadoFerias {
  const { salarioBruto, diasFerias, abonoPecuniario, adiantamento13, dependentes, regrasGerais } = params;
  
  const fgtsRate = regrasGerais ? (regrasGerais.aliquotaFgts / 100) : 0.08;
  
  const proporcao = diasFerias / 30;
  const valorFerias = salarioBruto * proporcao;
  const tercoConstitucional = valorFerias / 3;
  
  const abonoPecuniarioValor = abonoPecuniario ? (salarioBruto / 3) : 0;
  const tercoAbono = abonoPecuniario ? (abonoPecuniarioValor / 3) : 0;
  const adiantamento13Valor = adiantamento13 ? (salarioBruto / 2) : 0;
  
  const baseTributaria = valorFerias + tercoConstitucional;
  const inss = calcularInssProgressivo(baseTributaria);
  
  const baseIrrf = Math.max(0, baseTributaria - inss - (dependentes * DEDUCAO_DEPENDENTE));
  const irrf = calcularIrrfProgressivo(baseIrrf);
  
  const totalBruto = valorFerias + tercoConstitucional + abonoPecuniarioValor + tercoAbono + adiantamento13Valor;
  const totalLiquido = totalBruto - inss - irrf;
  
  // FGTS sobre férias e terço
  const fgts = baseTributaria * fgtsRate;
  const custoEmpresa = baseTributaria + fgts + (abonoPecuniarioValor + tercoAbono) + adiantamento13Valor;
  
  return {
    valorFerias: round2(valorFerias),
    tercoConstitucional: round2(tercoConstitucional),
    abonoPecuniario: round2(abonoPecuniarioValor),
    tercoAbono: round2(tercoAbono),
    adiantamento13: round2(adiantamento13Valor),
    totalBruto: round2(totalBruto),
    inss: round2(inss),
    irrf: round2(irrf),
    totalLiquido: round2(totalLiquido),
    custoEmpresa: round2(custoEmpresa),
  };
}

// 2. Tempo de Empresa
export function rpc_calcularTempoEmpresa(params: TempoEmpresaParams): ResultadoTempoEmpresa {
  const { dataAdmissao, dataReferencia, salarioBase, regrasGerais } = params;
  const adm = new Date(dataAdmissao);
  const ref = new Date(dataReferencia);
  
  if (isNaN(adm.getTime()) || isNaN(ref.getTime()) || ref < adm) {
    return { anos: 0, meses: 0, dias: 0, provisao13: 0, provisaoFerias: 0, provisaoTerco: 0, fgtsAcumulado: 0, multaFgtsProjetada: 0, custoTotalAcumulado: 0 };
  }
  
  let anos = ref.getFullYear() - adm.getFullYear();
  let meses = ref.getMonth() - adm.getMonth();
  let dias = ref.getDate() - adm.getDate();
  
  if (dias < 0) {
    meses -= 1;
    // Aproximação de dias no mês
    dias += 30;
  }
  if (meses < 0) {
    anos -= 1;
    meses += 12;
  }
  
  const totalMeses = (anos * 12) + meses + (dias >= 15 ? 1 : 0);
  
  const provisao13 = (salarioBase / 12) * (totalMeses % 12);
  const provisaoFerias = (salarioBase / 12) * totalMeses;
  const provisaoTerco = provisaoFerias / 3;
  
  const fgtsRate = regrasGerais ? (regrasGerais.aliquotaFgts / 100) : 0.08;
  const multaRate = regrasGerais ? (regrasGerais.multaFgtsRescisao / 100) : 0.40;
  
  const fgtsAcumulado = salarioBase * fgtsRate * totalMeses;
  const multaFgtsProjetada = fgtsAcumulado * multaRate;
  const custoTotalAcumulado = provisao13 + provisaoFerias + provisaoTerco + fgtsAcumulado + multaFgtsProjetada;
  
  return {
    anos,
    meses,
    dias,
    provisao13: round2(provisao13),
    provisaoFerias: round2(provisaoFerias),
    provisaoTerco: round2(provisaoTerco),
    fgtsAcumulado: round2(fgtsAcumulado),
    multaFgtsProjetada: round2(multaFgtsProjetada),
    custoTotalAcumulado: round2(custoTotalAcumulado),
  };
}

// 3. Encargos Trabalhistas
export function rpc_calcularEncargosTrabalhistas(params: EncargosParams): ResultadoEncargos {
  const { salarioBruto, regimeEmpresa, rat, fap, terceiros, regrasGerais } = params;
  
  const inssPatronalRate = regrasGerais ? (regrasGerais.aliquotaInssPatronal / 100) : 0.20;
  const fgtsRate = regrasGerais ? (regrasGerais.aliquotaFgts / 100) : 0.08;
  const provisaoRate = regrasGerais ? (regrasGerais.provisaoFerias13 / 100) : 0.1944;
  
  const pagaInssPatronal = regimeEmpresa !== 'simples_geral'; // Simples Geral não paga INSS patronal, Anexo IV e outros pagam
  const inssPatronal = pagaInssPatronal ? (salarioBruto * inssPatronalRate) : 0;
  
  const ratAjustadoPercent = (rat / 100) * fap;
  const ratAjustado = pagaInssPatronal ? (salarioBruto * ratAjustadoPercent) : 0;
  
  const terceirosValor = pagaInssPatronal ? (salarioBruto * (terceiros / 100)) : 0;
  const fgts = salarioBruto * fgtsRate;
  
  // Provisões mensais médias (13º = 8.33%, Férias = 8.33%, 1/3 Férias = 2.78%, total 19.44%)
  const provisaoFerias13 = salarioBruto * provisaoRate;
  
  const totalEncargosValor = inssPatronal + ratAjustado + terceirosValor + fgts + provisaoFerias13;
  const totalPercentual = (totalEncargosValor / salarioBruto) * 100;
  
  return {
    inssPatronal: round2(inssPatronal),
    ratAjustado: round2(ratAjustado),
    terceirosValor: round2(terceirosValor),
    fgts: round2(fgts),
    provisaoFerias13: round2(provisaoFerias13),
    totalEncargosValor: round2(totalEncargosValor),
    totalPercentual: round2(totalPercentual),
  };
}

// 4. Simulação de Contratação CLT vs PJ vs Estagiário
export function rpc_calcularContratacao(params: ContratacaoParams): ResultadoContratacao {
  const { salarioProposto, valeTransporte, valeAlimentacao, planoSaude, regrasGerais } = params;
  
  const inssPatronalRate = regrasGerais ? (regrasGerais.aliquotaInssPatronal / 100) : 0.20;
  const fgtsRate = regrasGerais ? (regrasGerais.aliquotaFgts / 100) : 0.08;
  const provisaoRate = regrasGerais ? (regrasGerais.provisaoFerias13 / 100) : 0.1944;
  const simplesPjRate = regrasGerais ? (regrasGerais.aliquotaSimplesPj / 100) : 0.06;
  
  const beneficios = valeTransporte + valeAlimentacao + planoSaude;
  
  // 1. CLT
  // Custos mensais: Salário + INSS Patronal + RAT/FAP (2%) + Terceiros (5.8%) + FGTS + Provisões + Benefícios
  const cltEncargosRate = inssPatronalRate + 0.02 + 0.058 + fgtsRate + provisaoRate;
  const custoCltMensal = salarioProposto * (1 + cltEncargosRate) + beneficios;
  const custoCltAnual = (custoCltMensal * 12) + (salarioProposto * fgtsRate * 1.33); // adicionais
  
  const cltInss = calcularInssProgressivo(salarioProposto);
  const cltIrrf = calcularIrrfProgressivo(salarioProposto - cltInss);
  const liquidoClt = salarioProposto - cltInss - cltIrrf + (beneficios * 0.7); // assume 70% de proveito real de benefícios
  
  // 2. PJ
  // Geralmente o PJ tem uma empresa individual no Simples Nacional Anexo III (alíquota inicial 6%)
  const custoPjMensal = salarioProposto; // sem encargos diretos de CLT, o contrato é o próprio valor
  const custoPjAnual = custoPjMensal * 12;
  
  const pjImposto = salarioProposto * simplesPjRate;
  const pjContabilidade = 250; // valor estimado fixo mensal
  const pjInssProlabore = calcularInssProgressivo(1412.00) * 0.11; // INSS mínimo sobre 1 salário mínimo
  const liquidoPj = salarioProposto - pjImposto - pjContabilidade - pjInssProlabore;
  
  // 3. Estágio
  // Custos mensais: Bolsa-auxílio + Benefícios + Seguro de Vida (estimado R$ 30) + Recesso (8.33%)
  const custoEstagioMensal = salarioProposto + beneficios + 30 + (salarioProposto * 0.0833);
  const custoEstagioAnual = custoEstagioMensal * 12;
  const liquidoEstagio = salarioProposto + (beneficios * 0.7);
  
  return {
    custoCltMensal: round2(custoCltMensal),
    custoCltAnual: round2(custoCltAnual),
    custoPjMensal: round2(custoPjMensal),
    custoPjAnual: round2(custoPjAnual),
    custoEstagioMensal: round2(custoEstagioMensal),
    custoEstagioAnual: round2(custoEstagioAnual),
    liquidoClt: round2(liquidoClt),
    liquidoPj: round2(liquidoPj),
    liquidoEstagio: round2(liquidoEstagio),
  };
}

// 5. Comparativo de Regimes Tributários
export function rpc_calcularComparativoRegime(params: ComparativoRegimeParams): ResultadoComparativoRegime {
  const { faturamentoAnual, comprasInsumosAnual, folhaAnual, margemLucro, tipoEmpresa, naturezaJuridica } = params;
  const lucroEstimado = faturamentoAnual * (margemLucro / 100);
  
  // 1. Simples Nacional (estimado para serviços Anexo III, média geral de faixas)
  // Alíquota média ponderada de 11% sobre o faturamento
  const simplesNacional = faturamentoAnual * 0.11;
  
  // 2. Lucro Presumido
  // Impostos Federais presumidos para serviços (32% de presunção):
  // IRPJ (4.8%) + CSLL (2.88%) + PIS (0.65%) + COFINS (3.0%) = 11.33%
  // ISS médio de 3%
  // Encargos de Folha (27.8% INSS Patronal + RAT + Terceiros)
  const lpImpostosFaturamento = faturamentoAnual * 0.1433;
  const lpImpostosFolha = folhaAnual * 0.278;
  const lucroPresumido = lpImpostosFaturamento + lpImpostosFolha;
  
  // 3. Lucro Real
  // Lucro líquido real estimado
  const encargosCltReal = folhaAnual * 0.278;
  const lucroAntesImpostos = Math.max(
    0,
    Math.min(lucroEstimado, faturamentoAnual - comprasInsumosAnual - folhaAnual - encargosCltReal),
  );
  
  // PIS/COFINS Não-Cumulativo (9.25% débito, com crédito de 9.25% sobre insumos)
  const pisCofinsReal = Math.max(0, (faturamentoAnual * 0.0925) - (comprasInsumosAnual * 0.0925));
  const irpjCsllReal = lucroAntesImpostos * 0.24; // 15% IRPJ + 9% CSLL
  const issReal = faturamentoAnual * 0.03;
  const lucroReal = irpjCsllReal + pisCofinsReal + issReal;
  
  // Determinação da melhor opção
  let melhorOpcao = 'Simples Nacional';
  let menorImposto = simplesNacional;
  
  if (lucroPresumido < menorImposto) {
    melhorOpcao = 'Lucro Presumido';
    menorImposto = lucroPresumido;
  }
  if (lucroReal < menorImposto && lucroAntesImpostos > 0) {
    melhorOpcao = 'Lucro Real';
    menorImposto = lucroReal;
  }
  
  const melhorOpcaoDesc = `O regime ${melhorOpcao} é o mais econômico sob estas condições, gerando uma tributação estimada de R$ ${menorImposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} anual.`;
  
  // Alertas dinâmicos baseados no cadastro de parametrização
  const alertas: string[] = [];
  
  if (tipoEmpresa) {
    const lowerTipo = tipoEmpresa.toLowerCase();
    if (lowerTipo.includes('mei')) {
      if (faturamentoAnual > 81000) {
        alertas.push(`Atenção: O faturamento anual de R$ ${faturamentoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassa o limite legal permitido para o MEI (R$ 81.000,00). É obrigatória a migração para Microempresa (ME).`);
      } else {
        alertas.push(`Enquadramento MEI válido: O faturamento projetado está dentro do limite anual de R$ 81.000,00.`);
      }
    } else if (lowerTipo.includes('microempresa') || lowerTipo === 'me') {
      if (faturamentoAnual > 360000) {
        alertas.push(`Atenção: O faturamento anual ultrapassa o teto de Microempresa (R$ 360.000,00). O enquadramento automático do cliente será alterado para Empresa de Pequeno Porte (EPP).`);
      }
    } else if (lowerTipo.includes('pequeno porte') || lowerTipo === 'epp') {
      if (faturamentoAnual > 4800000) {
        alertas.push(`Atenção crítica: O faturamento anual projetado supera R$ 4,8 milhões, excluindo legalmente esta empresa do Simples Nacional. O regime fiscal obrigatório será Lucro Presumido ou Lucro Real.`);
      }
    }
  }

  if (naturezaJuridica) {
    const lowerNJ = naturezaJuridica.toLowerCase();
    if (lowerNJ.includes('individual') && !lowerNJ.includes('unipessoal')) {
      alertas.push(`Nota societária (Empresário Individual): Não exige capital social mínimo para abertura. Contudo, lembre-se de que o patrimônio pessoal do proprietário se confunde legalmente com o da empresa em caso de dívidas.`);
    } else if (lowerNJ.includes('unipessoal') || lowerNJ.includes('slu')) {
      alertas.push(`Nota societária (SLU): Permite abertura com apenas 1 sócio (unipessoal) e garante a blindagem patrimonial (separação de bens da pessoa física e jurídica), sem exigência de capital mínimo.`);
    } else if (lowerNJ.includes('sociedade limitada') || lowerNJ.includes('ltda')) {
      alertas.push(`Nota societária (Sociedade Limitada - LTDA): Exige a presença de 2 ou mais sócios para constituição. Confere proteção ao patrimônio pessoal de cada integrante de forma proporcional às suas quotas.`);
    }
  }
  
  return {
    simplesNacional: round2(simplesNacional),
    lucroPresumido: round2(lucroPresumido),
    lucroReal: round2(lucroReal),
    melhorOpcao,
    melhorOpcaoDesc,
    alertas,
  };
}

// 6. Simulação de Impostos
export function rpc_calcularSimulacaoImposto(params: SimulacaoImpostoParams): ResultadoSimulacaoImposto {
  const { faturamentoMensal, tipoAtividade, aliquotaEstimada } = params;
  
  const impostoTotal = faturamentoMensal * (aliquotaEstimada / 100);
  
  const detalheImpostos: DetalheImposto[] = [];
  
  if (tipoAtividade === 'servico') {
    detalheImpostos.push(
      { nome: 'PIS', valor: round2(impostoTotal * 0.12), percentual: round2(aliquotaEstimada * 0.12) },
      { nome: 'COFINS', valor: round2(impostoTotal * 0.45), percentual: round2(aliquotaEstimada * 0.45) },
      { nome: 'ISS', valor: round2(impostoTotal * 0.23), percentual: round2(aliquotaEstimada * 0.23) },
      { nome: 'IRPJ', valor: round2(impostoTotal * 0.11), percentual: round2(aliquotaEstimada * 0.11) },
      { nome: 'CSLL', valor: round2(impostoTotal * 0.09), percentual: round2(aliquotaEstimada * 0.09) }
    );
  } else if (tipoAtividade === 'comercio') {
    detalheImpostos.push(
      { nome: 'ICMS', valor: round2(impostoTotal * 0.60), percentual: round2(aliquotaEstimada * 0.60) },
      { nome: 'PIS', valor: round2(impostoTotal * 0.08), percentual: round2(aliquotaEstimada * 0.08) },
      { nome: 'COFINS', valor: round2(impostoTotal * 0.22), percentual: round2(aliquotaEstimada * 0.22) },
      { nome: 'IRPJ', valor: round2(impostoTotal * 0.06), percentual: round2(aliquotaEstimada * 0.06) },
      { nome: 'CSLL', valor: round2(impostoTotal * 0.04), percentual: round2(aliquotaEstimada * 0.04) }
    );
  } else { // industria
    detalheImpostos.push(
      { nome: 'IPI', valor: round2(impostoTotal * 0.20), percentual: round2(aliquotaEstimada * 0.20) },
      { nome: 'ICMS', valor: round2(impostoTotal * 0.45), percentual: round2(aliquotaEstimada * 0.45) },
      { nome: 'PIS', valor: round2(impostoTotal * 0.08), percentual: round2(aliquotaEstimada * 0.08) },
      { nome: 'COFINS', valor: round2(impostoTotal * 0.17), percentual: round2(aliquotaEstimada * 0.17) },
      { nome: 'IRPJ', valor: round2(impostoTotal * 0.06), percentual: round2(aliquotaEstimada * 0.06) },
      { nome: 'CSLL', valor: round2(impostoTotal * 0.04), percentual: round2(aliquotaEstimada * 0.04) }
    );
  }
  
  return {
    impostoTotal: round2(impostoTotal),
    aliquotaEfetiva: round2(aliquotaEstimada),
    detalheImpostos,
  };
}

// 7. Simulação de Custos / Break-even
export function rpc_calcularCustos(params: CustosParams): ResultadoCustos {
  const { custosFixos, custosVariaveisPercentual, markupDesejado } = params;
  
  const margemContribuicaoPercentual = 100 - custosVariaveisPercentual;
  
  // Ponto de equilíbrio financeiro (Break-even)
  const pontoEquilibrio = margemContribuicaoPercentual > 0
    ? (custosFixos / (margemContribuicaoPercentual / 100))
    : 0;
    
  // Faturamento Alvo para atingir a margem desejada
  const faturamentoAlvo = (margemContribuicaoPercentual - markupDesejado) > 0
    ? (custosFixos / ((margemContribuicaoPercentual - markupDesejado) / 100))
    : 0;
    
  const lucroEstimado = faturamentoAlvo > 0
    ? (faturamentoAlvo * (margemContribuicaoPercentual / 100)) - custosFixos
    : 0;
    
  return {
    pontoEquilibrio: round2(pontoEquilibrio),
    faturamentoAlvo: round2(faturamentoAlvo),
    margemContribuicaoPercentual: round2(margemContribuicaoPercentual),
    lucroEstimado: round2(lucroEstimado),
  };
}
