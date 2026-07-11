import { supabase } from '../../../../lib/supabase';
import { getCurrentEmpresaId } from '../../parametrizacao/services/parametrizacaoSupabase';
import { ENTREGA_CATALOGO, type EntregaModelo } from '../protocolosCatalogo';
import type { RegimeEmpresa, TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';

export type StatusProtocoloTipo = 'Ativo' | 'Inativo';
export type ProtocoloOrigemPadrao = 'Cliente envia' | 'Escritório envia' | 'Ambos';

export interface ProtocoloTipoConfig extends EntregaModelo {
  descricao: string;
  status: StatusProtocoloTipo;
  regimes: RegimeEmpresa[];
  periodicidadePadrao: TipoFechamentoEntrega;
  origemPadrao: ProtocoloOrigemPadrao;
}

interface ProtocoloTipoRow {
  codigo: string;
  nome: string;
  categoria: ProtocoloTipoConfig['categoria'];
  orgao: string | null;
  dia_limite: number;
  descricao: string | null;
  regimes: unknown;
  periodicidade_padrao: TipoFechamentoEntrega | null;
  origem_padrao: ProtocoloOrigemPadrao | null;
  ativo: boolean | null;
}

const TABLE = 'parametrizacao_protocolos_tipos';
const REGIMES: RegimeEmpresa[] = ['PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'];

const getDefaultEntregasByRegime = (regime: RegimeEmpresa) => {
  const base = ['xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'guias-pagas', 'decred-semestral'];
  if (regime === 'PF') return ['notas-fiscais', 'extrato-bancario', 'guias-pagas'];
  if (regime === 'MEI') return ['pgdas', ...base.filter((id) => id !== 'folha-pagamento' && id !== 'decred-semestral')];
  if (regime === 'Simples Nacional') return ['pgdas', 'dctfweb', 'esocial', 'reinf', ...base.filter((id) => id !== 'decred-semestral')];
  if (regime === 'Isenta') return ['dctfweb', 'reinf', 'esocial', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'guias-pagas'];
  return ['irpj-csll-trimestral', 'sped-fiscal', 'sped-contribuicoes', 'dctfweb', 'esocial', 'reinf', 'xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'decred-semestral', 'guias-pagas'];
};

const getDefaultRegimesForEntrega = (entregaId: string): RegimeEmpresa[] => (
  REGIMES.filter((regime) => getDefaultEntregasByRegime(regime).includes(entregaId))
);

const getDefaultPeriodicidade = (entregaId: string): TipoFechamentoEntrega => (
  entregaId === 'irpj-csll-trimestral'
    ? 'trimestral'
    : entregaId === 'decred-semestral'
      ? 'semestral'
      : ['xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario'].includes(entregaId)
        ? 'quinzenal'
        : 'mensal'
);

const getDefaultOrigemPadrao = (entregaId: string): ProtocoloOrigemPadrao => {
  if (['xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'guias-pagas'].includes(entregaId)) {
    return 'Cliente envia';
  }

  if (['irpj-csll-trimestral', 'sped-fiscal', 'sped-contribuicoes', 'decred-semestral'].includes(entregaId)) {
    return 'Escritório envia';
  }

  return 'Ambos';
};

const makeDefaultCatalog = (): ProtocoloTipoConfig[] => (
  ENTREGA_CATALOGO.map((item) => ({
    ...item,
    descricao: `Obrigação padrão do escritório para ${item.nome.toLowerCase()}.`,
    status: 'Ativo',
    regimes: getDefaultRegimesForEntrega(item.id),
    periodicidadePadrao: getDefaultPeriodicidade(item.id),
    origemPadrao: getDefaultOrigemPadrao(item.id),
  }))
);

const normalizeStatus = (status: unknown): StatusProtocoloTipo => (
  status === 'Inativo' ? 'Inativo' : 'Ativo'
);

const normalizePeriodicidade = (value: unknown, fallback: TipoFechamentoEntrega): TipoFechamentoEntrega => (
  value === 'quinzenal' || value === 'trimestral' || value === 'semestral' || value === 'mensal'
    ? value
    : fallback
);

const normalizeOrigemPadrao = (value: unknown, fallback: ProtocoloOrigemPadrao): ProtocoloOrigemPadrao => (
  value === 'Cliente envia' || value === 'Escritório envia' || value === 'Ambos'
    ? value
    : fallback
);

const normalizeRegimes = (regimes: unknown): RegimeEmpresa[] => {
  if (!Array.isArray(regimes)) return [];
  return regimes.filter((item): item is RegimeEmpresa => typeof item === 'string' && REGIMES.includes(item as RegimeEmpresa));
};

const normalizeConfig = (items: ProtocoloTipoConfig[]) => {
  const defaults = makeDefaultCatalog();
  const byId = new Map(items.map((item) => [item.id, item]));

  return defaults.map((item) => {
    const saved = byId.get(item.id);
    if (!saved) return item;
    const regimes = normalizeRegimes(saved.regimes);
    return {
      ...item,
      ...saved,
      descricao: saved.descricao.trim() || item.descricao,
      status: normalizeStatus(saved.status),
      regimes: regimes.length ? regimes : item.regimes,
      periodicidadePadrao: normalizePeriodicidade(saved.periodicidadePadrao, item.periodicidadePadrao),
      origemPadrao: normalizeOrigemPadrao(saved.origemPadrao, item.origemPadrao),
    };
  });
};

const fromRow = (row: ProtocoloTipoRow): ProtocoloTipoConfig => ({
  id: row.codigo,
  nome: row.nome,
  categoria: row.categoria,
  orgao: row.orgao || undefined,
  diaLimite: Math.min(Math.max(Math.round(Number(row.dia_limite || 1)), 1), 31),
  descricao: row.descricao || '',
  status: row.ativo === false ? 'Inativo' : 'Ativo',
  regimes: normalizeRegimes(row.regimes),
  periodicidadePadrao: normalizePeriodicidade(row.periodicidade_padrao, getDefaultPeriodicidade(row.codigo)),
  origemPadrao: normalizeOrigemPadrao(row.origem_padrao, getDefaultOrigemPadrao(row.codigo)),
});

const toPayload = (empresaId: string, item: ProtocoloTipoConfig) => ({
  empresa_id: empresaId,
  codigo: item.id,
  nome: item.nome.trim(),
  categoria: item.categoria,
  orgao: item.orgao || null,
  dia_limite: Math.min(Math.max(Math.round(Number(item.diaLimite || 1)), 1), 31),
  descricao: item.descricao.trim(),
  regimes: item.regimes,
  periodicidade_padrao: item.periodicidadePadrao,
  origem_padrao: item.origemPadrao,
  sistema: true,
  ativo: item.status === 'Ativo',
});

const ensureDefaults = async () => {
  const empresaId = await getCurrentEmpresaId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('codigo')
    .eq('empresa_id', empresaId)
    .limit(1);

  if (error) throw error;
  if ((data || []).length > 0) return;

  const { error: insertError } = await supabase.from(TABLE).upsert(
    makeDefaultCatalog().map((item) => toPayload(empresaId, item)),
    { onConflict: 'empresa_id,codigo' }
  );

  if (insertError) throw insertError;
};

export const protocolosCatalogoKeys = {
  all: ['parametrizacao', 'protocolos-tipos'] as const,
};

export const protocolosCatalogoService = {
  getRegimes(): RegimeEmpresa[] {
    return REGIMES;
  },

  getCatalogoAtivo(): ProtocoloTipoConfig[] {
    return makeDefaultCatalog().filter((item) => item.status === 'Ativo');
  },

  getCatalogoTodos(): ProtocoloTipoConfig[] {
    return makeDefaultCatalog();
  },

  getCatalogoPorRegime(regime: RegimeEmpresa): ProtocoloTipoConfig[] {
    return this.getCatalogoAtivo().filter((item) => item.regimes.includes(regime));
  },

  getById(id: string): ProtocoloTipoConfig | undefined {
    return this.getCatalogoTodos().find((item) => item.id === id);
  },

  salvarCatalogo(items: ProtocoloTipoConfig[]) {
    return normalizeConfig(items);
  },

  resetCatalogo() {
    return makeDefaultCatalog();
  },

  async listCatalogoTodos(): Promise<ProtocoloTipoConfig[]> {
    await ensureDefaults();

    const { data, error } = await supabase
      .from(TABLE)
      .select('codigo,nome,categoria,orgao,dia_limite,descricao,regimes,periodicidade_padrao,origem_padrao,ativo')
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });

    if (error) throw error;
    return normalizeConfig(((data || []) as ProtocoloTipoRow[]).map(fromRow));
  },

  async persistCatalogo(items: ProtocoloTipoConfig[]): Promise<ProtocoloTipoConfig[]> {
    const empresaId = await getCurrentEmpresaId();
    const normalized = normalizeConfig(items);
    const { error } = await supabase.from(TABLE).upsert(
      normalized.map((item) => toPayload(empresaId, item)),
      { onConflict: 'empresa_id,codigo' }
    );

    if (error) throw error;
    return this.listCatalogoTodos();
  },

  async restoreCatalogo(): Promise<ProtocoloTipoConfig[]> {
    return this.persistCatalogo(makeDefaultCatalog());
  },
};
