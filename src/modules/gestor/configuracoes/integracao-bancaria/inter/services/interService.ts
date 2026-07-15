import { supabase, supabaseProjectUrl } from '../../../../../../lib/supabase';
import type { BankEnvironment } from '../../gateway/bankGateway';
import type {
  InterConnectionResult,
  InterEnvironmentConfig,
  InterIntegrationConfig,
  InterIntegrationStatus,
} from '../types/interTypes';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value)) return asRecord(value[0]);
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
};

const read = (record: Record<string, unknown>, ...keys: string[]) => {
  const key = keys.find((candidate) => record[candidate] !== undefined);
  return key ? record[key] : undefined;
};

const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;

const defaultEnvironment = (): InterEnvironmentConfig => ({
  clientId: '',
  clientIdConfigured: false,
  clientSecret: '',
  clientSecretConfigured: false,
  certificatePem: '',
  certificateConfigured: false,
  certificateFileName: '',
  certificateValidFrom: '',
  certificateValidUntil: '',
  privateKeyPem: '',
  privateKeyConfigured: false,
  privateKeyFileName: '',
  contaCorrente: '',
  chavePix: '',
  clearClientSecret: false,
  clearCertificate: false,
  clearPrivateKey: false,
  boletoAtivo: true,
  pixAtivo: true,
  webhookAtivo: true,
  webhookUrl: '',
});

export const defaultInterIntegration: InterIntegrationConfig = {
  activeEnvironment: 'homologacao',
  status: 'pendente',
  environments: {
    producao: defaultEnvironment(),
    homologacao: defaultEnvironment(),
  },
};

const normalizeStatus = (value: unknown): InterIntegrationStatus => {
  const status = asString(value).toLowerCase().replace(/\s+/g, '_');
  if (status === 'ativo' || status === 'configurado') return 'configurado';
  return status === 'em_validacao' || status === 'erro' ? status : 'pendente';
};

const normalizeEnvironment = (value: unknown, fallback: InterEnvironmentConfig): InterEnvironmentConfig => {
  const row = asRecord(value);
  return {
    clientId: asString(read(row, 'clientId', 'client_id')),
    clientIdConfigured: asBoolean(read(row, 'clientIdConfigured', 'client_id_configurado', 'client_id_configured')),
    clientSecret: '',
    clientSecretConfigured: asBoolean(read(row, 'clientSecretConfigured', 'client_secret_configurado', 'client_secret_configured')),
    certificatePem: '',
    certificateConfigured: asBoolean(read(row, 'certificateConfigured', 'certificadoConfigurado', 'certificado_configurado', 'certificate_configured')),
    certificateFileName: asString(read(row, 'certificateFileName', 'nome_certificado', 'certificate_file_name')),
    certificateValidFrom: asString(read(row, 'certificateValidFrom', 'certificadoValidoDe', 'certificado_valido_de')),
    certificateValidUntil: asString(read(row, 'certificateValidUntil', 'certificadoValidoAte', 'certificado_valido_ate')),
    privateKeyPem: '',
    privateKeyConfigured: asBoolean(read(row, 'privateKeyConfigured', 'chavePrivadaConfigurada', 'chave_privada_configurada', 'private_key_configured')),
    privateKeyFileName: asString(read(row, 'privateKeyFileName', 'nome_chave_privada', 'private_key_file_name')),
    // O Banco Inter exige x-conta-corrente apenas para aplicacoes vinculadas
    // a mais de uma conta. A configuracao padrao nao solicita esse dado.
    contaCorrente: '',
    chavePix: asString(read(row, 'chavePix', 'chave_pix')),
    clearClientSecret: false,
    clearCertificate: false,
    clearPrivateKey: false,
    boletoAtivo: asBoolean(read(row, 'boletoAtivo', 'boleto_ativo'), fallback.boletoAtivo),
    pixAtivo: asBoolean(read(row, 'pixAtivo', 'pix_ativo'), fallback.pixAtivo),
    webhookAtivo: asBoolean(read(row, 'webhookAtivo', 'webhook_ativo'), fallback.webhookAtivo),
    webhookUrl: asString(read(row, 'webhookUrl', 'webhook_url')),
  };
};

const normalizeInterConfig = (value: unknown): InterIntegrationConfig => {
  const root = asRecord(value);
  const environments = asRecord(read(root, 'environments', 'ambientes'));
  const modules = asRecord(read(root, 'modules', 'modulos'));
  const webhookId = asString(read(root, 'webhookId', 'webhook_id'));
  const webhookUrl = webhookId
    ? `${supabaseProjectUrl.replace(/\/$/, '')}/functions/v1/inter-webhook/${webhookId}`
    : '';
  const activeEnvironment = read(root, 'activeEnvironment', 'ambienteAtivo', 'ambiente_ativo') === 'producao'
    ? 'producao'
    : 'homologacao';
  const producao = normalizeEnvironment(environments.producao, defaultInterIntegration.environments.producao);
  const homologacao = normalizeEnvironment(environments.homologacao, defaultInterIntegration.environments.homologacao);
  const modulePatch = {
    boletoAtivo: asBoolean(modules.boleto, true),
    pixAtivo: asBoolean(modules.pix, true),
    webhookAtivo: asBoolean(modules.webhook, true),
  };
  return {
    activeEnvironment,
    status: normalizeStatus(root.status),
    environments: {
      producao: { ...producao, ...modulePatch, webhookUrl: webhookUrl ? `${webhookUrl}/producao` : '' },
      homologacao: { ...homologacao, ...modulePatch, webhookUrl: webhookUrl ? `${webhookUrl}/homologacao` : '' },
    },
  };
};

const cleanSecret = (value: string) => value.replace(/•/g, '').trim();

const toEnvironmentPayload = (config: InterEnvironmentConfig) => ({
  clientId: config.clientId.trim(),
  clientSecret: cleanSecret(config.clientSecret),
  certificadoPem: config.certificatePem.trim(),
  chavePrivadaPem: config.privateKeyPem.trim(),
  clearClientSecret: config.clearClientSecret,
  clearCertificate: config.clearCertificate,
  clearPrivateKey: config.clearPrivateKey,
  contaCorrente: '',
  chavePix: config.chavePix.trim(),
});

export const interService = {
  async getConfig(): Promise<InterIntegrationConfig> {
    const { data, error } = await supabase.rpc('listar_configuracao_inter');
    if (error) throw error;
    return normalizeInterConfig(data);
  },

  async updateConfig(config: InterIntegrationConfig): Promise<InterIntegrationConfig> {
    const activeConfig = config.environments[config.activeEnvironment];
    const payload = {
      activeEnvironment: config.activeEnvironment,
      modulos: {
        boleto: activeConfig.boletoAtivo,
        pix: activeConfig.pixAtivo,
        webhook: activeConfig.webhookAtivo,
      },
      environments: {
        producao: toEnvironmentPayload(config.environments.producao),
        homologacao: toEnvironmentPayload(config.environments.homologacao),
      },
    };
    const { data, error } = await supabase.rpc('upsert_configuracao_inter', { p_payload: payload });
    if (error) throw error;
    return normalizeInterConfig(data || payload);
  },

  async testConnection(environment: BankEnvironment): Promise<InterConnectionResult> {
    const { data, error } = await supabase.functions.invoke('inter-test-connection', {
      body: { action: 'teste', environment },
    });
    if (error) throw error;
    const result = asRecord(data);
    return {
      ok: Boolean(result.ok ?? result.success),
      message: asString(result.message ?? result.error ?? result.erro) || 'Conexão validada pelo Banco Inter.',
      checkedAt: asString(result.checkedAt ?? result.checked_at ?? result.testadoEm) || undefined,
      certificateValidFrom: asString(result.certificateValidFrom ?? result.certificadoValidoDe) || undefined,
      certificateValidUntil: asString(result.certificateValidUntil ?? result.certificadoValidoAte) || undefined,
      certificateDaysRemaining: typeof (result.certificateDaysRemaining ?? result.certificadoDiasRestantes) === 'number'
        ? Number(result.certificateDaysRemaining ?? result.certificadoDiasRestantes)
        : undefined,
    };
  },

  async configureWebhook(environment: BankEnvironment): Promise<InterConnectionResult> {
    const { data, error } = await supabase.functions.invoke('inter-test-connection', {
      body: { action: 'configurar_webhook', environment },
    });
    if (error) throw error;
    const result = asRecord(data);
    return {
      ok: Boolean(result.ok ?? result.success),
      message: asString(result.message ?? result.error ?? result.erro) || 'Webhook registrado no Banco Inter.',
      checkedAt: asString(result.checkedAt ?? result.checked_at ?? result.configuradoEm) || undefined,
    };
  },
};
