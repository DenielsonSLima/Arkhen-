export type TipoBemGanhoCapital = 'imovel' | 'imovel_residencial' | 'veiculo' | 'participacao_societaria' | 'outros';

export interface SimulacaoGanhoCapitalParams {
  tipoBem: TipoBemGanhoCapital;
  dataAquisicao: string;
  custoAquisicao: string;
  benfeitorias: string;
  valorVenda: string;
  despesasAlienacao: string;
  dataVenda: string;
  percentualParticipacao: string;
  unicoImovelAte440Mil: boolean;
  semOutraAlienacaoImovel5Anos: boolean;
  totalAlienacoesMesMesmaNatureza: string;
  reinvestimentoImovel180Dias: boolean;
  dataReinvestimento: string;
  valorReinvestido: string;
  vendaParcelada: boolean;
  cronogramaParcelas: Array<{ data: string; valor: string }>;
}

export interface ItemMemoriaGanhoCapital {
  descricao: string;
  valor: string;
}

export interface ParcelaGanhoCapital {
  numero: number;
  vencimento: string;
  valorRecebido: number;
  impostoEstimado: number;
}

export interface ResultadoSimulacaoGanhoCapital {
  custoAjustado: number;
  ganhoBruto: number;
  valorIsento: number;
  baseCalculo: number;
  aliquotaMarginal: number;
  aliquotaEfetiva: number;
  impostoEstimado: number;
  vencimento: string;
  isencaoDescricao: string;
  competenciaParametros: string;
  versaoParametros: string;
  memoriaCalculo: ItemMemoriaGanhoCapital[];
  parcelas: ParcelaGanhoCapital[];
  alertas: string[];
}
