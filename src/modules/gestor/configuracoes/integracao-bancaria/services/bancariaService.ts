export interface AsaasConfigDados {
  apiKey: string;
  ambiente: 'producao' | 'homologacao';
  webhookUrl: string;
  webhookToken: string;
  emailNotificacao: boolean;
  aceitaBoleto: boolean;
  aceitaPix: boolean;
  aceitaCartao: boolean;
  maxParcelas: number;
}

const LOCAL_STORAGE_ASAAS_KEY = 'contabil_config_asaas';

export const defaultAsaas: AsaasConfigDados = {
  apiKey: 'asaas_key_prod_abc123xyz789_placeholder',
  ambiente: 'homologacao',
  webhookUrl: 'https://api.contabil.com/webhooks/asaas',
  webhookToken: 'token_signature_webhook_sec_456',
  emailNotificacao: true,
  aceitaBoleto: true,
  aceitaPix: true,
  aceitaCartao: false,
  maxParcelas: 12,
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

const normalizeAsaasConfig = (rawValue: unknown): AsaasConfigDados => {
  if (!rawValue || typeof rawValue !== 'object') {
    return defaultAsaas;
  }

  const candidate = rawValue as Partial<AsaasConfigDados>;

  return {
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : defaultAsaas.apiKey,
    ambiente: candidate.ambiente === 'producao' || candidate.ambiente === 'homologacao'
      ? candidate.ambiente
      : defaultAsaas.ambiente,
    webhookUrl: typeof candidate.webhookUrl === 'string' ? candidate.webhookUrl : defaultAsaas.webhookUrl,
    webhookToken: typeof candidate.webhookToken === 'string' ? candidate.webhookToken : defaultAsaas.webhookToken,
    emailNotificacao: typeof candidate.emailNotificacao === 'boolean' ? candidate.emailNotificacao : defaultAsaas.emailNotificacao,
    aceitaBoleto: typeof candidate.aceitaBoleto === 'boolean' ? candidate.aceitaBoleto : defaultAsaas.aceitaBoleto,
    aceitaPix: typeof candidate.aceitaPix === 'boolean' ? candidate.aceitaPix : defaultAsaas.aceitaPix,
    aceitaCartao: typeof candidate.aceitaCartao === 'boolean' ? candidate.aceitaCartao : defaultAsaas.aceitaCartao,
    maxParcelas: candidate.maxParcelas !== undefined &&
      Number.isInteger(candidate.maxParcelas) &&
      candidate.maxParcelas > 0
      ? candidate.maxParcelas
      : defaultAsaas.maxParcelas,
  };
};

export const bancariaService = {
  async getAsaasConfig(): Promise<AsaasConfigDados> {
    const data = readFromStorage(LOCAL_STORAGE_ASAAS_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return normalizeAsaasConfig(parsed);
      } catch {
        return defaultAsaas;
      }
    }
    return defaultAsaas;
  },

  async updateAsaasConfig(dados: AsaasConfigDados): Promise<boolean> {
    const safeData = normalizeAsaasConfig(dados);
    writeToStorage(LOCAL_STORAGE_ASAAS_KEY, JSON.stringify(safeData));
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  },
};
