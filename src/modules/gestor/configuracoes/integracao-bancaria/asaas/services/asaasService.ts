import { supabase, supabaseProjectUrl } from '../../../../../../lib/supabase';
import { getAsaasBaseUrl, type BankEnvironment } from '../../gateway/bankGateway';

export interface AsaasEnvironmentConfig {
  apiKey: string;
  apiKeyConfigured: boolean;
  webhookUrl: string;
  webhookToken: string;
  webhookTokenConfigured: boolean;
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

const normalizeBankEnvironment = (environment: unknown): BankEnvironment => (
  environment === 'producao' ? 'producao' : 'homologacao'
);

const getAsaasWebhookUrl = (environment: BankEnvironment) => {
  const baseUrl = supabaseProjectUrl.replace(/\/$/, '');
  return `${baseUrl}/functions/v1/asaas-webhook?ambiente=${environment}`;
};

const defaultEnvironmentConfig = (environment: BankEnvironment): AsaasEnvironmentConfig => ({
  apiKey: '',
  apiKeyConfigured: false,
  webhookUrl: getAsaasWebhookUrl(environment),
  webhookToken: '',
  webhookTokenConfigured: false,
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

const normalizeEnvironment = (
  rawValue: unknown,
  fallback: AsaasEnvironmentConfig,
): AsaasEnvironmentConfig => {
  const candidate = rawValue && typeof rawValue === 'object'
    ? rawValue as Partial<AsaasEnvironmentConfig>
    : {};

  return {
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
    apiKeyConfigured: Boolean(candidate.apiKeyConfigured || candidate.apiKey),
    webhookUrl: fallback.webhookUrl,
    webhookToken: typeof candidate.webhookToken === 'string' ? candidate.webhookToken : '',
    webhookTokenConfigured: Boolean(candidate.webhookTokenConfigured || candidate.webhookToken),
    emailNotificacao: typeof candidate.emailNotificacao === 'boolean' ? candidate.emailNotificacao : fallback.emailNotificacao,
    aceitaBoleto: typeof candidate.aceitaBoleto === 'boolean' ? candidate.aceitaBoleto : fallback.aceitaBoleto,
    aceitaPix: typeof candidate.aceitaPix === 'boolean' ? candidate.aceitaPix : fallback.aceitaPix,
    aceitaCartao: typeof candidate.aceitaCartao === 'boolean' ? candidate.aceitaCartao : fallback.aceitaCartao,
    checkoutAtivo: typeof candidate.checkoutAtivo === 'boolean' ? candidate.checkoutAtivo : fallback.checkoutAtivo,
    maxParcelas: Number.isInteger(candidate.maxParcelas) && Number(candidate.maxParcelas) > 0
      ? Math.min(Number(candidate.maxParcelas), 12)
      : fallback.maxParcelas,
  };
};

const normalizeAsaasConfig = (rawValue: unknown): AsaasIntegrationConfig => {
  if (!rawValue || typeof rawValue !== 'object') return defaultAsaasIntegration;
  const candidate = rawValue as Partial<AsaasIntegrationConfig>;
  const activeEnvironment = normalizeBankEnvironment(candidate.activeEnvironment);

  return {
    activeEnvironment,
    environments: {
      producao: normalizeEnvironment(candidate.environments?.producao, defaultAsaasIntegration.environments.producao),
      homologacao: normalizeEnvironment(candidate.environments?.homologacao, defaultAsaasIntegration.environments.homologacao),
    },
  };
};

const toSecurePayload = (config: AsaasIntegrationConfig) => ({
  activeEnvironment: config.activeEnvironment,
  environments: {
    producao: {
      ...config.environments.producao,
      webhookUrl: getAsaasWebhookUrl('producao'),
    },
    homologacao: {
      ...config.environments.homologacao,
      webhookUrl: getAsaasWebhookUrl('homologacao'),
    },
  },
});

export const hasAsaasApiKey = (config: AsaasEnvironmentConfig | null | undefined) => (
  Boolean(config?.apiKey || config?.apiKeyConfigured)
);

export const hasAsaasWebhookToken = (config: AsaasEnvironmentConfig | null | undefined) => (
  Boolean(config?.webhookToken || config?.webhookTokenConfigured)
);

export const asaasService = {
  getBaseUrl(environment: BankEnvironment) {
    return getAsaasBaseUrl(environment);
  },

  getWebhookUrl(environment: BankEnvironment) {
    return getAsaasWebhookUrl(environment);
  },

  async getConfig(): Promise<AsaasIntegrationConfig> {
    const { data, error } = await supabase.rpc('listar_configuracao_asaas');
    if (error) throw error;
    return normalizeAsaasConfig(data);
  },

  async updateConfig(config: AsaasIntegrationConfig): Promise<AsaasIntegrationConfig> {
    const safeData = normalizeAsaasConfig(config);
    const { data, error } = await supabase.rpc('upsert_configuracao_asaas', {
      p_payload: toSecurePayload(safeData),
    });

    if (error) throw error;
    return normalizeAsaasConfig(data);
  },
};
