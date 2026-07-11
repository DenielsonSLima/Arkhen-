import {
  getAvailableUfs,
  getMunicipiosByUf,
} from './fiscalIntegrationCatalog';
import { getEnvironmentUrlForProfile, getPrefeituraProfile } from './prefeituras';
import { getAllPrefeituraProfiles } from './prefeituras';
import {
  DEFAULT_CONFIG,
  DEFAULT_HISTORY,
  DEFAULT_STATS,
  MAX_HISTORY_ITEMS,
  STORAGE_CONTEXTS_KEY,
  STORAGE_LEGACY_CONFIG_KEY,
  STORAGE_LEGACY_HISTORY_KEY,
  STORAGE_LEGACY_STATS_KEY,
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

export type { FiscalConfigData, NfsStats, NfsHistoryItem, FiscalMunicipalityContext, FiscalMunicipalityData, NfsProviderAdapter, FiscalLocationGroup, FiscalPrefeituraProfile } from './fiscalIntegrationTypes';

const resolveDefaultConfigForMunicipio = (input: { uf: string; municipio: string }) => {
  const profile = getPrefeituraProfile(input.uf, input.municipio);
  if (!profile) {
    return {
      ...DEFAULT_CONFIG,
    };
  }

  return {
    ...DEFAULT_CONFIG,
    provedor: profile.providerId,
  };
};

// WebISS adapter implementation
export class WebIssAdapter implements NfsProviderAdapter {
  id = 'WebISS';
  name = 'WebISS Provedor';

  async testConnection(user: string, pass: string): Promise<{ success: boolean; message: string }> {
    if (!user || !pass) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    if (user.toLowerCase() === 'erro' || pass.toLowerCase() === 'erro') {
      return { success: false, message: 'Falha de autenticação ou erro no servidor WebISS.' };
    }

    return { success: true, message: 'Conexão realizada com sucesso com o ambiente WebISS.' };
  }

  async emitNfse(config: FiscalConfigData, _rpsNumber: string): Promise<{ success: boolean; nfseNumber?: string; protocolo?: string; message: string }> {
    return {
      success: true,
      nfseNumber: String(Number(config.ultimoNumeroNfse) + 1),
      protocolo: `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      message: 'RPS convertido em NFS-e com sucesso.',
    };
  }
}

interface StoredMunicipalityEntry {
  context: Omit<FiscalMunicipalityContext, 'key'>;
  config: FiscalConfigData;
  stats: NfsStats;
  history: NfsHistoryItem[];
  updatedAt: string;
}

type StoredMunicipalities = Record<string, StoredMunicipalityEntry>;

const safeReadStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Erro ao ler localStorage de integração fiscal:', error);
    return null;
  }
};

const safeWriteStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Erro ao salvar no localStorage de integração fiscal:', error);
  }
};

const safeJsonParse = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeConfig = (value: unknown): FiscalConfigData => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const source = value as Partial<FiscalConfigData>;

  const normalizeString = (field: unknown, fallback: string) =>
    typeof field === 'string' ? field : fallback;

  const normalizeNumber = (field: unknown, fallback: number) => {
    if (typeof field === 'number' && Number.isFinite(field)) {
      return field;
    }
    return fallback;
  };

  const ambiente = source.ambiente === 'producao' || source.ambiente === 'homologacao'
    ? source.ambiente
    : DEFAULT_CONFIG.ambiente;

  return {
    ambiente,
    provedor: normalizeString(source.provedor, DEFAULT_CONFIG.provedor),
    usuarioWebService: normalizeString(source.usuarioWebService, DEFAULT_CONFIG.usuarioWebService),
    senhaWebService: normalizeString(source.senhaWebService, DEFAULT_CONFIG.senhaWebService),
    certificadoSenha: normalizeString(source.certificadoSenha, DEFAULT_CONFIG.certificadoSenha || ''),
    certificadoNome: normalizeString(source.certificadoNome, DEFAULT_CONFIG.certificadoNome || ''),
    certificadoEmpresa: normalizeString(source.certificadoEmpresa, DEFAULT_CONFIG.certificadoEmpresa || ''),
    certificadoCNPJ: normalizeString(source.certificadoCNPJ, DEFAULT_CONFIG.certificadoCNPJ || ''),
    certificadoEmitidoEm: normalizeString(source.certificadoEmitidoEm, DEFAULT_CONFIG.certificadoEmitidoEm || ''),
    certificadoValidade: normalizeString(source.certificadoValidade, DEFAULT_CONFIG.certificadoValidade || ''),
    certificadoDiasRestantes: normalizeNumber(
      source.certificadoDiasRestantes,
      DEFAULT_CONFIG.certificadoDiasRestantes || 0,
    ),
    serieRps: normalizeString(source.serieRps, DEFAULT_CONFIG.serieRps),
    ultimoNumeroRps: normalizeString(source.ultimoNumeroRps, DEFAULT_CONFIG.ultimoNumeroRps),
    proximoNumeroRps: normalizeString(source.proximoNumeroRps, DEFAULT_CONFIG.proximoNumeroRps),
    ultimoNumeroNfse: normalizeString(source.ultimoNumeroNfse, DEFAULT_CONFIG.ultimoNumeroNfse),
    codigoServico: normalizeString(source.codigoServico, DEFAULT_CONFIG.codigoServico),
    itemListaServico: normalizeString(source.itemListaServico, DEFAULT_CONFIG.itemListaServico),
    aliquotaIss: normalizeString(source.aliquotaIss, DEFAULT_CONFIG.aliquotaIss),
    naturezaOperacao: normalizeString(source.naturezaOperacao, DEFAULT_CONFIG.naturezaOperacao),
    regimeEspecial: normalizeString(source.regimeEspecial, DEFAULT_CONFIG.regimeEspecial),
    incentivadorCultural: normalizeString(source.incentivadorCultural, DEFAULT_CONFIG.incentivadorCultural),
    issRetido: normalizeString(source.issRetido, DEFAULT_CONFIG.issRetido),
  };
};

const normalizeStats = (value: unknown): NfsStats => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATS };
  }

  const source = value as Partial<NfsStats>;
  const normalizeNumber = (field: unknown, fallback: number) => {
    if (typeof field === 'number' && Number.isFinite(field)) {
      return field;
    }
    return fallback;
  };
  const normalizeString = (field: unknown, fallback: string) =>
    typeof field === 'string' ? field : fallback;

  return {
    emitidas: normalizeNumber(source.emitidas, DEFAULT_STATS.emitidas),
    canceladas: normalizeNumber(source.canceladas, DEFAULT_STATS.canceladas),
    rejeitadas: normalizeNumber(source.rejeitadas, DEFAULT_STATS.rejeitadas),
    pendentes: normalizeNumber(source.pendentes, DEFAULT_STATS.pendentes),
    ultimaEmissao: normalizeString(source.ultimaEmissao, DEFAULT_STATS.ultimaEmissao),
    ultimoCancelamento: normalizeString(source.ultimoCancelamento, DEFAULT_STATS.ultimoCancelamento),
    proximoNumeroNfse: normalizeString(source.proximoNumeroNfse, DEFAULT_STATS.proximoNumeroNfse),
    ultimoProtocolo: normalizeString(source.ultimoProtocolo, DEFAULT_STATS.ultimoProtocolo),
  };
};

const normalizeHistoryItem = (value: unknown): NfsHistoryItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<NfsHistoryItem>;
  const status = source.status === 'Sucesso' || source.status === 'Erro' || source.status === 'Pendente'
    ? source.status
    : 'Pendente';

  const operacao = source.operacao === 'Emissão' || source.operacao === 'Cancelamento' || source.operacao === 'Consulta' || source.operacao === 'Sincronização'
    ? source.operacao
    : 'Consulta';

  return {
    id: typeof source.id === 'string' ? source.id : `h-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    data: typeof source.data === 'string' ? source.data : new Date().toISOString().split('T')[0],
    hora: typeof source.hora === 'string' ? source.hora : new Date().toTimeString().split(' ')[0],
    operacao,
    numeroNfse: typeof source.numeroNfse === 'string' ? source.numeroNfse : '-',
    protocolo: typeof source.protocolo === 'string' ? source.protocolo : '-',
    status,
    usuario: typeof source.usuario === 'string' ? source.usuario : 'Sistema',
    mensagemPrefeitura: typeof source.mensagemPrefeitura === 'string' ? source.mensagemPrefeitura : '',
  };
};

const normalizeHistory = (value: unknown): NfsHistoryItem[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_HISTORY];
  }

  return value
    .map((item) => normalizeHistoryItem(item))
    .filter((item): item is NfsHistoryItem => Boolean(item))
    .slice(0, MAX_HISTORY_ITEMS);
};

const normalizeStoreEntry = (_key: string, value: unknown): StoredMunicipalityEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<StoredMunicipalityEntry> & { context?: unknown };
  const context = source.context;
  if (!context || typeof context !== 'object') {
    return null;
  }

  const validContext = context as Partial<FiscalMunicipalityContext>;
  if (!validContext.companyId || !validContext.uf || !validContext.municipio) {
    return null;
  }

  return {
    context: {
      companyId: String(validContext.companyId),
    companyName: String(validContext.companyName || 'Empresa de emissão'),
      uf: String(validContext.uf),
      municipio: String(validContext.municipio || 'Não informado'),
      isActive: Boolean(validContext.isActive),
    },
    config: normalizeConfig(source.config),
    stats: normalizeStats(source.stats),
    history: normalizeHistory(source.history),
    updatedAt: String(source.updatedAt || new Date().toISOString()),
  };
};

const readStore = (): StoredMunicipalities => {
  const stored = safeJsonParse(safeReadStorage(STORAGE_CONTEXTS_KEY));
  if (!stored || typeof stored !== 'object') return {};

  const parsed = stored as Record<string, unknown>;
  const normalized: StoredMunicipalities = {};

  Object.entries(parsed).forEach(([key, value]) => {
    const normalizedEntry = normalizeStoreEntry(key, value);
    if (normalizedEntry) {
      normalized[key] = normalizedEntry;
    }
  });

  return normalized;
};

const writeStore = (data: StoredMunicipalities): void => {
  safeWriteStorage(STORAGE_CONTEXTS_KEY, JSON.stringify(data));
};

const migrateLegacyContext = (): StoredMunicipalities => {
  const legacyConfig = normalizeConfig(safeJsonParse(safeReadStorage(STORAGE_LEGACY_CONFIG_KEY)));
  const legacyStats = normalizeStats(safeJsonParse(safeReadStorage(STORAGE_LEGACY_STATS_KEY)));
  const legacyHistory = normalizeHistory(safeJsonParse(safeReadStorage(STORAGE_LEGACY_HISTORY_KEY)));

  const key = makeContextKey({
    companyId: 'office',
    uf: 'SP',
    municipio: 'São Paulo',
  });

  return {
    [key]: {
      context: {
        companyId: 'office',
          companyName: 'Escritório (contabilidade)',
        uf: 'SP',
        municipio: 'São Paulo',
        isActive: true,
      },
      config: { ...normalizeConfig(legacyConfig) },
      stats: { ...normalizeStats(legacyStats) },
      history: legacyHistory.length ? legacyHistory : [...DEFAULT_HISTORY],
      updatedAt: new Date().toISOString(),
    },
  };
};

const toSnapshot = (key: string, entry: StoredMunicipalityEntry): FiscalMunicipalityData => ({
  context: {
    key,
    ...entry.context,
  },
  config: { ...normalizeConfig(entry.config) },
  stats: { ...normalizeStats(entry.stats) },
  history: [...normalizeHistory(entry.history)],
});

const getStore = (): StoredMunicipalities => {
  const persisted = readStore();
  if (Object.keys(persisted).length > 0) {
    return persisted;
  }

  const legacy = migrateLegacyContext();
  if (Object.keys(legacy).length > 0) {
    writeStore(legacy);
    return legacy;
  }

  return {};
};

const ensureContext = (input: FiscalContextInput): { key: string; store: StoredMunicipalities } => {
  const normalized = normalizeContextInput(input);
  const key = makeContextKey(normalized);
  const store = getStore();
  const current = store[key];

  if (!current) {
    store[key] = {
      context: {
        companyId: normalized.companyId,
        companyName: normalized.companyName,
        uf: normalized.uf,
        municipio: normalized.municipio,
        isActive: normalized.isActive,
      },
      config: resolveDefaultConfigForMunicipio({
        uf: normalized.uf,
        municipio: normalized.municipio,
      }),
      stats: { ...DEFAULT_STATS },
      history: [...DEFAULT_HISTORY],
      updatedAt: new Date().toISOString(),
    };
  } else {
    current.context = {
      ...current.context,
      companyId: normalized.companyId,
      companyName: normalized.companyName,
      uf: normalized.uf,
      municipio: normalized.municipio,
      isActive: current.context.isActive ?? true,
    };
    current.updatedAt = new Date().toISOString();
  }

  writeStore(store);
  return { key, store };
};

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

  getContext(input: FiscalContextInput): FiscalMunicipalityData {
    const { key, store } = ensureContext(input);
    return toSnapshot(key, store[key]);
  },

  getContextByKey(key: string): FiscalMunicipalityData | null {
    const store = getStore();
    const entry = store[key];
    if (!entry) return null;
    return toSnapshot(key, entry);
  },

  getContextList(): FiscalMunicipalityContext[] {
    const store = getStore();
    return Object.entries(store).map(([key, item]) => ({
      key,
      ...item.context,
    })).sort((a, b) => {
      const companyCompare = a.companyName.localeCompare(b.companyName, 'pt-BR');
      if (companyCompare !== 0) return companyCompare;
      const ufCompare = a.uf.localeCompare(b.uf, 'pt-BR');
      if (ufCompare !== 0) return ufCompare;
      return a.municipio.localeCompare(b.municipio, 'pt-BR');
    });
  },

  getContextTree(): FiscalLocationGroup[] {
    return groupContextsByLocation(this.getContextList());
  },

  getAvailablePrefeituraProfiles(): FiscalPrefeituraProfile[] {
    return getAllPrefeituraProfiles();
  },

  setContextActive(contextKey: string, active: boolean): FiscalMunicipalityData | null {
    const store = getStore();
    const entry = store[contextKey];
    if (!entry) return null;

    entry.context.isActive = Boolean(active);
    entry.updatedAt = new Date().toISOString();
    writeStore(store);
    return toSnapshot(contextKey, entry);
  },

  getConfig(context: FiscalContextInput): FiscalConfigData {
    return this.getContext(context).config;
  },

  saveConfig(context: FiscalContextInput, config: FiscalConfigData): void {
    const { key, store } = ensureContext(context);
    store[key].config = { ...normalizeConfig(config) };
    store[key].updatedAt = new Date().toISOString();
    writeStore(store);
  },

  getStats(context: FiscalContextInput): NfsStats {
    return this.getContext(context).stats;
  },

  saveStats(context: FiscalContextInput, stats: NfsStats): void {
    const { key, store } = ensureContext(context);
    store[key].stats = { ...normalizeStats(stats) };
    store[key].updatedAt = new Date().toISOString();
    writeStore(store);
  },

  getHistory(context: FiscalContextInput): NfsHistoryItem[] {
    return this.getContext(context).history;
  },

  saveHistory(context: FiscalContextInput, history: NfsHistoryItem[]): void {
    const { key, store } = ensureContext(context);
    store[key].history = normalizeHistory(history);
    store[key].updatedAt = new Date().toISOString();
    writeStore(store);
  },

  addHistoryItem(context: FiscalContextInput, item: Omit<NfsHistoryItem, 'id' | 'data' | 'hora'>): void {
    const { key, store } = ensureContext(context);
    const now = new Date();
    const normalizedItem = normalizeHistoryItem(item);
    const fallbackItem: NfsHistoryItem = {
      ...item,
      id: `h-${Date.now()}`,
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().split(' ')[0],
    };
    const newItem = normalizedItem || fallbackItem;

    const ordered = [newItem, ...store[key].history];
    store[key].history = ordered.slice(0, MAX_HISTORY_ITEMS);
    store[key].updatedAt = new Date().toISOString();
    writeStore(store);
  },

};
