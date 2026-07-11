export type { FiscalAmbienteTipo, FiscalPrefeituraProfile } from './prefeituras/types';

export interface FiscalConfigData {
  ambiente: 'homologacao' | 'producao';
  provedor: string;
  usuarioWebService: string;
  senhaWebService: string;
  certificadoSenha?: string;
  certificadoNome?: string;
  certificadoEmpresa?: string;
  certificadoCNPJ?: string;
  certificadoEmitidoEm?: string;
  certificadoValidade?: string;
  certificadoDiasRestantes?: number;
  serieRps: string;
  ultimoNumeroRps: string;
  proximoNumeroRps: string;
  ultimoNumeroNfse: string;
  codigoServico: string;
  itemListaServico: string;
  aliquotaIss: string;
  naturezaOperacao: string;
  regimeEspecial: string;
  incentivadorCultural: string;
  issRetido: string;
}

export interface NfsStats {
  emitidas: number;
  canceladas: number;
  rejeitadas: number;
  pendentes: number;
  ultimaEmissao: string;
  ultimoCancelamento: string;
  proximoNumeroNfse: string;
  ultimoProtocolo: string;
}

export interface NfsHistoryItem {
  id: string;
  data: string;
  hora: string;
  operacao: 'Emissão' | 'Cancelamento' | 'Consulta' | 'Sincronização';
  numeroNfse: string;
  protocolo: string;
  status: 'Sucesso' | 'Erro' | 'Pendente';
  usuario: string;
  mensagemPrefeitura: string;
}

// Provider Adapter interface to support future expansion
export interface NfsProviderAdapter {
  id: string;
  name: string;
  testConnection(user: string, pass: string): Promise<{ success: boolean; message: string }>;
  emitNfse(config: FiscalConfigData, rpsNumber: string): Promise<{ success: boolean; nfseNumber?: string; protocolo?: string; message: string }>;
}

export interface FiscalMunicipalityContext {
  key: string;
  companyId: string;
  companyName: string;
  uf: string;
  municipio: string;
  isActive: boolean;
}

export interface FiscalMunicipalityData {
  context: FiscalMunicipalityContext;
  config: FiscalConfigData;
  stats: NfsStats;
  history: NfsHistoryItem[];
}

export interface FiscalLocationGroup {
  uf: string;
  municipios: FiscalMunicipioGroup[];
}

export interface FiscalMunicipioGroup {
  municipio: string;
  contexts: FiscalMunicipalityContext[];
}

export interface FiscalContextInput {
  companyId: string;
  companyName: string;
  uf: string;
  municipio: string;
}

export interface FiscalStoredContext {
  context: Omit<FiscalMunicipalityContext, 'key'>;
  config: FiscalConfigData;
  stats: NfsStats;
  history: NfsHistoryItem[];
  updatedAt: string;
}

export type FiscalStoredContexts = Record<string, FiscalStoredContext>;
