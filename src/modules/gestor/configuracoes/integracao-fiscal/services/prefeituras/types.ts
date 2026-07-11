export type FiscalAmbienteTipo = 'homologacao' | 'producao';

export interface FiscalPrefeituraAmbiente {
  ambiente: FiscalAmbienteTipo;
  url: string;
  observacao?: string;
}

export type FiscalPrefeituraOperacaoCategoria =
  | 'envio'
  | 'cancelamento'
  | 'substituicao'
  | 'consulta'
  | 'download';

export interface FiscalPrefeituraOperacao {
  id: string;
  categoria: FiscalPrefeituraOperacaoCategoria;
  titulo: string;
  metodoAbraf: string;
  soapAction: string;
  descricao: string;
  ativa: boolean;
  ambientes: {
    homologacao: boolean;
    producao: boolean;
  };
  observacoes?: string[];
  referencias?: string[];
  formasDeDownload?: string[];
}

export interface FiscalPrefeituraProfile {
  id: string;
  uf: string;
  municipio: string;
  providerId: string;
  providerLabel: string;
  identidadeVisual?: {
    prefeituraNome: string;
    prefeituraLogoUrl: string;
    marcaDaguaTexto?: string;
  };
  ambientes: {
    homologacao: FiscalPrefeituraAmbiente;
    producao: FiscalPrefeituraAmbiente;
  };
  capabilities: {
    cancelamentoWebservice: boolean;
    consultaSituacao?: boolean;
  };
  notes: string[];
  operacoes: FiscalPrefeituraOperacao[];
  fonte?: string;
}
