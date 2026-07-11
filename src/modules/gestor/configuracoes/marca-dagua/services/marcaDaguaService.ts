import { supabase } from '../../../../../lib/supabase';

export interface MarcaDaguaDados {
  habilitado: boolean;
  posicao: 'topo-esquerda' | 'topo-direita' | 'centro' | 'rodape-direita';
  opacidade: number; // 0 to 100
  fileUrl: string | null;
  fileUrlPaisagem: string | null;
  fileUrlRetrato: string | null;
}

interface MarcaDaguaRow {
  habilitado: boolean;
  posicao: MarcaDaguaDados['posicao'];
  opacidade: number;
  file_url: string | null;
  file_url_paisagem: string | null;
  file_url_retrato: string | null;
}

const emptyMarcaDagua: MarcaDaguaDados = {
  habilitado: false,
  posicao: 'centro',
  opacidade: 15,
  fileUrl: null,
  fileUrlPaisagem: null,
  fileUrlRetrato: null,
};

const fromRow = (row: MarcaDaguaRow | null): MarcaDaguaDados => {
  if (!row) return emptyMarcaDagua;

  return {
    habilitado: row.habilitado,
    posicao: row.posicao,
    opacidade: row.opacidade,
    fileUrl: row.file_url,
    fileUrlPaisagem: row.file_url_paisagem,
    fileUrlRetrato: row.file_url_retrato,
  };
};

export const marcaDaguaService = {
  async getMarcaDaguaConfig(): Promise<MarcaDaguaDados> {
    const { data, error } = await supabase
      .from('configuracoes_marca_dagua')
      .select('habilitado,posicao,opacidade,file_url,file_url_paisagem,file_url_retrato')
      .maybeSingle<MarcaDaguaRow>();

    if (error) throw error;
    return fromRow(data);
  },
  async updateConfig(dados: MarcaDaguaDados): Promise<MarcaDaguaDados> {
    const { data, error } = await supabase.rpc('upsert_configuracoes_marca_dagua', {
      p_payload: {
        habilitado: dados.habilitado,
        posicao: dados.posicao,
        opacidade: dados.opacidade,
        file_url: dados.fileUrl,
        file_url_paisagem: dados.fileUrlPaisagem,
        file_url_retrato: dados.fileUrlRetrato,
      },
    });

    if (error) throw error;
    return fromRow(data as MarcaDaguaRow);
  },
};
