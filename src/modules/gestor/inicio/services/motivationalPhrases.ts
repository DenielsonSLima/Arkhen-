import { supabase } from '../../../../lib/supabase';
import { frasesMotivacionaisData } from './motivationalPhrasesData';

export type FraseMotivacional = {
  texto: string;
  autor: string;
  categoria?: string;
};

type MensagemInspiradoraRow = {
  texto?: string | null;
  autor?: string | null;
  categoria?: string | null;
};

export const frasesMotivacionais = frasesMotivacionaisData;

export async function getMensagemInspiradoraDoDia(dataReferencia?: string): Promise<FraseMotivacional | null> {
  const { data, error } = await supabase.rpc('get_mensagem_inspiradora_do_dia', {
    p_data: dataReferencia || null,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as MensagemInspiradoraRow | null;
  if (!row?.texto || !row.autor) return null;

  return {
    texto: row.texto,
    autor: row.autor,
    categoria: row.categoria || undefined,
  };
}
