export type XmlFiscalKind = 'nfse' | 'nfce' | 'nfe' | 'cte' | 'mdfe' | 'cancelado' | 'desconhecido';

export interface XmlFiscalField {
  label: string;
  value: string;
}

export interface XmlFiscalSection {
  title: string;
  fields: XmlFiscalField[];
}

export interface XmlFiscalParty {
  nome: string;
  documento: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

export interface NfseFiscalData {
  numero: string;
  codigoVerificacao: string;
  dataEmissao: string;
  competencia: string;
  municipioPrestacao: string;
  naturezaOperacao: string;
  regimeTributacao: string;
  optanteSimples: string;
  incentivadorCultural: string;
  prestador: XmlFiscalParty;
  tomador: XmlFiscalParty;
  discriminacao: string;
  codigoServico: string;
  itemListaServico: string;
  cnae: string;
  valorServicos: string;
  deducoes: string;
  descontos: string;
  baseCalculo: string;
  aliquota: string;
  valorIss: string;
  issRetido: string;
  valorLiquido: string;
  pis: string;
  cofins: string;
  inss: string;
  ir: string;
  csll: string;
  outrasInformacoes: string;
  qrPayload: string;
}

export interface XmlFiscalSummary {
  kind: XmlFiscalKind;
  label: string;
  title: string;
  subtitle: string;
  status: string;
  isCanceled: boolean;
  sections: XmlFiscalSection[];
  rawXml: string;
  nfse?: NfseFiscalData;
}
