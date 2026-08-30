import { supabase } from '../../../../../lib/supabase';

export interface MarcaDaguaDados {
  habilitado: boolean;
  fileUrl: string | null;
  fileUrlPaisagem: string | null;
  fileUrlRetrato: string | null;
  posicao: 'topo-esquerda' | 'topo-direita' | 'centro' | 'rodape-direita'; // legacy fallback
  opacidade: number; // legacy fallback
  tamanho: number; // legacy fallback
  posicaoPaisagem: 'topo-esquerda' | 'topo-direita' | 'centro' | 'rodape-direita';
  posicaoRetrato: 'topo-esquerda' | 'topo-direita' | 'centro' | 'rodape-direita';
  opacidadePaisagem: number;
  opacidadeRetrato: number;
  tamanhoPaisagem: number;
  tamanhoRetrato: number;
}

export type OrientacaoMarcaDagua = 'paisagem' | 'retrato';

export interface MarcaDaguaParaRelatorio {
  habilitado: boolean;
  fileUrl: string | null;
  posicao: MarcaDaguaDados['posicao'];
  opacidade: number;
  tamanho: number;
}

interface MarcaDaguaRow {
  habilitado: boolean;
  file_url: string | null;
  file_url_paisagem: string | null;
  file_url_retrato: string | null;
  posicao: MarcaDaguaDados['posicao'];
  opacidade: number;
  tamanho: number;
  posicao_paisagem: MarcaDaguaDados['posicaoPaisagem'];
  posicao_retrato: MarcaDaguaDados['posicaoRetrato'];
  opacidade_paisagem: number;
  opacidade_retrato: number;
  tamanho_paisagem: number;
  tamanho_retrato: number;
}

const emptyMarcaDagua: MarcaDaguaDados = {
  habilitado: false,
  fileUrl: null,
  fileUrlPaisagem: null,
  fileUrlRetrato: null,
  posicao: 'centro',
  opacidade: 15,
  tamanho: 35,
  posicaoPaisagem: 'centro',
  posicaoRetrato: 'centro',
  opacidadePaisagem: 15,
  opacidadeRetrato: 15,
  tamanhoPaisagem: 35,
  tamanhoRetrato: 35,
};

const getOrientationValue = <T>(
  orientationValue: T | null | undefined,
  legacyValue: T | null | undefined,
  fallback: T,
) => orientationValue ?? legacyValue ?? fallback;

/**
 * Selects the persisted visual identity for a report orientation. This keeps
 * previews, print reports and generated PDFs from choosing different fallback
 * fields for the same configuration.
 */
export const resolveMarcaDaguaParaRelatorio = (
  dados: MarcaDaguaDados | null | undefined,
  orientacao: OrientacaoMarcaDagua,
): MarcaDaguaParaRelatorio => {
  if (!dados) {
    return {
      habilitado: false,
      fileUrl: null,
      posicao: 'centro',
      opacidade: 15,
      tamanho: 35,
    };
  }

  const portrait = orientacao === 'retrato';
  return {
    habilitado: dados.habilitado,
    fileUrl: portrait
      ? getOrientationValue(dados.fileUrlRetrato, dados.fileUrl, null)
      : getOrientationValue(dados.fileUrlPaisagem, dados.fileUrl, null),
    posicao: portrait
      ? getOrientationValue(dados.posicaoRetrato, dados.posicao, 'centro')
      : getOrientationValue(dados.posicaoPaisagem, dados.posicao, 'centro'),
    opacidade: portrait
      ? getOrientationValue(dados.opacidadeRetrato, dados.opacidade, 15)
      : getOrientationValue(dados.opacidadePaisagem, dados.opacidade, 15),
    tamanho: portrait
      ? getOrientationValue(dados.tamanhoRetrato, dados.tamanho, 35)
      : getOrientationValue(dados.tamanhoPaisagem, dados.tamanho, 35),
  };
};

const fromRow = (row: MarcaDaguaRow | null): MarcaDaguaDados => {
  if (!row) return emptyMarcaDagua;

  return {
    habilitado: row.habilitado,
    fileUrl: row.file_url,
    fileUrlPaisagem: row.file_url_paisagem,
    fileUrlRetrato: row.file_url_retrato,
    posicao: row.posicao,
    opacidade: row.opacidade,
    tamanho: row.tamanho ?? 35,
    posicaoPaisagem: row.posicao_paisagem ?? 'centro',
    posicaoRetrato: row.posicao_retrato ?? 'centro',
    opacidadePaisagem: row.opacidade_paisagem ?? row.opacidade ?? 15,
    opacidadeRetrato: row.opacidade_retrato ?? row.opacidade ?? 15,
    tamanhoPaisagem: row.tamanho_paisagem ?? row.tamanho ?? 35,
    tamanhoRetrato: row.tamanho_retrato ?? row.tamanho ?? 35,
  };
};

export const marcaDaguaService = {
  async getMarcaDaguaConfig(): Promise<MarcaDaguaDados> {
    const { data, error } = await supabase
      .from('configuracoes_marca_dagua')
      .select('habilitado,file_url,file_url_paisagem,file_url_retrato,posicao,opacidade,tamanho,posicao_paisagem,posicao_retrato,opacidade_paisagem,opacidade_retrato,tamanho_paisagem,tamanho_retrato')
      .maybeSingle<MarcaDaguaRow>();

    if (error) throw error;
    return fromRow(data);
  },
  async updateConfig(dados: MarcaDaguaDados): Promise<MarcaDaguaDados> {
    const { data, error } = await supabase.rpc('upsert_configuracoes_marca_dagua', {
      p_payload: {
        habilitado: dados.habilitado,
        file_url: dados.fileUrl,
        file_url_paisagem: dados.fileUrlPaisagem,
        file_url_retrato: dados.fileUrlRetrato,
        posicao_paisagem: dados.posicaoPaisagem,
        posicao_retrato: dados.posicaoRetrato,
        opacidade_paisagem: dados.opacidadePaisagem,
        opacidade_retrato: dados.opacidadeRetrato,
        tamanho_paisagem: dados.tamanhoPaisagem,
        tamanho_retrato: dados.tamanhoRetrato,
      },
    });

    if (error) throw error;
    return fromRow(data as MarcaDaguaRow);
  },
};
