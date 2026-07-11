import { supabase } from '../../../../../lib/supabase';
import type { RegimeTributario } from '../types';

type RegimeRow = {
  codigo: string;
  titulo: string;
  limite: string;
  descricao: string;
  vantagens: string[];
  restricoes: string[];
  cor: string;
  ordem: number;
};

const mapRegime = (row: RegimeRow): RegimeTributario => ({
  id: row.codigo,
  title: row.titulo,
  limit: row.limite,
  desc: row.descricao,
  positives: row.vantagens ?? [],
  negatives: row.restricoes ?? [],
  color: row.cor,
});

export const regimesService = {
  async getRegimes(): Promise<RegimeTributario[]> {
    const { data, error } = await supabase
      .from('parametrizacao_regimes_tributarios')
      .select('codigo,titulo,limite,descricao,vantagens,restricoes,cor,ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => mapRegime(row as RegimeRow));
  },

  async saveRegime(regime: RegimeTributario): Promise<RegimeTributario> {
    const payload = {
      titulo: regime.title.trim(),
      limite: regime.limit.trim(),
      descricao: regime.desc.trim(),
      vantagens: regime.positives,
      restricoes: regime.negatives,
      cor: regime.color,
      ativo: true,
    };

    const { data, error } = await supabase
      .from('parametrizacao_regimes_tributarios')
      .update(payload)
      .eq('codigo', regime.id)
      .select('codigo,titulo,limite,descricao,vantagens,restricoes,cor,ordem')
      .single();

    if (error) throw error;
    return mapRegime(data as RegimeRow);
  },
};
