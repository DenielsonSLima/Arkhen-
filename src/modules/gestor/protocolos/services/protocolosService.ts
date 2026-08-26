import { gestaoEmpresarialService, type Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import { protocolosCatalogoService, type ProtocoloTipoConfig, type ProtocoloOrigemPadrao } from './protocolosCatalogoService';
import type { EntregaModelo } from '../protocolosCatalogo';
import { supabase } from '../../../../lib/supabase';

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

type ProtocoloConfigRow = {
  cliente_id: string;
  configs: unknown;
};

const PROTOCOLOS_CONFIG_TABLE = 'configuracoes_protocolos_empresas';
const ALLOWED_PERIODICIDADES = new Set<TipoFechamentoEntrega>(['mensal', 'quinzenal', 'trimestral', 'semestral']);

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

const isConfigMismatch = (value: ProtocoloEmpresaConfig[] | undefined, catalogo: ProtocoloTipoConfig[]) => {
  if (!Array.isArray(value)) return true;
  if (value.length !== catalogo.length) return true;
  const savedIds = new Set(value.map((item) => item.entregaId));
  return !catalogo.every((item) => savedIds.has(item.id));
};

const mapConfigFromDb = (companyId: string, catalogo: ProtocoloTipoConfig[], raw: unknown): ProtocoloEmpresaConfig[] => {
  const rawArray = Array.isArray(raw) ? raw as ProtocoloEmpresaConfig[] : [];
  const map = new Map<string, ProtocoloEmpresaConfig>();

  rawArray.forEach((item) => {
    if (!item?.entregaId) return;
    const periodicidade = ALLOWED_PERIODICIDADES.has(item.periodicidade as TipoFechamentoEntrega)
      ? item.periodicidade
      : undefined;
    map.set(item.entregaId, {
      entregaId: item.entregaId,
      ativo: item.ativo === true,
      periodicidade,
    });
  });

  const resolved = catalogo.map((item) => {
    const saved = map.get(item.id);
    return {
      entregaId: item.id,
      ativo: saved?.ativo === true,
      periodicidade: saved?.periodicidade ?? item.periodicidadePadrao,
    } satisfies ProtocoloEmpresaConfig;
  });

  if (isConfigMismatch(resolved, catalogo)) {
    console.warn(`[protocolosService] Configurações inconsistentes para empresa ${companyId}, normalizando com catálogo atual.`);
  }

  return resolved;
};

const persistirConfigEmpresa = async (companyId: string, configs: ProtocoloEmpresaConfig[]) => {
  try {
    const { error } = await supabase.rpc('salvar_configuracoes_protocolos_cliente', {
      p_cliente_id: companyId,
      p_configs: configs,
    });

    if (error) throw error;
  } catch (error) {
    console.error('[protocolosService] Erro ao persistir configuração de protocolos por empresa:', error);
    throw error;
  }
};

const loadEntregasEmpresaConfig = async (companyId: string): Promise<ProtocoloEmpresaConfig[]> => {
  const { data, error } = await supabase
    .from(PROTOCOLOS_CONFIG_TABLE)
    .select('configs')
    .eq('cliente_id', companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return [];
  return (data as ProtocoloConfigRow).configs as ProtocoloEmpresaConfig[];
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

const getCatalogoPersistidoPorRegime = async (company: Company) => {
  const catalogo = await protocolosCatalogoService.listCatalogoTodos();
  return catalogo.filter((item) => item.status === 'Ativo' && item.regimes.includes(company.tipo));
};

const getEntregasEmpresaConfig = async (
  company: Company,
  catalogo?: ProtocoloTipoConfig[],
): Promise<ProtocoloEmpresaConfig[]> => {
  const catalogoEmpresa = catalogo ?? await getCatalogoPersistidoPorRegime(company);
  const dbConfig = await loadEntregasEmpresaConfig(company.id);

  return mapConfigFromDb(company.id, catalogoEmpresa, dbConfig);
};

export const protocolosService = {
  getCatalogoEntregas: () => protocolosCatalogoService.getCatalogoAtivo(),

  getCatalogoPorRegime(company: Company): ProtocoloTipoConfig[] {
    return protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  },

  async getEntregasEmpresa(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return getEntregasEmpresaConfig(company);
  },

  async getConfiguracaoEmpresa(company: Company) {
    const catalogo = await getCatalogoPersistidoPorRegime(company);
    const configs = await getEntregasEmpresaConfig(company, catalogo);
    return { catalogo, configs };
  },

  async getEntregasEmpresaConfig(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return getEntregasEmpresaConfig(company);
  },

  async saveEntregasEmpresa(companyOrId: Company | string, entregaIds: string[]) {
    const company = typeof companyOrId === 'string'
      ? await gestaoEmpresarialService.getCompanyById(companyOrId)
      : companyOrId;

    if (!company) return [];
    const setup = await this.getConfiguracaoEmpresa(company);
    const catalogo = new Map(setup.catalogo.map((item) => [item.id, item]));
    const existing = setup.configs;
    const existingById = new Map(existing.map((item) => [item.entregaId, item]));

    const normalized = Array.from(catalogo.values()).map((modelo) => ({
      entregaId: modelo.id,
      ativo: entregaIds.includes(modelo.id),
      periodicidade: existingById.get(modelo.id)?.periodicidade ?? modelo.periodicidadePadrao,
    }));

    await persistirConfigEmpresa(company.id, normalized);
    return normalized;
  },

  async saveEntregasEmpresaConfig(company: Company, configs: ProtocoloEmpresaConfig[]) {
    const setup = await this.getConfiguracaoEmpresa(company);
    const catalogo = new Map(setup.catalogo.map((item) => [item.id, item]));
    const existing = setup.configs;
    const existingById = new Map(existing.map((item) => [item.entregaId, item]));
    const filtered: ProtocoloEmpresaConfig[] = [];

    for (const [entregaId, modelo] of catalogo.entries()) {
      const item = configs.find((entry) => entry?.entregaId === entregaId);
      const periodicidade = item?.periodicidade && ALLOWED_PERIODICIDADES.has(item.periodicidade)
        ? item.periodicidade
        : existingById.get(entregaId)?.periodicidade
          ?? modelo.periodicidadePadrao;
      filtered.push({
        entregaId,
        ativo: item?.ativo === true,
        periodicidade,
      });
    }

    await persistirConfigEmpresa(company.id, filtered);
    return filtered;
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
