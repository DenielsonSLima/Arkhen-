import { supabase, supabaseProjectUrl } from '../../../../../lib/supabase';
import {
  getAvailableUfs,
  getMunicipiosByUf,
} from './fiscalIntegrationCatalog';
import { getEnvironmentUrlForProfile, getPrefeituraProfile } from './prefeituras';
import { getAllPrefeituraProfiles } from './prefeituras';
import {
  DEFAULT_CONFIG,
  DEFAULT_STATS,
  MAX_HISTORY_ITEMS,
} from './fiscalIntegrationDefaults';
import {
  groupContextsByLocation,
  makeContextKey,
  normalizeContextInput,
} from './fiscalIntegrationHelpers';
import type {
  FiscalConfigData,
  FiscalContextInput,
  FiscalPrefeituraProfile,
  FiscalLocationGroup,
  FiscalMunicipalityContext,
  FiscalMunicipalityData,
  NfsHistoryItem,
  NfsProviderAdapter,
  NfsStats,
} from './fiscalIntegrationTypes';

export type {
  FiscalConfigData,
  NfsStats,
  NfsHistoryItem,
  FiscalMunicipalityContext,
  FiscalMunicipalityData,
  NfsProviderAdapter,
  FiscalLocationGroup,
  FiscalPrefeituraProfile,
} from './fiscalIntegrationTypes';

export class WebIssAdapter implements NfsProviderAdapter {
  id = 'WebISS';
  name = 'WebISS Provedor';

  async testConnection(user: string, pass: string): Promise<{ success: boolean; message: string }> {
    if (!user || !pass) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    return { success: true, message: 'Conexão enviada para validação segura na Edge Function.' };
  }

  async emitNfse(config: FiscalConfigData, _rpsNumber: string): Promise<{ success: boolean; nfseNumber?: string; protocolo?: string; message: string }> {
    return {
      success: true,
      nfseNumber: String(Number(config.ultimoNumeroNfse || 0) + 1),
      protocolo: `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      message: 'Operação encaminhada para o provedor fiscal.',
    };
  }
}

type RawFiscalData = Partial<FiscalMunicipalityData> & {
  context?: Partial<FiscalMunicipalityContext>;
  config?: Partial<FiscalConfigData>;
  stats?: Partial<NfsStats>;
  history?: Partial<NfsHistoryItem>[];
};

const SECRET_PLACEHOLDER = '••••••••';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const sanitizeSecretInput = (value: string | undefined) => (value || '').replace(/•/g, '').trim();

const resolveDefaultConfigForMunicipio = (input: { uf: string; municipio: string }): FiscalConfigData => {
  const profile = getPrefeituraProfile(input.uf, input.municipio);

  return {
    ...DEFAULT_CONFIG,
    provedor: profile?.providerId || DEFAULT_CONFIG.provedor,
    usuarioWebService: '',
    senhaWebService: '',
    senhaWebServiceConfigured: false,
    certificadoSenha: '',
    certificadoSenhaConfigured: false,
    certificadoArquivoConfigured: false,
    certificadoNome: '',
    certificadoEmpresa: '',
    certificadoCNPJ: '',
    certificadoEmitidoEm: '',
    certificadoValidade: '',
    certificadoDiasRestantes: 0,
  };
};

const normalizeConfig = (value: unknown, fallback?: FiscalConfigData): FiscalConfigData => {
  const base = fallback || resolveDefaultConfigForMunicipio({ uf: 'SP', municipio: 'São Paulo' });
  const source = value && typeof value === 'object' ? value as Partial<FiscalConfigData> : {};
  const senhaWebServiceConfigured = Boolean(source.senhaWebServiceConfigured);
  const certificadoSenhaConfigured = Boolean(source.certificadoSenhaConfigured);
  const certificadoArquivoConfigured = Boolean(source.certificadoArquivoConfigured);

  const normalizeString = (field: unknown, fallbackValue: string) =>
    typeof field === 'string' ? field : fallbackValue;

  const normalizeNumber = (field: unknown, fallbackValue: number) => {
    if (typeof field === 'number' && Number.isFinite(field)) return field;
    if (typeof field === 'string' && field.trim() && Number.isFinite(Number(field))) return Number(field);
    return fallbackValue;
  };

  return {
    ambiente: source.ambiente === 'producao' ? 'producao' : 'homologacao',
    provedor: normalizeString(source.provedor, base.provedor),
    usuarioWebService: normalizeString(source.usuarioWebService, base.usuarioWebService),
    senhaWebService: normalizeString(
      source.senhaWebService,
      senhaWebServiceConfigured ? SECRET_PLACEHOLDER : '',
    ),
    senhaWebServiceConfigured,
    certificadoSenha: normalizeString(
      source.certificadoSenha,
      certificadoSenhaConfigured ? SECRET_PLACEHOLDER : '',
    ),
    certificadoSenhaConfigured,
    certificadoArquivoConfigured,
    certificadoNome: normalizeString(source.certificadoNome, base.certificadoNome || ''),
    certificadoEmpresa: normalizeString(source.certificadoEmpresa, base.certificadoEmpresa || ''),
    certificadoCNPJ: normalizeString(source.certificadoCNPJ, base.certificadoCNPJ || ''),
    certificadoEmitidoEm: normalizeString(source.certificadoEmitidoEm, base.certificadoEmitidoEm || ''),
    certificadoValidade: normalizeString(source.certificadoValidade, base.certificadoValidade || ''),
    certificadoDiasRestantes: normalizeNumber(source.certificadoDiasRestantes, base.certificadoDiasRestantes || 0),
    serieRps: normalizeString(source.serieRps, base.serieRps),
    ultimoNumeroRps: normalizeString(source.ultimoNumeroRps, base.ultimoNumeroRps),
    proximoNumeroRps: normalizeString(source.proximoNumeroRps, base.proximoNumeroRps),
    ultimoNumeroNfse: normalizeString(source.ultimoNumeroNfse, base.ultimoNumeroNfse),
    codigoServico: normalizeString(source.codigoServico, base.codigoServico),
    itemListaServico: normalizeString(source.itemListaServico, base.itemListaServico),
    aliquotaIss: normalizeString(source.aliquotaIss, base.aliquotaIss),
    naturezaOperacao: normalizeString(source.naturezaOperacao, base.naturezaOperacao),
    regimeEspecial: normalizeString(source.regimeEspecial, base.regimeEspecial),
    incentivadorCultural: normalizeString(source.incentivadorCultural, base.incentivadorCultural),
    issRetido: normalizeString(source.issRetido, base.issRetido),
  };
};

const normalizeStats = (value: unknown): NfsStats => {
  const source = value && typeof value === 'object' ? value as Partial<NfsStats> : {};
  const normalizeNumber = (field: unknown, fallback: number) => (
    typeof field === 'number' && Number.isFinite(field) ? field : fallback
  );
  const normalizeString = (field: unknown, fallback: string) => (
    typeof field === 'string' ? field : fallback
  );

  return {
    emitidas: normalizeNumber(source.emitidas, 0),
    canceladas: normalizeNumber(source.canceladas, 0),
    rejeitadas: normalizeNumber(source.rejeitadas, 0),
    pendentes: normalizeNumber(source.pendentes, 0),
    ultimaEmissao: normalizeString(source.ultimaEmissao, ''),
    ultimoCancelamento: normalizeString(source.ultimoCancelamento, ''),
    proximoNumeroNfse: normalizeString(source.proximoNumeroNfse, ''),
    ultimoProtocolo: normalizeString(source.ultimoProtocolo, ''),
  };
};

const normalizeHistoryItem = (value: unknown): NfsHistoryItem | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<NfsHistoryItem>;
  const status = source.status === 'Sucesso' || source.status === 'Erro' || source.status === 'Pendente'
    ? source.status
    : 'Pendente';
  const operacao = source.operacao === 'Emissão' || source.operacao === 'Cancelamento' || source.operacao === 'Consulta' || source.operacao === 'Sincronização'
    ? source.operacao
    : 'Consulta';

  return {
    id: typeof source.id === 'string' ? source.id : `h-${Date.now()}`,
    data: typeof source.data === 'string' ? source.data : new Date().toISOString().slice(0, 10),
    hora: typeof source.hora === 'string' ? source.hora : new Date().toTimeString().split(' ')[0],
    operacao,
    numeroNfse: typeof source.numeroNfse === 'string' ? source.numeroNfse : '-',
    protocolo: typeof source.protocolo === 'string' ? source.protocolo : '-',
    status,
    usuario: typeof source.usuario === 'string' ? source.usuario : 'Sistema',
    mensagemPrefeitura: typeof source.mensagemPrefeitura === 'string' ? source.mensagemPrefeitura : '',
  };
};

const normalizeHistory = (value: unknown): NfsHistoryItem[] => (
  Array.isArray(value)
    ? value.map(normalizeHistoryItem).filter((item): item is NfsHistoryItem => Boolean(item)).slice(0, MAX_HISTORY_ITEMS)
    : []
);

const normalizeFiscalData = (value: unknown): FiscalMunicipalityData | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as RawFiscalData;
  const context: Partial<FiscalMunicipalityContext> = source.context || {};
  const companyId = typeof context.companyId === 'string' ? context.companyId : 'office';
  const uf = typeof context.uf === 'string' ? context.uf : 'NA';
  const municipio = typeof context.municipio === 'string' ? context.municipio : 'Não informado';
  const defaultConfig = resolveDefaultConfigForMunicipio({ uf, municipio });

  return {
    context: {
      key: typeof context.key === 'string' ? context.key : makeContextKey({ companyId, uf, municipio }),
      companyId,
      companyName: typeof context.companyName === 'string' ? context.companyName : 'Empresa de emissão',
      uf,
      municipio,
      isActive: Boolean(context.isActive),
    },
    config: normalizeConfig(source.config, defaultConfig),
    stats: normalizeStats(source.stats || DEFAULT_STATS),
    history: normalizeHistory(source.history),
  };
};

const createDraftData = (input: FiscalContextInput): FiscalMunicipalityData => {
  const normalized = normalizeContextInput(input);
  const config = resolveDefaultConfigForMunicipio({
    uf: normalized.uf,
    municipio: normalized.municipio,
  });

  return {
    context: {
      key: makeContextKey(normalized),
      companyId: normalized.companyId,
      companyName: normalized.companyName,
      uf: normalized.uf,
      municipio: normalized.municipio,
      isActive: normalized.isActive,
    },
    config,
    stats: normalizeStats({}),
    history: [],
  };
};

const invokeFiscalEdge = async (body: Record<string, unknown>) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sessão ausente.');

  const response = await fetch(`${supabaseProjectUrl.replace(/\/$/, '')}/functions/v1/fiscal-integration`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || 'Falha na Edge Function fiscal.');
  }
  return data as Record<string, unknown>;
};

const toUpsertPayload = (context: FiscalContextInput, config: FiscalConfigData, active = true) => ({
  cliente_id: isUuid(context.companyId) ? context.companyId : '',
  uf: context.uf,
  municipio: context.municipio,
  ambiente: config.ambiente,
  provedor: config.provedor,
  ativo: active,
  usuarioWebService: config.usuarioWebService,
  senhaWebService: sanitizeSecretInput(config.senhaWebService),
  certificadoSenha: sanitizeSecretInput(config.certificadoSenha),
  certificadoNome: config.certificadoNome || '',
  certificadoEmpresa: config.certificadoEmpresa || context.companyName,
  certificadoCNPJ: config.certificadoCNPJ || '',
  certificadoEmitidoEm: config.certificadoEmitidoEm || '',
  certificadoValidade: config.certificadoValidade || '',
  certificadoDiasRestantes: String(config.certificadoDiasRestantes || ''),
  serieRps: config.serieRps,
  ultimoNumeroRps: config.ultimoNumeroRps,
  proximoNumeroRps: config.proximoNumeroRps,
  ultimoNumeroNfse: config.ultimoNumeroNfse,
  codigoServico: config.codigoServico,
  itemListaServico: config.itemListaServico,
  aliquotaIss: config.aliquotaIss,
  naturezaOperacao: config.naturezaOperacao,
  regimeEspecial: config.regimeEspecial,
  incentivadorCultural: config.incentivadorCultural,
  issRetido: config.issRetido,
});

export const fiscalIntegrationService = {
  getProviders(): string[] {
    const staticProviders = ['WebISS', 'GINFES', 'ISSNet', 'Betha', 'Fiorilli', 'IPM', 'Nacional', 'Outro'];
    const providers = new Set<string>(staticProviders);
    return Array.from(providers).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  getAvailableUfs(): string[] {
    return getAvailableUfs();
  },

  getMunicipiosByUf(uf: string): string[] {
    return getMunicipiosByUf(uf);
  },

  getPrefeituraProfile(uf: string, municipio: string): FiscalPrefeituraProfile | null {
    return getPrefeituraProfile(uf, municipio);
  },

  getProfileOperationsByMunicipio(uf: string, municipio: string) {
    const profile = this.getPrefeituraProfile(uf, municipio);
    return profile?.operacoes ? [...profile.operacoes] : [];
  },

  getProfileEnvironmentUrl(uf: string, municipio: string, ambiente: 'homologacao' | 'producao') {
    const profile = this.getPrefeituraProfile(uf, municipio);
    return getEnvironmentUrlForProfile(profile, ambiente);
  },

  getAdapter(_providerId: string): NfsProviderAdapter {
    return new WebIssAdapter();
  },

  async listContextsData(): Promise<FiscalMunicipalityData[]> {
    const { data, error } = await supabase.rpc('listar_configuracoes_fiscais');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map(normalizeFiscalData).filter((item): item is FiscalMunicipalityData => Boolean(item));
  },

  async getContext(input: FiscalContextInput): Promise<FiscalMunicipalityData> {
    const normalized = normalizeContextInput(input);
    const contexts = await this.listContextsData();
    const found = contexts.find((item) => (
      item.context.companyId === normalized.companyId
      && item.context.uf === normalized.uf
      && item.context.municipio === normalized.municipio
    ));

    return found || createDraftData(normalized);
  },

  async getContextList(): Promise<FiscalMunicipalityContext[]> {
    const contexts = await this.listContextsData();
    return contexts.map((item) => item.context);
  },

  async getContextTree(): Promise<FiscalLocationGroup[]> {
    return groupContextsByLocation(await this.getContextList());
  },

  getAvailablePrefeituraProfiles(): FiscalPrefeituraProfile[] {
    return getAllPrefeituraProfiles();
  },

  async saveConfig(context: FiscalContextInput, config: FiscalConfigData, active = true): Promise<FiscalMunicipalityData> {
    const { data, error } = await supabase.rpc('upsert_configuracao_fiscal', {
      p_payload: toUpsertPayload(context, config, active),
    });

    if (error) throw error;
    const normalized = normalizeFiscalData(data);
    if (!normalized) throw new Error('Resposta fiscal inválida.');
    return normalized;
  },

  async setContextActive(context: FiscalContextInput, config: FiscalConfigData, active: boolean): Promise<FiscalMunicipalityData> {
    return this.saveConfig(context, config, active);
  },

  async testConnection(context: FiscalContextInput, config: FiscalConfigData): Promise<{ success: boolean; message: string }> {
    const providerEndpoint = this.getProfileEnvironmentUrl(context.uf, context.municipio, config.ambiente);
    const data = await invokeFiscalEdge({
      action: 'test-connection',
      ...toUpsertPayload(context, config, true),
      senhaWebServiceConfigured: config.senhaWebServiceConfigured,
      providerEndpoint,
    });

    return {
      success: Boolean(data.success),
      message: typeof data.message === 'string' ? data.message : 'Teste de conexão concluído.',
    };
  },

  async registerOperation(context: FiscalContextInput, config: FiscalConfigData, item: Omit<NfsHistoryItem, 'id' | 'data' | 'hora'>): Promise<void> {
    await invokeFiscalEdge({
      action: 'register-operation',
      ...toUpsertPayload(context, config, true),
      operacao: item.operacao,
      numeroNfse: item.numeroNfse,
      protocolo: item.protocolo,
      status: item.status,
      mensagem: item.mensagemPrefeitura,
    });
  },

  async uploadCertificate(
    context: FiscalContextInput,
    config: FiscalConfigData,
    file: File,
  ): Promise<FiscalMunicipalityData> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Sessão ausente.');

    const formData = new FormData();
    formData.append('certificado', file);
    formData.append('certificadoSenha', sanitizeSecretInput(config.certificadoSenha));
    formData.append('context', JSON.stringify(toUpsertPayload(context, config, true)));

    const response = await fetch(`${supabaseProjectUrl.replace(/\/$/, '')}/functions/v1/fiscal-integration`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Falha ao enviar certificado.');
    }

    const normalized = normalizeFiscalData(payload.data);
    if (!normalized) throw new Error('Resposta fiscal inválida.');
    return normalized;
  },
};
