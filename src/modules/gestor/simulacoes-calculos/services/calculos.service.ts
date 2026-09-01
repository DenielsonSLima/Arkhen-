// Contrato da única calculadora mantida no módulo. A regra de negócio fica na RPC.
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
  totalDescontos: number;
  totalLiquido: number;
  avosDecimoTerceiro?: number;
  avosFerias?: number;
  avisoPrevioDias?: number;
  dataProjetadaAviso?: string;
  inssSaldoSalario?: number;
  inssDecimoTerceiro?: number;
  irrfSaldoSalario?: number;
  irrfDecimoTerceiro?: number;
  fgtsRescisorio?: number;
  baseMultaFGTS?: number;
  totalComFgts?: number;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}
