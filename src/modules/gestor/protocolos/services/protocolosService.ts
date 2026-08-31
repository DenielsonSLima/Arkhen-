import { gestaoEmpresarialService, type Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import type { ProtocoloTipoConfig, ProtocoloOrigemPadrao } from './protocolosCatalogoService';
import type { EntregaModelo } from '../protocolosCatalogo';
import { supabase } from '../../../../lib/supabase';
import { mapProtocolosError } from './protocolosError';

export type { EntregaModelo } from '../protocolosCatalogo';

export type ProtocoloStatus = 'Pendente' | 'Concluído';

export type ProtocoloPeriodoReferencia = 'Mensal' | '1ª quinzena' | '2ª quinzena' | 'Trimestral' | 'Semestral';
export type ProtocoloOrigem = ProtocoloOrigemPadrao | 'Cliente envia' | 'Escritório envia' | 'Ambos';

export interface Anotacao {
  id: string;
  data: string;
  texto: string;
  autor?: string;
  autorUserId?: string;
}

export interface ProtocoloEmpresaConfig {
  entregaId: string;
  ativo: boolean;
  periodicidade?: TipoFechamentoEntrega;
}

export interface ConfiguracaoProtocolosEmpresa {
  catalogo: ProtocoloTipoConfig[];
  configs: ProtocoloEmpresaConfig[];
}

export interface ProtocoloEntrega {
  id: string;
  empresaId: string;
  empresaNome: string;
  empresaCnpj: string;
  empresaStatus: Company['status'];
  empresaTipo: Company['tipo'];
  empresaTipoEstabelecimento: Company['tipoEstabelecimento'];
  empresaEmail: string;
  empresaTelefone: string;
  empresaLogo?: string;
  competencia: string;
  periodoReferencia: ProtocoloPeriodoReferencia;
  entregaId: string;
  entregaNome: string;
  categoria: EntregaModelo['categoria'];
  orgao?: string;
  origemPadrao: ProtocoloOrigem;
  prazo: string;
  status: ProtocoloStatus;
  atualizadoEm: string;
  responsavel: string;
  anotacoesList: Anotacao[];
  recebidoEm?: string;
  concluidoPor?: string;
  concluidoEm?: string;
  evidencia?: string;
  auditoriaPendente?: boolean;
  podeAlterarStatus: boolean;
  podeAnotar: boolean;
}

export type ProtocoloUpdate = {
  status?: ProtocoloStatus;
  anotacao?: string;
};

const mapProtocoloOperacional = (value: unknown): ProtocoloEntrega => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A consulta de protocolos retornou um item inválido.');
  }
  const row = value as Record<string, unknown>;
  return {
    ...(row as unknown as ProtocoloEntrega),
    podeAlterarStatus: row.podeAlterarStatus === true,
    podeAnotar: row.podeAnotar === true,
  };
};

const isConfiguracaoProtocolosEmpresa = (value: unknown): value is ConfiguracaoProtocolosEmpresa => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConfiguracaoProtocolosEmpresa>;
  return Array.isArray(candidate.catalogo) && Array.isArray(candidate.configs);
};

const obterConfiguracaoEmpresa = async (clienteId: string): Promise<ConfiguracaoProtocolosEmpresa> => {
  const { data, error } = await supabase.rpc('obter_configuracao_protocolos_cliente', {
    p_cliente_id: clienteId,
  });

  if (error) throw mapProtocolosError(error, 'carregar');
  if (!isConfiguracaoProtocolosEmpresa(data)) {
    throw new Error('A configuração de obrigações retornou um formato inválido. Atualize as migrações do banco.');
  }
  return data;
};

const persistirConfigEmpresa = async (companyId: string, configs: ProtocoloEmpresaConfig[]) => {
  const { error } = await supabase.rpc('salvar_configuracoes_protocolos_cliente', {
    p_cliente_id: companyId,
    p_configs: configs,
  });

  if (error) throw mapProtocolosError(error, 'salvar');
};

const persistirProtocolo = async (protocolo: ProtocoloEntrega, updates: ProtocoloUpdate) => {
  const anotacao = updates.anotacao?.trim();
  const payload = {
    id: protocolo.id,
    cliente_id: protocolo.empresaId,
    entrega_id: protocolo.entregaId,
    competencia: protocolo.competencia,
    periodo_referencia: protocolo.periodoReferencia,
    ...(updates.status ? { status: updates.status } : {}),
    ...(anotacao ? { anotacao } : {}),
  };
  const { data, error } = await supabase.rpc('salvar_protocolo_operacional_seguro', {
    p_payload: payload,
  });
  if (error) throw error;
  if (!data) throw new Error('A atualização não retornou o protocolo salvo.');
  return data;
};

export const protocolosService = {
  async getEntregasEmpresa(company: Pick<Company, 'id'>): Promise<ProtocoloEmpresaConfig[]> {
    return (await obterConfiguracaoEmpresa(company.id)).configs;
  },

  async getConfiguracaoEmpresa(company: Pick<Company, 'id'>): Promise<ConfiguracaoProtocolosEmpresa> {
    return obterConfiguracaoEmpresa(company.id);
  },

  async getEntregasEmpresaConfig(company: Pick<Company, 'id'>): Promise<ProtocoloEmpresaConfig[]> {
    return (await obterConfiguracaoEmpresa(company.id)).configs;
  },

  async saveEntregasEmpresa(companyOrId: Company | string, entregaIds: string[]) {
    const company = typeof companyOrId === 'string'
      ? await gestaoEmpresarialService.getCompanyById(companyOrId)
      : companyOrId;

    if (!company) return [];
    const configuracao = await obterConfiguracaoEmpresa(company.id);
    const selection = new Set(entregaIds);
    const configs = configuracao.configs.map((config) => ({
      ...config,
      ativo: selection.has(config.entregaId),
    }));

    await persistirConfigEmpresa(company.id, configs);
    return (await obterConfiguracaoEmpresa(company.id)).configs;
  },

  async saveEntregasEmpresaConfig(company: Pick<Company, 'id'>, configs: ProtocoloEmpresaConfig[]) {
    await persistirConfigEmpresa(company.id, configs);
    return obterConfiguracaoEmpresa(company.id);
  },

  async getProtocolos(): Promise<ProtocoloEntrega[]> {
    const { data, error } = await supabase.rpc('get_protocolos_operacionais_seguros');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('A consulta de protocolos retornou um formato inválido.');
    return data.map(mapProtocoloOperacional);
  },

  async updateProtocolo(id: string, updates: ProtocoloUpdate) {
    if (!updates.status && !updates.anotacao?.trim()) {
      throw new Error('Nenhuma alteração de protocolo foi informada.');
    }
    if (updates.status && (updates.anotacao?.trim().length || 0) < 8) {
      throw new Error('Informe uma evidência ou justificativa com pelo menos 8 caracteres.');
    }
    const protocolos = await this.getProtocolos();
    const target = protocolos.find((item) => item.id === id);
    if (!target) throw new Error('Protocolo não encontrado ou não configurado.');
    if (updates.status && !target.podeAlterarStatus) {
      throw new Error('Seu perfil não pode concluir ou reabrir este protocolo.');
    }
    if (!updates.status && updates.anotacao?.trim() && !target.podeAnotar) {
      throw new Error('Seu perfil não pode adicionar anotações neste protocolo.');
    }
    await persistirProtocolo(target, updates);
    return this.getProtocolos();
  },
};
