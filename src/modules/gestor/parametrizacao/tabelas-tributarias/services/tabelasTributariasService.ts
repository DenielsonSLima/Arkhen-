import { supabase } from '../../../../../lib/supabase';

export interface FaixaTributaria {
  ordem: number;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  aliquota: number;
  deducao: number;
  configuracao?: Record<string, unknown>;
}

export interface ParametroTributario {
  codigo: string;
  categoria: string;
  nome: string;
  competencia: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  versao: number;
  fonteUrl: string | null;
  norma: string | null;
  bloqueado: boolean;
  origem: 'oficial' | 'escritorio';
  configuracao: Record<string, unknown>;
  faixas: FaixaTributaria[];
}

export const tabelasTributariasService = {
  async listar(tipo?: string, competencia?: string): Promise<ParametroTributario[]> {
    const { data, error } = await supabase.rpc('listar_parametros_tributarios_por_competencia', {
      p_tipo: tipo || null,
      p_competencia: competencia ? `${competencia}-01` : new Date().toISOString().slice(0, 10),
    });
    if (error) throw new Error(`Erro ao consultar parâmetros tributários: ${error.message}`);
    return ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      codigo: String(item.codigo ?? ''),
      categoria: String(item.tipo ?? ''),
      nome: String(item.nome ?? ''),
      competencia: competencia || null,
      vigenciaInicio: String(item.vigenciaInicio ?? ''),
      vigenciaFim: item.vigenciaFim ? String(item.vigenciaFim) : null,
      versao: Number(item.versao ?? 0),
      fonteUrl: item.fonte ? String(item.fonte) : null,
      norma: item.norma ? String(item.norma) : null,
      bloqueado: Boolean(item.bloqueado),
      origem: item.oficial ? 'oficial' : 'escritorio',
      configuracao: (item.configuracao ?? {}) as Record<string, unknown>,
      faixas: ((item.faixas ?? []) as Array<Record<string, unknown>>).map((faixa) => ({
        ordem: Number(faixa.ordem ?? 0),
        limiteInferior: faixa.limiteInferior == null ? null : Number(faixa.limiteInferior),
        limiteSuperior: faixa.limiteSuperior == null ? null : Number(faixa.limiteSuperior),
        aliquota: Number(faixa.aliquota ?? 0),
        deducao: Number(faixa.parcelaDeduzir ?? 0),
        configuracao: (faixa.configuracao ?? {}) as Record<string, unknown>,
      })),
    }));
  },
};
