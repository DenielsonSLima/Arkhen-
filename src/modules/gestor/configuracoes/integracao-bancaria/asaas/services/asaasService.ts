import { getAsaasBaseUrl, type BankEnvironment } from '../../gateway/bankGateway';

export interface AsaasEnvironmentConfig {
  apiKey: string;
  webhookUrl: string;
  webhookToken: string;
  emailNotificacao: boolean;
  aceitaBoleto: boolean;
  aceitaPix: boolean;
  aceitaCartao: boolean;
  checkoutAtivo: boolean;
  maxParcelas: number;
}

export interface AsaasIntegrationConfig {
  activeEnvironment: BankEnvironment;
  environments: Record<BankEnvironment, AsaasEnvironmentConfig>;
}

const LOCAL_STORAGE_ASAAS_KEY = 'contabil_config_asaas';

const defaultEnvironmentConfig = (environment: BankEnvironment): AsaasEnvironmentConfig => ({
  apiKey: '',
  webhookUrl: environment === 'producao'
    ? 'https://api.contabil.com/webhooks/asaas'
    : 'https://api.contabil.com/webhooks/asaas/sandbox',
  webhookToken: '',
  emailNotificacao: true,
  aceitaBoleto: true,
  aceitaPix: true,
  aceitaCartao: false,
  checkoutAtivo: true,
  maxParcelas: 12,
});

export const defaultAsaasIntegration: AsaasIntegrationConfig = {
  activeEnvironment: 'homologacao',
  environments: {
    producao: defaultEnvironmentConfig('producao'),
    homologacao: defaultEnvironmentConfig('homologacao'),
  },
};

const readFromStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error('Erro ao ler config no localStorage:', err);
    return null;
  }
};

const writeToStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error('Erro ao salvar config no localStorage:', err);
  }
};

const normalizeEnvironment = (
  rawValue: unknown,
  fallback: AsaasEnvironmentConfig,
): AsaasEnvironmentConfig => {
  const candidate = rawValue && typeof rawValue === 'object'
    ? rawValue as Partial<AsaasEnvironmentConfig>
    : {};

  return {
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : fallback.apiKey,
    webhookUrl: typeof candidate.webhookUrl === 'string' ? candidate.webhookUrl : fallback.webhookUrl,
    webhookToken: typeof candidate.webhookToken === 'string' ? candidate.webhookToken : fallback.webhookToken,
    emailNotificacao: typeof candidate.emailNotificacao === 'boolean' ? candidate.emailNotificacao : fallback.emailNotificacao,
    aceitaBoleto: typeof candidate.aceitaBoleto === 'boolean' ? candidate.aceitaBoleto : fallback.aceitaBoleto,
    aceitaPix: typeof candidate.aceitaPix === 'boolean' ? candidate.aceitaPix : fallback.aceitaPix,
    aceitaCartao: typeof candidate.aceitaCartao === 'boolean' ? candidate.aceitaCartao : fallback.aceitaCartao,
    checkoutAtivo: typeof candidate.checkoutAtivo === 'boolean' ? candidate.checkoutAtivo : fallback.checkoutAtivo,
    maxParcelas: Number.isInteger(candidate.maxParcelas) && Number(candidate.maxParcelas) > 0
      ? Number(candidate.maxParcelas)
      : fallback.maxParcelas,
  };
};

const normalizeAsaasConfig = (rawValue: unknown): AsaasIntegrationConfig => {
  if (!rawValue || typeof rawValue !== 'object') return defaultAsaasIntegration;
  const candidate = rawValue as Partial<AsaasIntegrationConfig> & Partial<AsaasEnvironmentConfig> & { ambiente?: BankEnvironment };
  const legacyEnvironment = candidate.ambiente === 'producao' || candidate.ambiente === 'homologacao'
    ? candidate.ambiente
    : null;
  const activeEnvironment = candidate.activeEnvironment === 'producao' || candidate.activeEnvironment === 'homologacao'
    ? candidate.activeEnvironment
    : legacyEnvironment || defaultAsaasIntegration.activeEnvironment;

  if (!candidate.environments && (candidate.apiKey || candidate.webhookUrl || candidate.webhookToken)) {
    return {
      activeEnvironment,
      environments: {
        producao: normalizeEnvironment(activeEnvironment === 'producao' ? candidate : null, defaultAsaasIntegration.environments.producao),
        homologacao: normalizeEnvironment(activeEnvironment === 'homologacao' ? candidate : null, defaultAsaasIntegration.environments.homologacao),
      },
    };
  }

  return {
    activeEnvironment,
    environments: {
      producao: normalizeEnvironment(candidate.environments?.producao, defaultAsaasIntegration.environments.producao),
      homologacao: normalizeEnvironment(candidate.environments?.homologacao, defaultAsaasIntegration.environments.homologacao),
    },
  };
};

export const asaasService = {
  getBaseUrl(environment: BankEnvironment) {
    return getAsaasBaseUrl(environment);
  },

  async getConfig(): Promise<AsaasIntegrationConfig> {
    const data = readFromStorage(LOCAL_STORAGE_ASAAS_KEY);
    if (!data) return defaultAsaasIntegration;

    try {
      return normalizeAsaasConfig(JSON.parse(data));
    } catch {
      return defaultAsaasIntegration;
    }
  },

  async updateConfig(config: AsaasIntegrationConfig): Promise<AsaasIntegrationConfig> {
    const safeData = normalizeAsaasConfig(config);
    writeToStorage(LOCAL_STORAGE_ASAAS_KEY, JSON.stringify(safeData));
    await new Promise((resolve) => setTimeout(resolve, 500));
    return safeData;
  },
};
