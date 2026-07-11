import { supabase } from '../../../../../lib/supabase';
import type { Company } from '../../../gestao-empresarial/services/gestaoEmpresarialService';
import { ENTREGA_CATALOGO } from '../../../protocolos/protocolosCatalogo';
import { getCurrentEmpresaId } from '../../services/parametrizacaoSupabase';

export type RegimeEmpresa = Company['tipo'];
export type TipoFechamentoEntrega = 'mensal' | 'quinzenal' | 'trimestral' | 'semestral';

export interface PrazoEntregaConfig {
  id: string;
  regime: RegimeEmpresa;
  entregaId: string;
  entregaNome: string;
  categoria: string;
  diaVencimento: number;
  referenciaMesAnterior: boolean;
  fechamento: TipoFechamentoEntrega;
  diaVencimentoPrimeiraQuinzena: number;
  diaVencimentoSegundaQuinzena: number;
  ativo: boolean;
}

interface PrazoEntregaRow {
  id: string;
  regime: RegimeEmpresa;
  entrega_id: string;
  entrega_nome: string;
  categoria: string;
  dia_vencimento: number;
  referencia_mes_anterior: boolean | null;
  fechamento: TipoFechamentoEntrega;
  dia_vencimento_primeira_quinzena: number | null;
  dia_vencimento_segunda_quinzena: number | null;
  ativo: boolean | null;
}

const TABLE = 'parametrizacao_prazos_entrega';
const REGIMES: RegimeEmpresa[] = ['PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'];

const getDefaultEntregasByRegime = (regime: RegimeEmpresa) => {
  const base = ['xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'guias-pagas', 'decred-semestral'];
  if (regime === 'PF') return ['notas-fiscais', 'extrato-bancario', 'guias-pagas'];
  if (regime === 'MEI') return ['pgdas', ...base.filter((id) => id !== 'folha-pagamento' && id !== 'decred-semestral')];
  if (regime === 'Simples Nacional') return ['pgdas', 'dctfweb', 'esocial', 'reinf', ...base.filter((id) => id !== 'decred-semestral')];
  if (regime === 'Isenta') return ['dctfweb', 'reinf', 'esocial', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'guias-pagas'];
  return ['irpj-csll-trimestral', 'sped-fiscal', 'sped-contribuicoes', 'dctfweb', 'esocial', 'reinf', 'xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario', 'folha-pagamento', 'decred-semestral', 'guias-pagas'];
};

const clampDay = (value: number) => Math.min(Math.max(Math.round(value || 1), 1), 31);

const makeDefaultConfig = (): PrazoEntregaConfig[] => REGIMES.flatMap((regime) => (
  ENTREGA_CATALOGO.filter((entrega) => getDefaultEntregasByRegime(regime).includes(entrega.id)).map((entrega) => ({
    id: `${regime}-${entrega.id}`,
    regime,
    entregaId: entrega.id,
    entregaNome: entrega.nome,
    categoria: entrega.categoria,
    diaVencimento: entrega.diaLimite,
    referenciaMesAnterior: true,
    fechamento: entrega.id === 'irpj-csll-trimestral'
      ? 'trimestral'
      : entrega.id === 'decred-semestral'
      ? 'semestral'
      : ['xml-nfe', 'xml-nfce', 'notas-fiscais', 'extrato-bancario'].includes(entrega.id) ? 'quinzenal' : 'mensal',
    diaVencimentoPrimeiraQuinzena: 20,
    diaVencimentoSegundaQuinzena: entrega.diaLimite,
    ativo: true,
  }))
));

const normalizeConfig = (items: PrazoEntregaConfig[]) => {
  const defaults = makeDefaultConfig();
  const byKey = new Map(items.map((item) => [`${item.regime}-${item.entregaId}`, item]));
  const defaultKeys = new Set(defaults.map((item) => `${item.regime}-${item.entregaId}`));
  const mergedDefaults = defaults.map((item) => {
    const saved = byKey.get(`${item.regime}-${item.entregaId}`);
    if (!saved) return item;
    return {
      ...item,
      ...saved,
      entregaNome: item.entregaNome,
      categoria: item.categoria,
      diaVencimento: clampDay(saved.diaVencimento),
      diaVencimentoPrimeiraQuinzena: clampDay(saved.diaVencimentoPrimeiraQuinzena),
      diaVencimentoSegundaQuinzena: clampDay(saved.diaVencimentoSegundaQuinzena),
    };
  });

  const custom = items.filter((item) => !defaultKeys.has(`${item.regime}-${item.entregaId}`));
  return [...mergedDefaults, ...custom];
};

const fromRow = (row: PrazoEntregaRow): PrazoEntregaConfig => ({
  id: row.id,
  regime: row.regime,
  entregaId: row.entrega_id,
  entregaNome: row.entrega_nome,
  categoria: row.categoria,
  diaVencimento: clampDay(row.dia_vencimento),
  referenciaMesAnterior: row.referencia_mes_anterior !== false,
  fechamento: row.fechamento,
  diaVencimentoPrimeiraQuinzena: clampDay(row.dia_vencimento_primeira_quinzena || 20),
  diaVencimentoSegundaQuinzena: clampDay(row.dia_vencimento_segunda_quinzena || row.dia_vencimento),
  ativo: row.ativo !== false,
});

const toPayload = (empresaId: string, item: PrazoEntregaConfig) => ({
  empresa_id: empresaId,
  regime: item.regime,
  entrega_id: item.entregaId,
  entrega_nome: item.entregaNome,
  categoria: item.categoria,
  dia_vencimento: clampDay(item.diaVencimento),
  referencia_mes_anterior: item.referenciaMesAnterior,
  fechamento: item.fechamento,
  dia_vencimento_primeira_quinzena: clampDay(item.diaVencimentoPrimeiraQuinzena),
  dia_vencimento_segunda_quinzena: clampDay(item.diaVencimentoSegundaQuinzena),
  ativo: item.ativo,
});

const ensureDefaults = async () => {
  const empresaId = await getCurrentEmpresaId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('empresa_id', empresaId)
    .limit(1);

  if (error) throw error;
  if ((data || []).length > 0) return;

  const { error: insertError } = await supabase
    .from(TABLE)
    .upsert(makeDefaultConfig().map((item) => toPayload(empresaId, item)), {
      onConflict: 'empresa_id,regime,entrega_id',
    });

  if (insertError) throw insertError;
};

export const prazosEntregaKeys = {
  all: ['parametrizacao', 'prazos-entrega'] as const,
};

export const prazosEntregaService = {
  getRegimes(): RegimeEmpresa[] {
    return REGIMES;
  },

  getDefaultConfig(): PrazoEntregaConfig[] {
    return makeDefaultConfig();
  },

  getConfiguracoes(): PrazoEntregaConfig[] {
    return makeDefaultConfig();
  },

  saveConfiguracoes(config: PrazoEntregaConfig[]) {
    return normalizeConfig(config);
  },

  resetConfiguracoes() {
    return makeDefaultConfig();
  },

  getConfigFor(regime: RegimeEmpresa, entregaId: string) {
    return makeDefaultConfig().find((item) => item.regime === regime && item.entregaId === entregaId);
  },

  async listConfiguracoes(): Promise<PrazoEntregaConfig[]> {
    await ensureDefaults();

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,regime,entrega_id,entrega_nome,categoria,dia_vencimento,referencia_mes_anterior,fechamento,dia_vencimento_primeira_quinzena,dia_vencimento_segunda_quinzena,ativo')
      .order('regime', { ascending: true })
      .order('entrega_nome', { ascending: true });

    if (error) throw error;
    return normalizeConfig(((data || []) as PrazoEntregaRow[]).map(fromRow));
  },

  async persistConfiguracoes(config: PrazoEntregaConfig[]): Promise<PrazoEntregaConfig[]> {
    const empresaId = await getCurrentEmpresaId();
    const normalized = normalizeConfig(config);
    const { error } = await supabase.from(TABLE).upsert(
      normalized.map((item) => toPayload(empresaId, item)),
      { onConflict: 'empresa_id,regime,entrega_id' }
    );

    if (error) throw error;
    return this.listConfiguracoes();
  },

  async restoreDefaults(): Promise<PrazoEntregaConfig[]> {
    return this.persistConfiguracoes(makeDefaultConfig());
  },
};
