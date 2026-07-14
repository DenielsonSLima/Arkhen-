import { supabase } from '../../../../lib/supabase';
import { getCurrentEmpresaId } from './parametrizacaoSupabase';

export interface Cnae {
  id: string;
  codigo: string;
  descricao: string;
  simplesNacional: boolean;
  simplesAnexo: 'Anexo I' | 'Anexo II' | 'Anexo III' | 'Anexo IV' | 'Anexo V' | 'N/A';
  presuncaoIrpj: number;
  presuncaoCsll: number;
  ativo: boolean;
  meiPermitido: boolean;
  meiTipo: 'normal' | 'caminhoneiro' | 'nao_aplicavel';
  meiOcupacoes: string[];
  regimesPermitidos: Array<'mei' | 'simples_nacional' | 'lucro_presumido' | 'lucro_real'>;
  anexosSimples: Array<'Anexo I' | 'Anexo II' | 'Anexo III' | 'Anexo IV' | 'Anexo V'>;
  sujeitoFatorR: boolean;
  padraoSistema: boolean;
  observacoes: string;
  fonteCnaeUrl: string;
  fonteTributariaUrl: string;
  classificacaoRevisadaEm: string;
}

export interface RegraImposto {
  id: string;
  nome: string;
  regime: 'Lucro Presumido' | 'Lucro Real';
  cnaeCodigo: string;
  cstPis: string;
  aliquotaPis: number;
  cstCofins: string;
  aliquotaCofins: number;
}

export interface RegraCnab {
  id: string;
  nome: string;
  banco: string;
  tipoRegra: 'cobranca' | 'conciliacao';
  multa: number | null;
  juros: number | null;
  diasTolerancia: number | null;
  padraoTexto: string | null;
  contaContabil: string | null;
}

type CnaeRow = {
  id: string;
  codigo: string;
  descricao: string;
  simples_nacional: boolean;
  simples_anexo: Cnae['simplesAnexo'];
  presuncao_irpj: number | string;
  presuncao_csll: number | string;
  ativo: boolean;
  mei_permitido: boolean;
  mei_tipo: Cnae['meiTipo'];
  mei_ocupacoes: string[];
  regimes_permitidos: Cnae['regimesPermitidos'];
  anexos_simples: Cnae['anexosSimples'];
  sujeito_fator_r: boolean;
  padrao_sistema: boolean;
  observacoes: string;
  fonte_cnae_url: string;
  fonte_tributaria_url: string;
  classificacao_revisada_em: string;
};

type RegraImpostoRow = {
  id: string;
  nome: string;
  regime: RegraImposto['regime'];
  cnae_codigo: string;
  cst_pis: string;
  aliquota_pis: number | string;
  cst_cofins: string;
  aliquota_cofins: number | string;
};

type RegraCnabRow = {
  id: string;
  nome: string;
  banco: string;
  tipo_regra: RegraCnab['tipoRegra'];
  multa: number | string | null;
  juros: number | string | null;
  dias_tolerancia: number | null;
  padrao_texto: string | null;
  conta_contabil: string | null;
};

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

export const cnaeCatalogQueryKey = (includeInactive: boolean) => [
  'parametrizacao', 'cnaes', 'catalogo', includeInactive ? 'todos' : 'ativos',
] as const;

const mapCnae = (row: CnaeRow): Cnae => ({
  id: row.id,
  codigo: row.codigo,
  descricao: row.descricao,
  simplesNacional: row.simples_nacional,
  simplesAnexo: row.simples_anexo,
  presuncaoIrpj: toNumber(row.presuncao_irpj),
  presuncaoCsll: toNumber(row.presuncao_csll),
  ativo: row.ativo,
  meiPermitido: row.mei_permitido,
  meiTipo: row.mei_tipo,
  meiOcupacoes: row.mei_ocupacoes ?? [],
  regimesPermitidos: row.regimes_permitidos ?? [],
  anexosSimples: row.anexos_simples ?? [],
  sujeitoFatorR: row.sujeito_fator_r,
  padraoSistema: row.padrao_sistema,
  observacoes: row.observacoes ?? '',
  fonteCnaeUrl: row.fonte_cnae_url,
  fonteTributariaUrl: row.fonte_tributaria_url,
  classificacaoRevisadaEm: row.classificacao_revisada_em,
});

const mapRegraImposto = (row: RegraImpostoRow): RegraImposto => ({
  id: row.id,
  nome: row.nome,
  regime: row.regime,
  cnaeCodigo: row.cnae_codigo,
  cstPis: row.cst_pis,
  aliquotaPis: toNumber(row.aliquota_pis),
  cstCofins: row.cst_cofins,
  aliquotaCofins: toNumber(row.aliquota_cofins),
});

const mapRegraCnab = (row: RegraCnabRow): RegraCnab => ({
  id: row.id,
  nome: row.nome,
  banco: row.banco,
  tipoRegra: row.tipo_regra,
  multa: row.multa === null ? null : toNumber(row.multa),
  juros: row.juros === null ? null : toNumber(row.juros),
  diasTolerancia: row.dias_tolerancia,
  padraoTexto: row.padrao_texto,
  contaContabil: row.conta_contabil,
});

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const parametrizacaoService = {
  async getCnaes(options?: { includeInactive?: boolean }): Promise<Cnae[]> {
    let query = supabase
      .from('parametrizacao_cnaes')
      .select('id,codigo,descricao,simples_nacional,simples_anexo,presuncao_irpj,presuncao_csll,ativo,mei_permitido,mei_tipo,mei_ocupacoes,regimes_permitidos,anexos_simples,sujeito_fator_r,padrao_sistema,observacoes,fonte_cnae_url,fonte_tributaria_url,classificacao_revisada_em')
      .order('codigo', { ascending: true });

    if (!options?.includeInactive) query = query.eq('ativo', true);

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []).map((row) => mapCnae(row as CnaeRow));
  },

  async toggleCnaeAtivo(id: string, ativo: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('parametrizacao_cnaes')
      .update({ ativo })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async saveCnae(cnae: Cnae): Promise<Cnae> {
    const payload = {
      codigo: cnae.codigo.trim(),
      descricao: cnae.descricao.trim(),
      simples_nacional: cnae.simplesNacional,
      simples_anexo: cnae.simplesAnexo,
      presuncao_irpj: cnae.presuncaoIrpj,
      presuncao_csll: cnae.presuncaoCsll,
      ativo: true,
    };

    const query = cnae.id && isUuid(cnae.id)
      ? supabase.from('parametrizacao_cnaes').update(payload).eq('id', cnae.id).select().single()
      : supabase.from('parametrizacao_cnaes').insert({ ...payload, empresa_id: await getCurrentEmpresaId() }).select().single();

    const { data, error } = await query;
    if (error) throw error;
    return mapCnae(data as CnaeRow);
  },

  async deleteCnae(id: string): Promise<boolean> {
    const { error } = await supabase.from('parametrizacao_cnaes').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    return true;
  },

  async getRegrasImposto(): Promise<RegraImposto[]> {
    const { data, error } = await supabase
      .from('parametrizacao_regras_imposto')
      .select('id,nome,regime,cnae_codigo,cst_pis,aliquota_pis,cst_cofins,aliquota_cofins')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => mapRegraImposto(row as RegraImpostoRow));
  },

  async saveRegraImposto(regra: RegraImposto): Promise<RegraImposto> {
    const payload = {
      nome: regra.nome.trim(),
      regime: regra.regime,
      cnae_codigo: regra.cnaeCodigo,
      cst_pis: regra.cstPis,
      aliquota_pis: regra.aliquotaPis,
      cst_cofins: regra.cstCofins,
      aliquota_cofins: regra.aliquotaCofins,
      ativo: true,
    };

    const query = regra.id && isUuid(regra.id)
      ? supabase.from('parametrizacao_regras_imposto').update(payload).eq('id', regra.id).select().single()
      : supabase.from('parametrizacao_regras_imposto').insert({ ...payload, empresa_id: await getCurrentEmpresaId() }).select().single();

    const { data, error } = await query;
    if (error) throw error;
    return mapRegraImposto(data as RegraImpostoRow);
  },

  async deleteRegraImposto(id: string): Promise<boolean> {
    const { error } = await supabase.from('parametrizacao_regras_imposto').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    return true;
  },

  async getRegrasCnab(): Promise<RegraCnab[]> {
    const { data, error } = await supabase
      .from('parametrizacao_regras_cnab')
      .select('id,nome,banco,tipo_regra,multa,juros,dias_tolerancia,padrao_texto,conta_contabil')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => mapRegraCnab(row as RegraCnabRow));
  },

  async saveRegraCnab(regra: RegraCnab): Promise<RegraCnab> {
    const payload = {
      nome: regra.nome.trim(),
      banco: regra.banco.trim(),
      tipo_regra: regra.tipoRegra,
      multa: regra.multa,
      juros: regra.juros,
      dias_tolerancia: regra.diasTolerancia,
      padrao_texto: regra.padraoTexto,
      conta_contabil: regra.contaContabil,
      ativo: true,
    };

    const query = regra.id && isUuid(regra.id)
      ? supabase.from('parametrizacao_regras_cnab').update(payload).eq('id', regra.id).select().single()
      : supabase.from('parametrizacao_regras_cnab').insert({ ...payload, empresa_id: await getCurrentEmpresaId() }).select().single();

    const { data, error } = await query;
    if (error) throw error;
    return mapRegraCnab(data as RegraCnabRow);
  },

  async deleteRegraCnab(id: string): Promise<boolean> {
    const { error } = await supabase.from('parametrizacao_regras_cnab').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    return true;
  },
};
