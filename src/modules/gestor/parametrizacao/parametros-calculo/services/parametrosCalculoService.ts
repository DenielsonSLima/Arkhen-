import { supabase } from '../../../../../lib/supabase';

export interface TipoRescisaoParametro {
  id: string;
  label: string;
  descricao: string;
  geraAvisoPrevio: boolean;
  geraMultaFgts: boolean;
  ativo: boolean;
}

export interface ParametrosCalculo {
  version: number;
  tiposRescisao: TipoRescisaoParametro[];
  updatedAt: string | null;
}

const LEGACY_STORAGE_KEY = 'contabil_parametrizacao_parametros_calculo';
const CURRENT_VERSION = 5;
export const PARAMETROS_CALCULO_QUERY_KEY = ['parametrizacao', 'rescisao'] as const;

export const DEFAULT_PARAMETROS_CALCULO: ParametrosCalculo = {
  version: CURRENT_VERSION,
  updatedAt: null,
  tiposRescisao: [
    {
      id: 'sem_justa_causa',
      label: 'Sem Justa Causa',
      descricao: 'Com aviso prévio e multa de FGTS.',
      geraAvisoPrevio: true,
      geraMultaFgts: true,
      ativo: true,
    },
    {
      id: 'com_justa_causa',
      label: 'Com Justa Causa',
      descricao: 'Sem aviso prévio indenizado e sem multa de FGTS.',
      geraAvisoPrevio: false,
      geraMultaFgts: false,
      ativo: true,
    },
    {
      id: 'pedido_demissao',
      label: 'Pedido de Demissão',
      descricao: 'Pedido do funcionário, sem multa de FGTS.',
      geraAvisoPrevio: false,
      geraMultaFgts: false,
      ativo: true,
    },
  ],
};

const cleanupLegacyLocalRecord = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // A limpeza remota é canônica; storage local indisponível não bloqueia a tela.
  }
};

const normalizeParametros = (data: Partial<ParametrosCalculo>): ParametrosCalculo => {
  const defaultsById = new Map(
    DEFAULT_PARAMETROS_CALCULO.tiposRescisao.map((item) => [item.id, item]),
  );
  const tipos = Array.isArray(data.tiposRescisao) && data.tiposRescisao.length
    ? data.tiposRescisao
      .filter((item) => defaultsById.has(item.id))
      .map((item) => ({ ...defaultsById.get(item.id)!, ...item }))
    : DEFAULT_PARAMETROS_CALCULO.tiposRescisao;

  return {
    version: CURRENT_VERSION,
    tiposRescisao: tipos.length ? tipos : DEFAULT_PARAMETROS_CALCULO.tiposRescisao,
    updatedAt: typeof data.updatedAt === 'string' && data.updatedAt ? data.updatedAt : null,
  };
};

const toSafeError = (error: { code?: string; message?: string }, fallback: string) => {
  if (error.code === '40001') {
    return new Error('Esta configuração foi alterada em outra tela. Recarregue antes de salvar.');
  }
  if (error.code === '42501') {
    return new Error('Você não tem permissão para alterar os parâmetros de rescisão.');
  }
  return new Error(fallback);
};

export const parametrosCalculoService = {
  async getParametros(): Promise<ParametrosCalculo> {
    cleanupLegacyLocalRecord();
    const { data, error } = await supabase.rpc('obter_configuracao_rescisao');
    if (error) throw toSafeError(error, 'Não foi possível carregar os parâmetros de rescisão.');
    return normalizeParametros((data || {}) as Partial<ParametrosCalculo>);
  },

  async saveParametros(parametros: ParametrosCalculo): Promise<ParametrosCalculo> {
    cleanupLegacyLocalRecord();
    const normalized = normalizeParametros(parametros);
    const { updatedAt, ...configuracao } = normalized;
    const { data, error } = await supabase.rpc('salvar_configuracao_rescisao', {
      p_configuracao: configuracao,
      p_expected_updated_at: updatedAt,
    });
    if (error) throw toSafeError(error, 'Não foi possível salvar os parâmetros de rescisão.');
    return normalizeParametros((data || {}) as Partial<ParametrosCalculo>);
  },

  async resetParametros(expectedUpdatedAt: string | null): Promise<ParametrosCalculo> {
    return this.saveParametros({ ...DEFAULT_PARAMETROS_CALCULO, updatedAt: expectedUpdatedAt });
  },
};
