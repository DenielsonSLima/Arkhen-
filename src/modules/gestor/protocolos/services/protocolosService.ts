import { gestaoEmpresarialService, type Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { prazosEntregaService, type TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
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
}

export type ProtocoloUpdate = Partial<Pick<
  ProtocoloEntrega,
  'status' | 'anotacoesList' | 'recebidoEm' | 'concluidoPor'
>>;

type ProtocoloStatusDbRow = {
  id: string;
  status: ProtocoloStatus;
  recebido_em: string | null;
  concluido_por: string | null;
  anotacoes_list: Anotacao[] | null;
  atualizado_em: string | null;
};

type ProtocoloConfigRow = {
  cliente_id: string;
  configs: unknown;
};

const PROTOCOLOS_CONFIG_TABLE = 'configuracoes_protocolos_empresas';
const PROTOCOLOS_TABLE = 'protocolos_entregas';

const ALLOWED_PERIODICIDADES = new Set<TipoFechamentoEntrega>(['mensal', 'quinzenal', 'trimestral', 'semestral']);

const isMissingProtocolosTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return err.code === '42P01'
    || err.code === 'PGRST205'
    || String(err.message || '').includes('does not exist')
    || String(err.message || '').includes('Could not find the table');
};

const isConfigMismatch = (value: ProtocoloEmpresaConfig[] | undefined, catalogo: ProtocoloTipoConfig[]) => {
  if (!Array.isArray(value)) return true;
  if (value.length !== catalogo.length) return true;
  const savedIds = new Set(value.map((item) => item.entregaId));
  return !catalogo.every((item) => savedIds.has(item.id));
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const getCompanyStartMonthKey = (company: Company) => {
  if (!company.createdAt) return '';
  const createdAt = new Date(company.createdAt);
  if (Number.isNaN(createdAt.getTime())) return '';
  return getMonthKey(createdAt);
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
      ativo: item.ativo === false ? false : true,
      periodicidade,
    });
  });

  const resolved = catalogo.map((item) => {
    const saved = map.get(item.id);
    return {
      entregaId: item.id,
      ativo: saved ? saved.ativo : true,
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
    const payload = {
      cliente_id: companyId,
      configs,
    };

    const { error } = await supabase
      .from(PROTOCOLOS_CONFIG_TABLE)
      .upsert(payload, { onConflict: 'empresa_id,cliente_id', defaultToNull: false });

    if (error) throw error;
  } catch (error) {
    console.error('[protocolosService] Erro ao persistir configuração de protocolos por empresa:', error);
    throw error;
  }
};

const loadPersistedProtocolos = async (): Promise<Map<string, ProtocoloStatusDbRow>> => {
  try {
    const { data, error } = await supabase
      .from(PROTOCOLOS_TABLE)
      .select('id,status,recebido_em,concluido_por,anotacoes_list,atualizado_em');

    if (error) {
      if (isMissingProtocolosTableError(error)) return new Map();
      throw error;
    }

    if (!Array.isArray(data)) return new Map();
    return new Map(data.map((item) => [item.id, item as unknown as ProtocoloStatusDbRow]));
  } catch (error) {
    if (isMissingProtocolosTableError(error)) return new Map();
    console.warn('[protocolosService] Falha ao carregar estados dos protocolos via Supabase. Carregando estado inicial padrão.', error);
    return new Map();
  }
};

const loadEntregasEmpresaConfig = async (companyId: string): Promise<ProtocoloEmpresaConfig[] | null> => {
  try {
    const { data, error } = await supabase
      .from(PROTOCOLOS_CONFIG_TABLE)
      .select('configs')
      .eq('cliente_id', companyId)
      .maybeSingle();

    if (error) {
      if (isMissingProtocolosTableError(error)) return null;
      throw error;
    }

    if (!data) return [];
    return (data as ProtocoloConfigRow).configs as ProtocoloEmpresaConfig[];
  } catch (error) {
    if (isMissingProtocolosTableError(error)) return null;
    console.warn('[protocolosService] Erro ao carregar configuração de protocolos por empresa. Usando padrão do catálogo.', error);
    return null;
  }
};

const getCurrentUserName = () => 'Administrador';

const makePrazo = (competencia: string, diaLimite: number, referenciaMesAnterior: boolean) => {
  const [year, month] = competencia.split('-').map(Number);
  const dueDate = new Date(year, month - 1 + (referenciaMesAnterior ? 1 : 0), 1);
  const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
  return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(Math.min(diaLimite, lastDay)).padStart(2, '0')}`;
};

const enrichCompanyFields = (item: ProtocoloEntrega, company: Company): ProtocoloEntrega => ({
  ...item,
  empresaNome: company.nome,
  empresaCnpj: company.cnpj,
  empresaStatus: company.status,
  empresaTipo: company.tipo,
  empresaTipoEstabelecimento: company.tipoEstabelecimento,
  empresaEmail: company.email,
  empresaTelefone: company.telefone,
  empresaLogo: company.logo,
  origemPadrao: item.origemPadrao || 'Ambos',
  periodoReferencia: item.periodoReferencia || 'Mensal',
  recebidoEm: item.recebidoEm ?? '',
  concluidoPor: item.concluidoPor ?? (item.status === 'Concluído' ? item.responsavel || 'Administrador' : ''),
});

const withAuditDates = (
  item: ProtocoloEntrega,
  updates: ProtocoloUpdate,
  now: string,
): ProtocoloEntrega => {
  const next = { ...item, ...updates, atualizadoEm: now };
  if (updates.status === 'Concluído' && item.status !== 'Concluído' && !next.recebidoEm) {
    next.recebidoEm = now;
    next.concluidoPor = updates.concluidoPor || getCurrentUserName();
  }
  if (updates.status === 'Pendente') {
    next.recebidoEm = '';
    next.concluidoPor = '';
  }
  return next;
};

const getPeriodosByFechamento = (
  fechamento: TipoFechamentoEntrega,
  modelo: ProtocoloTipoConfig,
  prazoConfig?: ReturnType<typeof prazosEntregaService.getConfigFor>,
) => {
  const dia = prazoConfig?.diaVencimento ?? modelo.diaLimite;
  if (fechamento === 'quinzenal') {
    return [
      { key: 'q1', label: '1ª quinzena' as const, dia: prazoConfig?.diaVencimentoPrimeiraQuinzena ?? 20 },
      { key: 'q2', label: '2ª quinzena' as const, dia: prazoConfig?.diaVencimentoSegundaQuinzena ?? dia },
    ];
  }

  if (fechamento === 'trimestral') {
    return [{ key: 'trimestral', label: 'Trimestral' as const, dia }];
  }

  if (fechamento === 'semestral') {
    return [{ key: 'semestral', label: 'Semestral' as const, dia }];
  }

  return [{ key: 'mensal', label: 'Mensal' as const, dia }];
};

const shouldSkipPeriodo = (fechamento: TipoFechamentoEntrega, competencia: string) => {
  const month = competencia.split('-')[1];
  if (fechamento === 'trimestral') return !['03', '06', '09', '12'].includes(month);
  if (fechamento === 'semestral') return !['06', '12'].includes(month);
  return false;
};

const getCompetenciasForCompany = (company: Company, now: Date) => {
  const allCompetencias = [-2, -1, 0].map((offset) => getMonthKey(addMonths(now, offset)));
  const startMonth = getCompanyStartMonthKey(company);
  if (!startMonth) return allCompetencias;
  return allCompetencias.filter((competencia) => competencia >= startMonth);
};

const mergePersistedState = (item: ProtocoloEntrega, persisted?: ProtocoloStatusDbRow | null): ProtocoloEntrega => {
  if (!persisted) return item;
  return {
    ...item,
    status: persisted.status || item.status,
    recebidoEm: persisted.recebido_em || '',
    concluidoPor: persisted.concluido_por || '',
    anotacoesList: Array.isArray(persisted.anotacoes_list) ? persisted.anotacoes_list : item.anotacoesList,
    atualizadoEm: persisted.atualizado_em || item.atualizadoEm,
  };
};

const persistirProtocolo = async (protocolo: ProtocoloEntrega) => {
  const payload = {
    id: protocolo.id,
    cliente_id: protocolo.empresaId,
    entrega_id: protocolo.entregaId,
    competencia: protocolo.competencia,
    periodo_referencia: protocolo.periodoReferencia,
    status: protocolo.status,
    recebido_em: protocolo.recebidoEm || null,
    concluido_por: protocolo.concluidoPor || null,
    anotacoes_list: protocolo.anotacoesList || [],
    atualizado_em: protocolo.atualizadoEm || new Date().toISOString(),
  };
  const { error } = await supabase
    .from(PROTOCOLOS_TABLE)
    .upsert(payload, { onConflict: 'id', defaultToNull: false });
  if (error) throw error;
};

const getEntregasEmpresaConfig = async (company: Company): Promise<ProtocoloEmpresaConfig[]> => {
  const catalogo = protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  const dbConfig = await loadEntregasEmpresaConfig(company.id);

  if (dbConfig === null) {
    return catalogo.map((item) => ({
      entregaId: item.id,
      ativo: true,
      periodicidade: item.periodicidadePadrao,
    }));
  }

  return mapConfigFromDb(company.id, catalogo, dbConfig);
};

const getCatalogoByRegimeMap = (company: Company) => {
  const catalogo = protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  return new Map(catalogo.map((item) => [item.id, item]));
};

export const protocolosService = {
  getCatalogoEntregas: () => protocolosCatalogoService.getCatalogoAtivo(),

  getCatalogoPorRegime(company: Company): ProtocoloTipoConfig[] {
    return protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  },

  async getEntregasEmpresa(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return getEntregasEmpresaConfig(company);
  },

  async getEntregasEmpresaConfig(company: Company): Promise<ProtocoloEmpresaConfig[]> {
    return getEntregasEmpresaConfig(company);
  },

  async saveEntregasEmpresa(companyOrId: Company | string, entregaIds: string[]) {
    const company = typeof companyOrId === 'string'
      ? await gestaoEmpresarialService.getCompanyById(companyOrId)
      : companyOrId;

    if (!company) return [];
    const catalogo = getCatalogoByRegimeMap(company);
  const existing = await getEntregasEmpresaConfig(company);
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
    const catalogo = getCatalogoByRegimeMap(company);
    const existing = await getEntregasEmpresaConfig(company);
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
        ativo: item ? Boolean(item.ativo) : true,
        periodicidade,
      });
    }

    await persistirConfigEmpresa(company.id, filtered);
    return filtered;
  },

  async getProtocolos(): Promise<ProtocoloEntrega[]> {
    const companies = await gestaoEmpresarialService.getCompanies();
    const persistedById = await loadPersistedProtocolos();
    const companyConfigs = new Map<string, ProtocoloEmpresaConfig[]>();
    const now = new Date();

    const configs = await Promise.all(
      companies.map(async (company) => [company.id, await getEntregasEmpresaConfig(company)] as const)
    );

    for (const [companyId, companyConfig] of configs) {
      companyConfigs.set(companyId, companyConfig);
    }

    const byId = new Map<string, ProtocoloEntrega>();
    const activeIds = new Set<string>();

    for (const company of companies) {
      const configsForCompany = companyConfigs.get(company.id) || [];
      const competencias = getCompetenciasForCompany(company, now);
      const catalogo = protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
      const catalogoById = new Map(catalogo.map((item) => [item.id, item]));

      for (const competencia of competencias) {
        for (const configItem of configsForCompany) {
          if (!configItem.ativo) continue;
          const modelo = catalogoById.get(configItem.entregaId);
          if (!modelo) continue;

          const prazoConfig = prazosEntregaService.getConfigFor(company.tipo, modelo.id);
          if (prazoConfig && !prazoConfig.ativo) continue;

          const referenciaMesAnterior = prazoConfig?.referenciaMesAnterior ?? true;
          const fechamento = configItem.periodicidade ?? prazoConfig?.fechamento ?? modelo.periodicidadePadrao;

          if (shouldSkipPeriodo(fechamento, competencia)) continue;

          const periodos = getPeriodosByFechamento(fechamento, modelo, prazoConfig);

          for (const periodo of periodos) {
            const id = `${company.id}-${competencia}-${modelo.id}-${periodo.key}`;
            activeIds.add(id);
            const prazo = makePrazo(competencia, periodo.dia, referenciaMesAnterior);

            const existing = byId.get(id);
            if (existing) {
              byId.set(
                id,
                enrichCompanyFields({
                  ...existing,
                  entregaNome: modelo.nome,
                  categoria: modelo.categoria,
                  orgao: modelo.orgao,
                  origemPadrao: existing.origemPadrao || modelo.origemPadrao,
                  prazo,
                  periodoReferencia: periodo.label,
                }, company)
              );
              continue;
            }

            let initialStatus: ProtocoloStatus = 'Pendente';
            let initialRecebidoEm = '';
            let initialAnotacoesList: Anotacao[] = [];

            const isOneMonthAgo = competencia === competencias[1];
            const isTwoMonthsAgo = competencia === competencias[0];

            if (isTwoMonthsAgo) {
              initialStatus = 'Concluído';
              initialRecebidoEm = new Date(now.getFullYear(), now.getMonth() - 2, 28).toISOString();
            } else if (isOneMonthAgo) {
              if (modelo.id === 'extrato-bancario') {
                initialStatus = 'Pendente';
                initialAnotacoesList = [{ id: '1', data: new Date(now.getFullYear(), now.getMonth() - 1, 12).toISOString(), texto: 'Falta extrato dos últimos 5 dias.' }];
              } else if (modelo.id === 'xml-nfe') {
                initialStatus = 'Concluído';
                initialRecebidoEm = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString();
              } else if (modelo.id === 'folha-pagamento') {
                initialStatus = 'Concluído';
                initialRecebidoEm = new Date(now.getFullYear(), now.getMonth() - 1, 8).toISOString();
              }
            }

            const base: ProtocoloEntrega = {
              id,
              empresaId: company.id,
              empresaNome: company.nome,
              empresaCnpj: company.cnpj,
              empresaStatus: company.status,
              empresaTipo: company.tipo,
              empresaTipoEstabelecimento: company.tipoEstabelecimento,
              empresaEmail: company.email,
              empresaTelefone: company.telefone,
              empresaLogo: company.logo,
              competencia,
              periodoReferencia: periodo.label,
              entregaId: modelo.id,
              entregaNome: modelo.nome,
              categoria: modelo.categoria,
              origemPadrao: modelo.origemPadrao,
              orgao: modelo.orgao,
              prazo,
              status: initialStatus,
              atualizadoEm: new Date().toISOString(),
              responsavel: 'Administrador',
              anotacoesList: initialAnotacoesList,
              recebidoEm: initialRecebidoEm,
              concluidoPor: initialStatus === 'Concluído' ? 'Administrador' : '',
            };

            byId.set(id, mergePersistedState(enrichCompanyFields(base, company), persistedById.get(id)));
          }
        }
      }
    }

    const allProtocolos = Array.from(byId.values())
      .sort((a, b) => b.competencia.localeCompare(a.competencia) || a.empresaNome.localeCompare(b.empresaNome));

    return allProtocolos.filter((item) => activeIds.has(item.id));
  },

  async updateProtocolo(id: string, updates: ProtocoloUpdate) {
    const protocolos = await this.getProtocolos();
    const now = new Date().toISOString();
    const updated = protocolos.map((item) => (
      item.id === id ? withAuditDates(item, updates, now) : item
    ));
    const target = updated.find((item) => item.id === id);
    if (target) {
      await persistirProtocolo(target);
    }
    return updated;
  },
};
