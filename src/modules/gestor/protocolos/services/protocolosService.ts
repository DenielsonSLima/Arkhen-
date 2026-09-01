import { supabase } from '../../../../lib/supabase';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import type { EntregaModelo } from '../protocolosCatalogo';
import {
  protocolosCatalogoService,
  type ProtocoloOrigemPadrao,
  type ProtocoloTipoConfig,
} from './protocolosCatalogoService';
import { evidenceRequiredError, mapProtocolosError, ProtocolosError } from './protocolosError';

export type { EntregaModelo } from '../protocolosCatalogo';
export { getProtocolosErrorMessage, ProtocolosError } from './protocolosError';

export type ProtocoloStatus = 'Pendente' | 'Concluído';
export type ProtocoloPeriodoReferencia = 'Mensal' | '1ª quinzena' | '2ª quinzena' | 'Trimestral' | 'Semestral';
export type ProtocoloOrigem = ProtocoloOrigemPadrao | 'Cliente envia' | 'Escritório envia' | 'Ambos';
export type ProtocoloPeriodicidade = TipoFechamentoEntrega | 'diaria' | 'semanal' | 'personalizada';

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
  periodicidade?: ProtocoloPeriodicidade;
  dataInicial?: string;
  proximaExecucao?: string;
  diaMes?: number;
  diaSemana?: number;
  intervaloDias?: number;
  incluirFinaisDeSemana?: boolean;
}

export interface ConfiguracaoProtocolosEmpresa {
  catalogo: ProtocoloTipoConfig[];
  configs: ProtocoloEmpresaConfig[];
  updatedAt: string | null;
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
  evidencia?: string;
  concluidoEm?: string;
  auditoriaPendente?: boolean;
  podeAlterarStatus?: boolean;
  podeAnotar?: boolean;
}

export type ProtocoloUpdate = Partial<Pick<
  ProtocoloEntrega,
  'status' | 'anotacoesList' | 'recebidoEm' | 'concluidoPor'
>> & {
  anotacao?: string;
};

type JsonRecord = Record<string, unknown>;

const READ_PROTOCOLS_RPC = 'get_protocolos_operacionais_seguros';
const SAVE_PROTOCOL_RPC = 'salvar_protocolo_operacional_seguro';
const READ_CONFIG_RPC = 'obter_configuracao_protocolos_cliente';
const SAVE_CONFIG_RPC = 'salvar_configuracoes_protocolos_cliente_v2';

const PERIODICIDADES = new Set<ProtocoloPeriodicidade>([
  'diaria',
  'semanal',
  'quinzenal',
  'mensal',
  'trimestral',
  'semestral',
  'personalizada',
]);
const PERIODICIDADES_CATALOGO = new Set<TipoFechamentoEntrega>([
  'quinzenal',
  'mensal',
  'trimestral',
  'semestral',
]);
const REGIMES = new Set<Company['tipo']>([
  'PF',
  'MEI',
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'Isenta',
]);

const asRecord = (value: unknown): JsonRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
);

const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asOptionalString = (value: unknown) => {
  const text = asString(value);
  return text || undefined;
};
const asOptionalInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) ? value : undefined
);

const normalizeAnotacoes = (value: unknown): Anotacao[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = asRecord(raw);
    if (!item || !asString(item.texto)) return [];
    return [{
      id: asString(item.id),
      data: asString(item.data),
      texto: asString(item.texto),
      autor: asOptionalString(item.autor),
      autorUserId: asOptionalString(item.autorUserId),
    }];
  });
};

const normalizeProtocolo = (raw: unknown): ProtocoloEntrega => {
  const item = asRecord(raw);
  if (!item || !asString(item.id) || !asString(item.empresaId) || !asString(item.entregaId)) {
    throw new ProtocolosError('unexpected', 'O serviço de acompanhamento retornou dados inválidos.');
  }

  return {
    id: asString(item.id),
    empresaId: asString(item.empresaId),
    empresaNome: asString(item.empresaNome),
    empresaCnpj: asString(item.empresaCnpj),
    empresaStatus: item.empresaStatus === 'Inativa' ? 'Inativa' : 'Ativa',
    empresaTipo: asString(item.empresaTipo) as Company['tipo'],
    empresaTipoEstabelecimento: item.empresaTipoEstabelecimento === 'Filial' ? 'Filial' : 'Matriz',
    empresaEmail: asString(item.empresaEmail),
    empresaTelefone: asString(item.empresaTelefone),
    empresaLogo: asOptionalString(item.empresaLogo),
    competencia: asString(item.competencia),
    periodoReferencia: asString(item.periodoReferencia) as ProtocoloPeriodoReferencia,
    entregaId: asString(item.entregaId),
    entregaNome: asString(item.entregaNome),
    categoria: asString(item.categoria) as EntregaModelo['categoria'],
    orgao: asOptionalString(item.orgao),
    origemPadrao: asString(item.origemPadrao) as ProtocoloOrigem,
    prazo: asString(item.prazo),
    status: item.status === 'Concluído' ? 'Concluído' : 'Pendente',
    atualizadoEm: asString(item.atualizadoEm),
    responsavel: asString(item.responsavel),
    anotacoesList: normalizeAnotacoes(item.anotacoesList),
    recebidoEm: asOptionalString(item.recebidoEm),
    concluidoPor: asOptionalString(item.concluidoPor),
    evidencia: asOptionalString(item.evidencia),
    concluidoEm: asOptionalString(item.concluidoEm),
    auditoriaPendente: item.auditoriaPendente === true,
    podeAlterarStatus: item.podeAlterarStatus === true,
    podeAnotar: item.podeAnotar === true,
  };
};

const normalizeConfig = (raw: unknown): ProtocoloEmpresaConfig | null => {
  const item = asRecord(raw);
  const entregaId = asString(item?.entregaId).trim();
  if (!item || !entregaId) return null;

  const periodicidade = PERIODICIDADES.has(item.periodicidade as ProtocoloPeriodicidade)
    ? item.periodicidade as ProtocoloPeriodicidade
    : undefined;

  return {
    entregaId,
    ativo: item.ativo === true,
    periodicidade,
    dataInicial: asOptionalString(item.dataInicial),
    proximaExecucao: asOptionalString(item.proximaExecucao),
    diaMes: asOptionalInteger(item.diaMes),
    diaSemana: asOptionalInteger(item.diaSemana),
    intervaloDias: asOptionalInteger(item.intervaloDias),
    incluirFinaisDeSemana: item.incluirFinaisDeSemana === true,
  };
};

const normalizeConfigs = (value: unknown): ProtocoloEmpresaConfig[] => {
  if (!Array.isArray(value)) {
    throw new ProtocolosError('unexpected', 'O serviço de acompanhamento retornou uma configuração inválida.');
  }
  return value.map(normalizeConfig).filter((item): item is ProtocoloEmpresaConfig => item !== null);
};

const normalizeCatalogItem = (raw: unknown): ProtocoloTipoConfig | null => {
  const item = asRecord(raw);
  const id = asString(item?.id).trim();
  const nome = asString(item?.nome).trim();
  if (!item || !id || !nome) return null;

  const regimes = Array.isArray(item.regimes)
    ? item.regimes.filter((regime): regime is Company['tipo'] => REGIMES.has(regime as Company['tipo']))
    : [];
  const periodicidadePadrao = PERIODICIDADES_CATALOGO.has(item.periodicidadePadrao as TipoFechamentoEntrega)
    ? item.periodicidadePadrao as TipoFechamentoEntrega
    : 'mensal';
  const origemPadrao = item.origemPadrao === 'Cliente envia'
    || item.origemPadrao === 'Escritório envia'
    || item.origemPadrao === 'Ambos'
    ? item.origemPadrao
    : 'Ambos';

  return {
    id,
    nome,
    categoria: asString(item.categoria) as EntregaModelo['categoria'],
    orgao: asOptionalString(item.orgao),
    diaLimite: typeof item.diaLimite === 'number' ? item.diaLimite : 1,
    descricao: asString(item.descricao),
    status: item.status === 'Inativo' ? 'Inativo' : 'Ativo',
    regimes,
    periodicidadePadrao,
    origemPadrao,
  };
};

const normalizeCatalog = (value: unknown): ProtocoloTipoConfig[] => {
  if (!Array.isArray(value)) {
    throw new ProtocolosError('unexpected', 'O serviço de acompanhamento retornou um catálogo inválido.');
  }
  return value.map(normalizeCatalogItem).filter((item): item is ProtocoloTipoConfig => item !== null);
};

const loadProtocolos = async (): Promise<ProtocoloEntrega[]> => {
  const { data, error } = await supabase.rpc(READ_PROTOCOLS_RPC);
  if (error) throw mapProtocolosError(error, 'Não foi possível carregar o acompanhamento.');
  if (data === null) return [];
  if (!Array.isArray(data)) {
    throw new ProtocolosError('unexpected', 'O serviço de acompanhamento retornou dados inválidos.');
  }
  return data.map(normalizeProtocolo);
};

const normalizeConfigEnvelope = (data: unknown): ConfiguracaoProtocolosEmpresa => {
  const envelope = asRecord(data);
  if (!envelope) {
    throw new ProtocolosError('unexpected', 'O serviço de acompanhamento retornou uma configuração inválida.');
  }
  return {
    catalogo: normalizeCatalog(envelope.catalogo),
    configs: normalizeConfigs(envelope.configs),
    updatedAt: asOptionalString(envelope.updatedAt) ?? null,
  };
};

const loadConfigEnvelope = async (clienteId: string): Promise<ConfiguracaoProtocolosEmpresa> => {
  const { data, error } = await supabase.rpc(READ_CONFIG_RPC, { p_cliente_id: clienteId });
  if (error) throw mapProtocolosError(error, 'Não foi possível carregar as entregas da empresa.');
  return normalizeConfigEnvelope(data);
};

const loadConfig = async (clienteId: string) => (
  (await loadConfigEnvelope(clienteId)).configs
);

const saveConfig = async (
  clienteId: string,
  configs: ProtocoloEmpresaConfig[],
  expectedUpdatedAt: string | null,
): Promise<ConfiguracaoProtocolosEmpresa> => {
  const writableConfigs = configs.map((config) => {
    const writable = { ...config };
    delete writable.proximaExecucao;
    return writable;
  });
  const { data, error } = await supabase.rpc(SAVE_CONFIG_RPC, {
    p_cliente_id: clienteId,
    p_configs: writableConfigs,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw mapProtocolosError(error, 'Não foi possível salvar as entregas da empresa.');
  return normalizeConfigEnvelope(data);
};

const findNewAnnotation = (current: Anotacao[], requested: Anotacao[] | undefined) => {
  if (!requested?.length) return '';
  const currentIds = new Set(current.map((item) => item.id).filter(Boolean));
  for (let index = requested.length - 1; index >= 0; index -= 1) {
    const candidate = requested[index];
    if (candidate?.texto?.trim() && (!candidate.id || !currentIds.has(candidate.id))) {
      return candidate.texto.trim();
    }
  }
  return '';
};

const requireTransitionEvidence = (status: ProtocoloStatus | undefined, annotation: string) => {
  if (status && annotation.trim().length < 8) throw evidenceRequiredError();
};

const saveProtocol = async (target: ProtocoloEntrega, updates: ProtocoloUpdate) => {
  const annotation = updates.anotacao?.trim()
    || findNewAnnotation(target.anotacoesList, updates.anotacoesList);
  requireTransitionEvidence(updates.status, annotation);

  if (updates.status && !target.podeAlterarStatus) {
    throw new ProtocolosError(
      'forbidden',
      'Seu perfil não pode concluir ou reabrir este item de acompanhamento.',
    );
  }
  if (!updates.status && annotation && !target.podeAnotar) {
    throw new ProtocolosError(
      'forbidden',
      'Seu perfil não pode adicionar anotações neste item de acompanhamento.',
    );
  }
  if (!updates.status && !annotation) {
    throw new ProtocolosError('invalid_data', 'Informe uma anotação válida para atualizar o acompanhamento.');
  }

  const payload: JsonRecord = {
    id: target.id,
    cliente_id: target.empresaId,
    entrega_id: target.entregaId,
    competencia: target.competencia,
    periodo_referencia: target.periodoReferencia,
  };
  if (updates.status) payload.status = updates.status;
  if (annotation) payload.anotacao = annotation;

  const { error } = await supabase.rpc(SAVE_PROTOCOL_RPC, { p_payload: payload });
  if (error) throw mapProtocolosError(error, 'Não foi possível atualizar o acompanhamento.');
};

export const protocolosService = {
  getCatalogoEntregas: () => protocolosCatalogoService.getCatalogoAtivo(),

  getCatalogoPorRegime(company: Company): ProtocoloTipoConfig[] {
    return protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  },

  async getEntregasEmpresa(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return loadConfig(company.id);
  },

  async getEntregasEmpresaConfig(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return loadConfig(company.id);
  },

  async getConfiguracaoEmpresa(company: Company): Promise<ConfiguracaoProtocolosEmpresa> {
    return loadConfigEnvelope(company.id);
  },

  async saveEntregasEmpresa(companyOrId: Company | string, entregaIds: string[]) {
    const clienteId = typeof companyOrId === 'string' ? companyOrId : companyOrId.id;
    const enabledIds = new Set(entregaIds);
    const current = await loadConfigEnvelope(clienteId);
    const saved = await saveConfig(clienteId, current.configs.map((item) => ({
      ...item,
      ativo: enabledIds.has(item.entregaId),
    })), current.updatedAt);
    return saved.configs;
  },

  async saveEntregasEmpresaConfig(
    company: Company,
    configs: ProtocoloEmpresaConfig[],
    expectedUpdatedAt: string | null,
  ) {
    return saveConfig(company.id, configs, expectedUpdatedAt);
  },

  async getProtocolos(): Promise<ProtocoloEntrega[]> {
    return loadProtocolos();
  },

  async updateProtocolo(id: string, updates: ProtocoloUpdate) {
    const protocolos = await loadProtocolos();
    const target = protocolos.find((item) => item.id === id);
    if (!target) {
      throw new ProtocolosError(
        'not_found',
        'O item de acompanhamento não foi encontrado ou não está disponível para este usuário.',
      );
    }
    await saveProtocol(target, updates);
    return loadProtocolos();
  },
};
