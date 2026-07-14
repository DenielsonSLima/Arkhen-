// Contratos de saída das simulações. As regras de cálculo ficam nas RPCs do Supabase.

export interface ResultadoFolhaComparacao {
  salario: number; inss: number; irrf: number; fgts: number;
  salarioLiquido: number; custoEmpregador: number; diferencaCusto: number;
}

export interface ResultadoFolhaAumento {
  percentual: number; novoSalario: number; novoCusto: number;
  diferencaMensal: number; diferencaAnual: number;
}

export interface ResultadoFolha {
  salarioBruto: number; totalVencimentos: number; descontosFuncionario: number;
  encargosEmpresa: number; inss: number; baseIRRF: number; irrf: number; fgts: number;
  encargosPrevidenciarios: number; beneficiosEmpresa: number; valeTransporteDesconto: number;
  valeAlimentacaoDesconto: number; planoSaudeDesconto: number; odontologicoDesconto: number;
  pensaoAlimenticia: number; faltas: number; descontoManual: number; adicionalManual: number;
  horasExtrasTotal: number; adicionalNoturno: number; insalubridade: number;
  adicionalTempoServico: number; salarioFamilia: number; salarioLiquido: number;
  custoEmpregador: number; comparacao?: ResultadoFolhaComparacao; aumento?: ResultadoFolhaAumento;
  observacoes: string[];
  detalhamento: {
    tipoFuncionarioLabel: string; competenciaLabel: string; regiaoLabel: string;
    fgtsPercentual: number; encargosPercentual: number; aliquotaIrrf: number;
    faixaIrrfLabel: string; atestadosAbonados: number;
  };
}

export interface ResultadoRescisao {
  tipo: string; salarioBaseCalculo: number; adicionalTempoServico: number; saldoSalario: number;
  decimoTerceiroProporcional: number; feriasProporcionais: number; adicionalFerias: number;
  feriasVencidas: number; adicionalFeriasVencidas: number; avisoPrevio: number;
  avisoPrevioDesconto: number; multaFGTS: number; totalBruto: number; inssRescisao: number;
  irrfRescisao: number; totalLiquido: number;
}

export interface ResultadoProLabore { valorProLabore: number; inss: number; irrf: number; liquido: number; cpp: number; custoEmpresa: number; }
export interface ResultadoDAS { faturamento12Meses: number; faixaNumero: number; aliquotaNominal: number; aliquotaEfetiva: number; valorDAS: number; valorDeduzir: number; }
export interface ResultadoPisCofins { regime: string; faturamento: number; creditosApurados: number; debitoPIS: number; debitoCOFINS: number; saldoPIS: number; saldoCOFINS: number; totalPagar: number; }
export interface ResultadoMulta { valorOriginal: number; diasAtraso: number; jurosPercentual: number; jurosValor: number; multaPercentual: number; multaValor: number; totalPagar: number; }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2).replace('.', ',')}%`;
}
