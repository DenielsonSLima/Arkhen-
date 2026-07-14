// Contratos de saída das simulações adicionais. O frontend não contém fórmulas contábeis.

export interface ResultadoFerias {
  valorFerias: number; tercoConstitucional: number; abonoPecuniario: number; tercoAbono: number;
  adiantamento13: number; totalBruto: number; inss: number; irrf: number; totalLiquido: number; custoEmpresa: number;
}
export interface ResultadoTempoEmpresa {
  anos: number; meses: number; dias: number; provisao13: number; provisaoFerias: number;
  provisaoTerco: number; fgtsAcumulado: number; multaFgtsProjetada: number; custoTotalAcumulado: number;
}
export interface ResultadoEncargos {
  inssPatronal: number; ratAjustado: number; terceirosValor: number; fgts: number;
  provisaoFerias13: number; totalEncargosValor: number; totalPercentual: number;
}
export interface ResultadoContratacao {
  custoCltMensal: number; custoCltAnual: number; custoPjMensal: number; custoPjAnual: number;
  custoEstagioMensal: number; custoEstagioAnual: number; liquidoClt: number; liquidoPj: number; liquidoEstagio: number;
}
export interface ResultadoComparativoRegime {
  simplesNacional: number; lucroPresumido: number; lucroReal: number; melhorOpcao: string;
  melhorOpcaoDesc: string; alertas?: string[];
}
export interface DetalheImposto { nome: string; valor: number; percentual: number; }
export interface ResultadoSimulacaoImposto { impostoTotal: number; aliquotaEfetiva: number; detalheImpostos: DetalheImposto[]; }
export interface ResultadoCustos { pontoEquilibrio: number; faturamentoAlvo: number; margemContribuicaoPercentual: number; lucroEstimado: number; }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0);
}
