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
  data?: string;
  vencimento: string;
  valorRecebido: number;
  impostoEstimado: number;
}

export interface ResultadoSimulacaoGanhoCapital {
  valorVenda: number;
  valorVendaCorrespondenteParticipacao: number;
  valoresJaProporcionais: boolean;
  percentualPropriedade: number;
  custoAjustado: number;
  totalAlienacoesMesMesmaNatureza: number;
  ganhoBruto: number;
  ganhoCapital: number;
  valorIsento: number;
  parcelaIsenta: number;
  baseCalculo: number;
  ganhoTributavel: number;
  aliquotaMarginal: number;
  aliquotaEfetiva: number;
  impostoEstimado: number;
  vencimento: string;
  isencaoDescricao: string;
  isento: boolean;
  motivoIsencao: string;
  codigoDarf: string;
  dataReinvestimento: string | null;
  reinvestimento180DiasAplicado: boolean;
  competenciaParametros: string;
  versaoParametros: string;
  memoriaCalculo: ItemMemoriaGanhoCapital[];
  parcelas: ParcelaGanhoCapital[];
  cronogramaParcelas: ParcelaGanhoCapital[];
  alertas: string[];
}
