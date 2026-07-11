import { supabase, supabaseProjectUrl } from '../../../../../../lib/supabase';
import { getAsaasBaseUrl, type BankEnvironment } from '../../gateway/bankGateway';

export interface AsaasEnvironmentConfig {
  apiKey: string;
  apiKeyConfigured: boolean;
  clearApiKey: boolean;
  apiVersion: 'v3' | 'v2';
  webhookUrl: string;
  webhookToken: string;
  webhookTokenConfigured: boolean;
  clearWebhookToken: boolean;
  tipoEnvio: 'sequencial' | 'nao_sequencial';
  filaSincronizacaoAtiva: boolean;
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

const getAsaasWebhookUrl = (_environment: BankEnvironment) => {
  const baseUrl = supabaseProjectUrl.replace(/\/$/, '');
  return `${baseUrl}/functions/v1/asaas-webhook`;
};

const defaultEnvironmentConfig = (environment: BankEnvironment): AsaasEnvironmentConfig => ({
  apiKey: '',
  apiKeyConfigured: false,
  clearApiKey: false,
  apiVersion: 'v3',
  webhookUrl: getAsaasWebhookUrl(environment),
  webhookToken: '',
  webhookTokenConfigured: false,
  clearWebhookToken: false,
  tipoEnvio: 'sequencial',
  filaSincronizacaoAtiva: false,
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
    clearApiKey: Boolean(candidate.clearApiKey),
    apiVersion: candidate.apiVersion === 'v2' ? 'v2' : 'v3',
    webhookUrl: fallback.webhookUrl,
    webhookToken: typeof candidate.webhookToken === 'string' ? candidate.webhookToken : '',
    webhookTokenConfigured: Boolean(candidate.webhookTokenConfigured || candidate.webhookToken),
    clearWebhookToken: Boolean(candidate.clearWebhookToken),
    tipoEnvio: candidate.tipoEnvio === 'nao_sequencial' ? 'nao_sequencial' : 'sequencial',
    filaSincronizacaoAtiva: typeof candidate.filaSincronizacaoAtiva === 'boolean' ? candidate.filaSincronizacaoAtiva : fallback.filaSincronizacaoAtiva,
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

const sanitizeSecretInput = (value: string) => value.replace(/•/g, '').trim();

const toEnvironmentPayload = (environment: BankEnvironment, config: AsaasEnvironmentConfig) => ({
  ...config,
  apiKey: sanitizeSecretInput(config.apiKey),
  webhookToken: sanitizeSecretInput(config.webhookToken),
  webhookUrl: getAsaasWebhookUrl(environment),
});

const toSecurePayload = (config: AsaasIntegrationConfig) => ({
  activeEnvironment: config.activeEnvironment,
  environments: {
    producao: toEnvironmentPayload('producao', config.environments.producao),
    homologacao: toEnvironmentPayload('homologacao', config.environments.homologacao),
  },
});

export const hasAsaasApiKey = (config: AsaasEnvironmentConfig | null | undefined) => (
  Boolean(config && !config.clearApiKey && (config.apiKey || config.apiKeyConfigured))
);

export const hasAsaasWebhookToken = (config: AsaasEnvironmentConfig | null | undefined) => (
  Boolean(config && !config.clearWebhookToken && (config.webhookToken || config.webhookTokenConfigured))
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
