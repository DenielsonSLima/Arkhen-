export interface MemoriaCalculoItem {
  descricao: string;
  base?: number;
  aliquota?: number | null;
  valor: number;
  observacao?: string;
}

export interface CarneLeaoParams {
  competencia: string;
  tipoAtividade: string;
  rendimentosPessoaFisica: string;
  rendimentosExterior: string;
  alugueis: string;
  previdenciaOficial: string;
  quantidadeDependentes: string;
  pensaoAlimenticia: string;
  despesasLivroCaixa: string;
  excessoLivroCaixaAnterior: string;
  impostoPagoExterior: string;
}

export interface ResultadoCarneLeao {
  rendimentosTributaveis: number;
  deducoesAdmitidas: number;
  baseCalculo: number;
  impostoTabela: number;
  reducaoAplicada: number;
  impostoDevido: number;
  codigoReceita: string;
  vencimento: string;
  excessoLivroCaixa: number;
  versaoParametros: string;
  memoriaCalculo: MemoriaCalculoItem[];
  alertas: string[];
}

export interface IrpfParams {
  anoCalendario: string;
  rendimentosTributaveis: string;
  rendimentosIsentos: string;
  rendimentosExclusivos: string;
  previdenciaOficial: string;
  quantidadeDependentes: string;
  despesasSaude: string;
  despesasEducacao: string;
  pensaoAlimenticia: string;
  pgbl: string;
  livroCaixa: string;
  irrfPago: string;
  carneLeaoPago: string;
  impostoComplementarPago: string;
  impostoPagoExterior: string;
  ganhoCapitalPago: string;
}

export interface ResultadoModeloIrpf {
  nome: string;
  totalDeducoes: number;
  baseCalculo: number;
  impostoApurado: number;
  reducaoAplicada: number;
  impostoDevido: number;
  impostoPago: number;
  saldoPagar: number;
  restituicaoEstimada: number;
}

export interface ResultadoIrpf {
  anoCalendario: string;
  exercicio: string;
  modeloRecomendado: string;
  modeloLegal: ResultadoModeloIrpf;
  modeloSimplificado: ResultadoModeloIrpf;
  versaoParametros: string;
  memoriaCalculo: MemoriaCalculoItem[];
  pendenciasDocumentais: string[];
  alertas: string[];
}

export interface LucrosDividendosParams {
  competencia: string;
  regimeTributario: 'simples_anexo_iii' | 'simples_anexo_iv' | 'lucro_presumido' | 'lucro_real';
  aliquotaCpp: string;
  proLabore: string;
  proLaboreAlternativo: string;
  proLaboreAcumuladoAno: string;
  lucroDisponivelComprovado: string;
  lucroContabilComprovado: boolean;
  dividendosNoMes: string;
  dividendosAcumuladosAno: string;
  outrosRendimentosAno: string;
  participacaoSocietaria: string;
}

export interface ResultadoLucrosDividendos {
  regimeTributario: string;
  aliquotaCppAplicada: number;
  cppIncluidaNoDas: boolean;
  proLaboreBruto: number;
  inssSocio: number;
  irrfProLabore: number;
  cppEmpresa: number;
  proLaboreLiquido: number;
  dividendosBrutos: number;
  retencaoDividendos: number;
  dividendosLiquidos: number;
  liquidoTotalSocio: number;
  custoTotalEmpresa: number;
  rendimentoAnualAcumulado: number;
  custoEmpresaProlabore: number;
  lucroDisponivelSocio: number;
  dividendosSimulados: number;
  rendaAnualProjetadaInformada: number;
  aliquotaMinimaAltaRendaIndicativa: number;
  cenarioAtual: CenarioLucrosDividendos;
  cenarioAlternativo: CenarioLucrosDividendos;
  diferencaLiquidoSocio: number;
  diferencaCustoEmpresa: number;
  lucroDisponivelComprovado: boolean;
  distribuicaoPermitida: boolean;
  alertaAltaRenda: boolean;
  mensagemAltaRenda: string;
  versaoParametros: string;
  memoriaCalculo: MemoriaCalculoItem[];
  alertas: string[];
}

export interface CenarioLucrosDividendos {
  prolabore: number;
  inss: number;
  irrf: number;
  cppEmpresa: number;
  liquidoSocioComDividendos: number;
  custoEmpresaProlabore: number;
}
