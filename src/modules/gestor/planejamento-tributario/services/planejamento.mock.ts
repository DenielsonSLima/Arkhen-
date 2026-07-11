// ============================================================
// MOCK DATA — Planejamento Tributário
// Simula dados que virão do Supabase via RPC futuramente
// ============================================================

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
  clienteId: string;
  clienteNome: string;
  dataSimulacao: string;
  regimeAnalisado: string;
  regimeSugerido: string;
  economiaEstimada: number;
  faturamentoBase: number;
  observacao?: string;
}

export const MOCK_CLIENTES: ClienteEmpresa[] = [
  {
    id: 'c1',
    nome: 'TechCorp Soluções Ltda.',
    cnpj: '12.345.678/0001-99',
    regimeAtual: 'Simples Nacional',
    faturamentoMensal: 85000,
    faturamento12Meses: 980000,
    folhaPagamentoMensal: 18000,
    funcionarios: 7,
    anexoSimples: 'III',
    cnaeDescricao: 'Desenvolvimento de software',
  },
  {
    id: 'c2',
    nome: 'Alpha Comércio e Serviços S.A.',
    cnpj: '98.765.432/0001-11',
    regimeAtual: 'Lucro Presumido',
    faturamentoMensal: 320000,
    faturamento12Meses: 3800000,
    folhaPagamentoMensal: 64000,
    funcionarios: 22,
    cnaeDescricao: 'Comércio varejista de produtos eletrônicos',
  },
  {
    id: 'c3',
    nome: 'Construtora Horizonte Ltda.',
    cnpj: '45.678.901/0001-22',
    regimeAtual: 'Lucro Real',
    faturamentoMensal: 1200000,
    faturamento12Meses: 14500000,
    folhaPagamentoMensal: 215000,
    funcionarios: 64,
    cnaeDescricao: 'Construção de edifícios',
  },
  {
    id: 'c4',
    nome: 'Sabor & Arte Restaurante ME',
    cnpj: '23.456.789/0001-33',
    regimeAtual: 'Simples Nacional',
    faturamentoMensal: 42000,
    faturamento12Meses: 490000,
    folhaPagamentoMensal: 12500,
    funcionarios: 9,
    anexoSimples: 'I',
    cnaeDescricao: 'Restaurantes e similares',
  },
  {
    id: 'c5',
    nome: 'Clínica Saúde Total S/S',
    cnpj: '67.890.123/0001-44',
    regimeAtual: 'Lucro Presumido',
    faturamentoMensal: 180000,
    faturamento12Meses: 2100000,
    folhaPagamentoMensal: 78000,
    funcionarios: 18,
    cnaeDescricao: 'Atividades de atenção à saúde humana',
  },
];

export const MOCK_HISTORICO: HistoricoPlanejamento[] = [
  {
    id: 'h1',
    clienteId: 'c1',
    clienteNome: 'TechCorp Soluções Ltda.',
    dataSimulacao: '2026-06-15',
    regimeAnalisado: 'Simples Nacional',
    regimeSugerido: 'Lucro Presumido',
    economiaEstimada: 18500,
    faturamentoBase: 980000,
    observacao: 'Faturamento próximo do limite do Simples. Migração recomendada.',
  },
  {
    id: 'h2',
    clienteId: 'c4',
    clienteNome: 'Sabor & Arte Restaurante ME',
    dataSimulacao: '2026-05-20',
    regimeAnalisado: 'Simples Nacional',
    regimeSugerido: 'Simples Nacional',
    economiaEstimada: 0,
    faturamentoBase: 490000,
    observacao: 'Simples Nacional é o regime mais vantajoso para o faturamento atual.',
  },
  {
    id: 'h3',
    clienteId: 'c5',
    clienteNome: 'Clínica Saúde Total S/S',
    dataSimulacao: '2026-04-10',
    regimeAnalisado: 'Lucro Presumido',
    regimeSugerido: 'Lucro Presumido',
    economiaEstimada: 3200,
    faturamentoBase: 2100000,
    observacao: 'Manteve-se no LP. Verificar margem líquida para avaliar LR.',
  },
];

// Tabela do Simples Nacional — Dados de 2024
export interface FaixaSimples {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquotaNominal: number;
  valorDeduzir: number;
}

export const TABELAS_SIMPLES: Record<string, FaixaSimples[]> = {
  'I': [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 4.0, valorDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 7.3, valorDeduzir: 5940 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 9.5, valorDeduzir: 13860 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 10.7, valorDeduzir: 22500 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 14.3, valorDeduzir: 87300 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 19.0, valorDeduzir: 378000 },
  ],
  'II': [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 4.5, valorDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 7.8, valorDeduzir: 5940 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 10.0, valorDeduzir: 13860 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 11.2, valorDeduzir: 22500 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 14.7, valorDeduzir: 85500 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 30.0, valorDeduzir: 720000 },
  ],
  'III': [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 6.0, valorDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 11.2, valorDeduzir: 9360 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 13.5, valorDeduzir: 17640 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 16.0, valorDeduzir: 35640 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 21.0, valorDeduzir: 125640 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 33.0, valorDeduzir: 648000 },
  ],
  'IV': [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 4.5, valorDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 9.0, valorDeduzir: 8100 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 10.2, valorDeduzir: 12420 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 14.0, valorDeduzir: 39780 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 22.0, valorDeduzir: 183780 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 33.0, valorDeduzir: 828000 },
  ],
  'V': [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 15.5, valorDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 18.0, valorDeduzir: 4500 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 19.5, valorDeduzir: 9900 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 20.5, valorDeduzir: 17100 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 23.0, valorDeduzir: 62100 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 30.5, valorDeduzir: 540000 },
  ],
};
