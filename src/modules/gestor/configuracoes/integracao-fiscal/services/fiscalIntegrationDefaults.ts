import type { FiscalConfigData, NfsHistoryItem, NfsStats } from './fiscalIntegrationTypes';

export const STORAGE_CONTEXTS_KEY = 'contabil_fiscal_municipal_contexts';
export const STORAGE_LEGACY_CONFIG_KEY = 'contabil_fiscal_config';
export const STORAGE_LEGACY_STATS_KEY = 'contabil_fiscal_stats';
export const STORAGE_LEGACY_HISTORY_KEY = 'contabil_fiscal_history';
export const MAX_HISTORY_ITEMS = 80;

export const DEFAULT_CONFIG: FiscalConfigData = {
  ambiente: 'homologacao',
  provedor: 'WebISS',
  usuarioWebService: 'arkthen_integrador',
  senhaWebService: '••••••••••••',
  certificadoSenha: '••••••••',
  certificadoNome: 'Certificado Digital A1 - Arkthen Gestão',
  certificadoEmpresa: 'Arkthen Gestão Contábil Ltda',
  certificadoCNPJ: '12.345.678/0001-00',
  certificadoEmitidoEm: '2026-01-10',
  certificadoValidade: '2027-01-10',
  certificadoDiasRestantes: 185,
  serieRps: 'A',
  ultimoNumeroRps: '1542',
  proximoNumeroRps: '1543',
  ultimoNumeroNfse: '1539',
  codigoServico: '01.07',
  itemListaServico: '1.07 - Suporte técnico, manutenção de páginas e TI',
  aliquotaIss: '2.00',
  naturezaOperacao: '1 - Tributação no município',
  regimeEspecial: '1 - Microempresa Municipal',
  incentivadorCultural: '2 - Não',
  issRetido: '2 - Não',
};

export const DEFAULT_STATS: NfsStats = {
  emitidas: 1539,
  canceladas: 14,
  rejeitadas: 42,
  pendentes: 3,
  ultimaEmissao: '2026-07-08 14:32:10',
  ultimoCancelamento: '2026-06-15 09:12:44',
  proximoNumeroNfse: '1540',
  ultimoProtocolo: '202607080914852',
};

export const DEFAULT_HISTORY: NfsHistoryItem[] = [
  {
    id: 'h1',
    data: '2026-07-08',
    hora: '14:32:10',
    operacao: 'Emissão',
    numeroNfse: '1539',
    protocolo: '202607080914852',
    status: 'Sucesso',
    usuario: 'João Silva',
    mensagemPrefeitura: 'Nota fiscal emitida com sucesso.',
  },
  {
    id: 'h2',
    data: '2026-07-08',
    hora: '14:30:05',
    operacao: 'Emissão',
    numeroNfse: '1539',
    protocolo: '202607080914800',
    status: 'Erro',
    usuario: 'João Silva',
    mensagemPrefeitura: 'Erro 402: CNPJ do tomador inválido ou inexistente.',
  },
  {
    id: 'h3',
    data: '2026-07-07',
    hora: '17:15:33',
    operacao: 'Sincronização',
    numeroNfse: '-',
    protocolo: 'SYNC-991244',
    status: 'Sucesso',
    usuario: 'Karine',
    mensagemPrefeitura: 'Sincronização de dados da prefeitura concluída.',
  },
  {
    id: 'h4',
    data: '2026-07-05',
    hora: '10:00:22',
    operacao: 'Consulta',
    numeroNfse: '1538',
    protocolo: '202607050110022',
    status: 'Sucesso',
    usuario: 'Pedro',
    mensagemPrefeitura: 'Consulta realizada: NFS-e ativa na prefeitura.',
  },
  {
    id: 'h5',
    data: '2026-06-15',
    hora: '09:12:44',
    operacao: 'Cancelamento',
    numeroNfse: '1512',
    protocolo: 'CAN-112023',
    status: 'Sucesso',
    usuario: 'Fernanda',
    mensagemPrefeitura: 'NFS-e cancelada por solicitação do emitente.',
  }
];
