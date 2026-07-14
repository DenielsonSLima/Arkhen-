export interface ClienteEmpresa {
  id: string;
  nome: string;
  cnpj: string;
  regimeAtual: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  faturamentoMensal: number;
  faturamento12Meses: number;
  folhaPagamentoMensal: number;
  funcionarios: number;
  anexoSimples?: 'I' | 'II' | 'III' | 'IV' | 'V';
  cnaeDescricao: string;
}

export interface HistoricoPlanejamento {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  dataSimulacao: string;
  regimeAnalisado: string;
  regimeSugerido: string;
  economiaEstimada: number;
  faturamentoBase: number;
  observacao: string | null;
}

export interface FaixaSimples {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquotaNominal: number;
  valorDeduzir: number;
}
