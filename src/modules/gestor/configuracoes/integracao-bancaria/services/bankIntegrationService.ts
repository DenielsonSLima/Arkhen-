import { supabase } from '../../../../../lib/supabase';
import { bankGateways, type BankEnvironment, type BankGatewayId } from '../gateway/bankGateway';

export type BankIntegrationStatus = 'configurado' | 'em_validacao' | 'pendente' | 'erro';

export interface BankIntegrationSummary {
  provider: BankGatewayId;
  selected: boolean;
  configured: boolean;
  status: BankIntegrationStatus;
  environment: BankEnvironment;
  enabledModules: string[];
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const normalizeProvider = (value: unknown): BankGatewayId | null => {
  const provider = String(value || '').toLowerCase();
  return provider === 'inter' ? provider : null;
};

const normalizeStatus = (value: unknown, configured: boolean): BankIntegrationStatus => {
  const status = String(value || '').toLowerCase().replace(/\s+/g, '_');
  if (status === 'ativo') return 'configurado';
  if (status === 'nao_configurado') return 'pendente';
  if (status === 'configurado' || status === 'em_validacao' || status === 'pendente' || status === 'erro') {
    return status;
  }
  return configured ? 'configurado' : 'pendente';
};

const normalizeRow = (value: unknown, selectedProvider: BankGatewayId | null): BankIntegrationSummary | null => {
  const row = asRecord(value);
  const provider = normalizeProvider(row.provider ?? row.provedor ?? row.banco);
  if (!provider) return null;

  const rawStatus = String(row.status || '').toLowerCase();
  const configured = Boolean(row.configured ?? row.configurado ?? row.credenciais_configuradas)
    || rawStatus === 'ativo'
    || rawStatus === 'em_validacao';
  const modulesValue = row.enabledModules ?? row.modulos_habilitados ?? row.modulos;
  const enabledModules = Array.isArray(modulesValue)
    ? modulesValue.filter((item): item is string => typeof item === 'string')
    : Object.entries(asRecord(modulesValue))
      .filter(([, enabled]) => enabled === true)
      .map(([module]) => module);

  return {
    provider,
    selected: Boolean(row.selected ?? row.selecionado ?? row.ativo) || provider === selectedProvider,
    configured,
    status: normalizeStatus(row.status, configured),
    environment: (row.environment ?? row.ambiente) === 'producao' ? 'producao' : 'homologacao',
    enabledModules,
  };
};

const normalizeIntegrations = (value: unknown): BankIntegrationSummary[] => {
  const root = asRecord(value);
  const selectedProvider = normalizeProvider(
    root.selectedProvider ?? root.provedorSelecionado ?? root.provedor_selecionado ?? root.provedor_ativo,
  );
  const source = Array.isArray(value)
    ? value
    : Array.isArray(root.integrations)
      ? root.integrations
      : Array.isArray(root.integracoes)
        ? root.integracoes
        : [];
  const normalized = source
    .map((row) => normalizeRow(row, selectedProvider))
    .filter((row): row is BankIntegrationSummary => Boolean(row));

  return bankGateways.map((gateway) => normalized.find((row) => row.provider === gateway.id) || {
    provider: gateway.id,
    selected: gateway.id === (selectedProvider || 'inter'),
    configured: false,
    status: 'pendente',
    environment: 'homologacao',
    enabledModules: [],
  });
};

export const bankIntegrationService = {
  async list(): Promise<BankIntegrationSummary[]> {
    const { data, error } = await supabase.rpc('listar_integracoes_bancarias');
    if (error) throw error;
    return normalizeIntegrations(data);
  },

  async selectProvider(provider: BankGatewayId): Promise<BankIntegrationSummary[]> {
    const { data, error } = await supabase.rpc('selecionar_provedor_bancario', {
      p_provedor: provider,
    });
    if (error) throw error;
    if (data) return normalizeIntegrations(data);
    return this.list();
  },
};
