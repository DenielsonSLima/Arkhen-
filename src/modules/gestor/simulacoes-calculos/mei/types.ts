export type TipoMei = 'normal' | 'caminhoneiro';

export type FaixaRiscoMei = 'regular' | 'atencao' | 'excesso_ate_20' | 'excesso_acima_20' | 'impeditivo';

export interface ReceitasMensaisMei {
  janeiro: string;
  fevereiro: string;
  marco: string;
  abril: string;
  maio: string;
  junho: string;
  julho: string;
  agosto: string;
  setembro: string;
  outubro: string;
  novembro: string;
  dezembro: string;
}

export interface SimulacaoMeiParams {
  competencia: string;
  ano: string;
  dataAbertura: string;
  tipoMei: TipoMei;
  atividade: 'comercio' | 'servico' | 'comercio_servico';
  receitasMensais: ReceitasMensaisMei;
  quantidadeEmpregados: string;
  possuiSocio: boolean;
  possuiFilial: boolean;
  ocupacaoCodigo: string;
}

export interface MemoriaCalculoMei {
  descricao: string;
  valor: string;
}

export interface ResultadoSimulacaoMei {
  tipoMei: TipoMei;
  atividade: SimulacaoMeiParams['atividade'];
  ocupacaoCodigo: string | null;
  ocupacaoConfirmada: boolean;
  quantidadeEmpregados: number;
  possuiSocio: boolean;
  possuiFilial: boolean;
  mesesConsideradosAcumulado: number;
  mesesConsideradosLimite: number;
  faturamentoAcumulado: number;
  faturamentoMes: number;
  limiteAnual: number;
  limiteProporcional: number;
  receitaAcumulada: number;
  receitaProjetada: number;
  percentualUtilizado: number;
  faixaRisco: FaixaRiscoMei;
  faixaRiscoDescricao: string;
  valorExcesso: number;
  desenquadramentoDescricao: string;
  status: string;
  dasMensalEstimado: number;
  competenciaParametros: string;
  versaoParametros: string;
  memoriaCalculo: MemoriaCalculoMei[];
  alertas: string[];
}

export const RECEITAS_MENSAIS_MEI_VAZIAS: ReceitasMensaisMei = {
  janeiro: '',
  fevereiro: '',
  marco: '',
  abril: '',
  maio: '',
  junho: '',
  julho: '',
  agosto: '',
  setembro: '',
  outubro: '',
  novembro: '',
  dezembro: '',
};
