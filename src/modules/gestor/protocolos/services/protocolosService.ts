import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { prazosEntregaService } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import { protocolosCatalogoService, type ProtocoloTipoConfig, type ProtocoloOrigemPadrao } from './protocolosCatalogoService';
import { type TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import type { EntregaModelo } from '../protocolosCatalogo';

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
}

export type ProtocoloUpdate = Partial<Pick<
  ProtocoloEntrega,
  'status' | 'anotacoesList' | 'recebidoEm'
>>;

const CONFIG_KEY = 'contabil_protocolos_config_empresas';
const PROTOCOLOS_KEY = 'contabil_protocolos_entregas';
type CompanyProtocolConfigMap = Record<string, ProtocoloEmpresaConfig[]>;

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

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const notifyProtocolosChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('protocolos:changed'));
  }
};

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
  periodoReferencia: item.periodoReferencia ?? 'Mensal',
  recebidoEm: item.recebidoEm ?? '',
});

const withAuditDates = (
  item: ProtocoloEntrega,
  updates: ProtocoloUpdate,
  now: string
): ProtocoloEntrega => {
  const next = { ...item, ...updates, atualizadoEm: now };
  if (updates.status === 'Concluído' && item.status !== 'Concluído' && !next.recebidoEm) {
    next.recebidoEm = now;
  }
  if (updates.status === 'Pendente') {
    next.recebidoEm = '';
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

const pruneLocalProtocolStorage = (companies: Company[]) => {
  const activeCompanyIds = new Set(companies.map((company) => company.id));

  const savedConfig = readJson<CompanyProtocolConfigMap>(CONFIG_KEY, {});
  const prunedConfig = Object.fromEntries(
    Object.entries(savedConfig).filter(([companyId]) => activeCompanyIds.has(companyId))
  );
  localStorage.setItem(CONFIG_KEY, JSON.stringify(prunedConfig));

  const savedProtocolos = readJson<ProtocoloEntrega[]>(PROTOCOLOS_KEY, []);
  const prunedProtocolos = savedProtocolos.filter((item) => activeCompanyIds.has(item.empresaId));
  localStorage.setItem(PROTOCOLOS_KEY, JSON.stringify(prunedProtocolos));
  return prunedProtocolos;
};

export const protocolosService = {
  getCatalogoEntregas(): ProtocoloTipoConfig[] {
    return protocolosCatalogoService.getCatalogoAtivo();
  },

  getCatalogoPorRegime(company: Company): ProtocoloTipoConfig[] {
    return protocolosCatalogoService.getCatalogoPorRegime(company.tipo);
  },

  getEntregasEmpresa(company: Company): string[] {
    return this.getEntregasEmpresaConfig(company)
      .filter((config) => config.ativo)
      .map((config) => config.entregaId);
  },

  getEntregasEmpresaConfig(company: Company): ProtocoloEmpresaConfig[] {
    const config = readJson<CompanyProtocolConfigMap>(CONFIG_KEY, {});
    const saved = config[company.id] || [];
    const savedById = new Map(saved.map((item) => [item.entregaId, item]));
    const catalogo = this.getCatalogoPorRegime(company);
    const normalized = catalogo.map((item) => {
      const savedItem = savedById.get(item.id);
      return {
        entregaId: item.id,
        ativo: savedItem?.ativo ?? true,
        periodicidade: savedItem?.periodicidade ?? item.periodicidadePadrao,
      };
    });
    config[company.id] = normalized;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return normalized;
  },

  saveEntregasEmpresa(companyOrId: Company | string, entregaIds: string[]) {
    const companyId = typeof companyOrId === 'string' ? companyOrId : companyOrId.id;
    const config = readJson<CompanyProtocolConfigMap>(CONFIG_KEY, {});
    const existing = config[companyId] || [];
    if (existing.length === 0) {
      config[companyId] = entregaIds.map((entregaId) => ({ entregaId, ativo: true }));
    } else {
      config[companyId] = existing.map((item) => ({
        entregaId: item.entregaId,
        ativo: entregaIds.includes(item.entregaId),
        periodicidade: item.periodicidade,
      }));
      entregaIds.forEach((entregaId) => {
        if (!config[companyId].some((item) => item.entregaId === entregaId)) {
          config[companyId].push({ entregaId, ativo: true });
        }
      });
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    notifyProtocolosChanged();
  },

  saveEntregasEmpresaConfig(company: Company, configs: ProtocoloEmpresaConfig[]) {
    const existing = this.getEntregasEmpresaConfig(company);
    const existingById = new Map(existing.map((item) => [item.entregaId, item]));
    const config = readJson<CompanyProtocolConfigMap>(CONFIG_KEY, {});
    config[company.id] = configs.map((item) => {
      const existingItem = existingById.get(item.entregaId);
      return {
        entregaId: item.entregaId,
        ativo: item.ativo,
        periodicidade: item.periodicidade ?? existingItem?.periodicidade,
      };
    });
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    notifyProtocolosChanged();
    return config[company.id];
  },

  async getProtocolos(): Promise<ProtocoloEntrega[]> {
    const companies = await gestaoEmpresarialService.getCompanies();
    const existing = pruneLocalProtocolStorage(companies);
    const byId = new Map(existing.map((item) => [item.id, item]));
    const now = new Date();
    const activeIds = new Set<string>();

    companies.forEach((company) => {
      const competencias = getCompetenciasForCompany(company, now);
      const configs = this.getEntregasEmpresaConfig(company);
      const catalogo = this.getCatalogoPorRegime(company);
      const catalogoById = new Map(catalogo.map((item) => [item.id, item]));

      competencias.forEach((competencia) => {
        configs.filter((config) => config.ativo).forEach((config) => {
          const modelo = catalogoById.get(config.entregaId);
          if (!modelo) return;

          const prazoConfig = prazosEntregaService.getConfigFor(company.tipo, modelo.id);
          if (prazoConfig && !prazoConfig.ativo) return;

          const referenciaMesAnterior = prazoConfig?.referenciaMesAnterior ?? true;
          const fechamento = config.periodicidade ?? prazoConfig?.fechamento ?? modelo.periodicidadePadrao;

          if (shouldSkipPeriodo(fechamento, competencia)) return;
          const periodos = getPeriodosByFechamento(fechamento, modelo, prazoConfig);

          periodos.forEach((periodo) => {
            const id = `${company.id}-${competencia}-${modelo.id}-${periodo.key}`;
            activeIds.add(id);
            const existingItem = byId.get(id);
            const prazo = makePrazo(competencia, periodo.dia, referenciaMesAnterior);
            if (existingItem) {
            byId.set(id, enrichCompanyFields({
              ...existingItem,
              entregaNome: modelo.nome,
              categoria: modelo.categoria,
              orgao: modelo.orgao,
              origemPadrao: existingItem.origemPadrao || modelo.origemPadrao,
              prazo,
              periodoReferencia: periodo.label,
            }, company));
              return;
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

            byId.set(id, enrichCompanyFields({
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
            }, company));
          });
        });
      });
    });

    const allProtocolos = Array.from(byId.values()).sort((a, b) => b.competencia.localeCompare(a.competencia) || a.empresaNome.localeCompare(b.empresaNome));
    const protocolos = allProtocolos.filter((item) => activeIds.has(item.id));
    localStorage.setItem(PROTOCOLOS_KEY, JSON.stringify(allProtocolos));
    return protocolos;
  },

  async updateProtocolo(id: string, updates: ProtocoloUpdate) {
    const protocolos = await this.getProtocolos();
    const now = new Date().toISOString();
    const updated = protocolos.map((item) => (
      item.id === id ? withAuditDates(item, updates, now) : item
    ));
    localStorage.setItem(PROTOCOLOS_KEY, JSON.stringify(updated));
    notifyProtocolosChanged();
    return updated;
  },
};
