import type { FiscalConfigData, NfsHistoryItem, NfsStats } from './fiscalIntegrationTypes';

export const STORAGE_CONTEXTS_KEY = 'contabil_fiscal_municipal_contexts';
export const STORAGE_LEGACY_CONFIG_KEY = 'contabil_fiscal_config';
export const STORAGE_LEGACY_STATS_KEY = 'contabil_fiscal_stats';
export const STORAGE_LEGACY_HISTORY_KEY = 'contabil_fiscal_history';
export const MAX_HISTORY_ITEMS = 80;

export const DEFAULT_CONFIG: FiscalConfigData = {
  ambiente: 'homologacao',
  provedor: 'WebISS',
  usuarioWebService: '',
  senhaWebService: '',
  certificadoSenha: '',
  certificadoNome: '',
  certificadoEmpresa: '',
  certificadoCNPJ: '',
  certificadoEmitidoEm: '',
  certificadoValidade: '',
  certificadoDiasRestantes: 0,
  serieRps: 'A',
  ultimoNumeroRps: '0',
  proximoNumeroRps: '1',
  ultimoNumeroNfse: '0',
  inscricaoMunicipal: '',
  codigoCnae: '',
  codigoServico: '01.07',
  itemListaServico: '1.07 - Suporte técnico, manutenção de páginas e TI',
  aliquotaIss: '2.00',
  naturezaOperacao: '1 - Tributação no município',
  regimeEspecial: '1 - Microempresa Municipal',
  incentivadorCultural: '2 - Não',
  issRetido: '2 - Não',
};

export const DEFAULT_STATS: NfsStats = {
  emitidas: 0,
  canceladas: 0,
  rejeitadas: 0,
  pendentes: 0,
  ultimaEmissao: '',
  ultimoCancelamento: '',
  proximoNumeroNfse: '1',
  ultimoProtocolo: '',
};

export const DEFAULT_HISTORY: NfsHistoryItem[] = [];
