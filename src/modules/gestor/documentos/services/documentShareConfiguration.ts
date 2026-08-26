import { supabase } from '../../../../lib/supabase';

export interface ShareConfiguration {
  tempoPadrao: string;
  tempoPadraoMinutos: number;
  limitarTipos: string[];
  exigirSenhaPadrao: boolean;
  prazosExigemSenha: string[];
}

export const SHARE_EXPIRATION_OPTIONS = [
  '10 minutos',
  '30 minutos',
  '1 hora',
  '3 horas',
  '6 horas',
  '12 horas',
  '24 horas',
  '3 dias',
] as const;

const SHARE_DURATION_MINUTES: Record<string, number> = {
  '10 minutos': 10,
  '30 minutos': 30,
  '1 hora': 60,
  '3 horas': 180,
  '6 horas': 360,
  '12 horas': 720,
  '24 horas': 1440,
  '3 dias': 4320,
};

const MIN_SHARE_DURATION_MINUTES = 10;
const MAX_SHARE_DURATION_MINUTES = 3 * 24 * 60;

const clampShareDuration = (minutes: number) => (
  Math.min(MAX_SHARE_DURATION_MINUTES, Math.max(MIN_SHARE_DURATION_MINUTES, Math.floor(minutes)))
);

const DEFAULT_SHARE_CONFIGURATION: ShareConfiguration = {
  tempoPadrao: '3 horas',
  tempoPadraoMinutos: 180,
  limitarTipos: ['dre', 'balanco', 'social'],
  exigirSenhaPadrao: true,
  prazosExigemSenha: ['12 horas', '24 horas', '3 dias'],
};

interface ShareConfiguracaoRow {
  tempo_padrao_minutos?: number | null;
  expirar_links_dias?: number | null;
  exigir_senha?: boolean | null;
  limitar_tipos?: string[] | null;
  prazos_exigem_senha?: string[] | null;
}

export const getShareExpirationMinutes = (value: string) => {
  const normalized = value.toLowerCase();
  const direct = SHARE_DURATION_MINUTES[normalized];
  if (typeof direct === 'number') return direct;
  const [rawAmount, unit = ''] = normalized.split(' ');
  const amount = Number(rawAmount) || 1;

  if (unit.startsWith('minuto')) return clampShareDuration(amount);
  if (unit.startsWith('hora')) return clampShareDuration(amount * 60);
  if (unit.startsWith('dia')) return clampShareDuration(amount * 24 * 60);
  return DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos;
};

export const isSharePasswordRequired = (
  config: Pick<ShareConfiguration, 'exigirSenhaPadrao' | 'prazosExigemSenha'>,
  duration: string,
  requested = false,
) => requested
  || config.exigirSenhaPadrao
  || config.prazosExigemSenha.some((item) => item.toLowerCase() === duration.toLowerCase());

const getTempoPadraoLabelFromMinutes = (minutes: number) => {
  const exact = Object.entries(SHARE_DURATION_MINUTES).find(([, value]) => value === minutes);
  if (exact) return exact[0];
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  return `${minutes} minutos`;
};

const normalizeShareConfig = (input?: ShareConfiguration): ShareConfiguration => {
  if (!input) return DEFAULT_SHARE_CONFIGURATION;
  const requestedMinutes = Number.isFinite(input.tempoPadraoMinutos)
    ? clampShareDuration(input.tempoPadraoMinutos)
    : DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos;
  const tempo = getTempoPadraoLabelFromMinutes(requestedMinutes);
  const isAllowedDuration = (SHARE_EXPIRATION_OPTIONS as readonly string[]).includes(tempo);
  const tempoPadraoMinutos = isAllowedDuration
    ? requestedMinutes
    : DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos;
  return {
    tempoPadrao: isAllowedDuration ? tempo : DEFAULT_SHARE_CONFIGURATION.tempoPadrao,
    tempoPadraoMinutos,
    limitarTipos: Array.isArray(input.limitarTipos)
      ? input.limitarTipos
      : DEFAULT_SHARE_CONFIGURATION.limitarTipos,
    exigirSenhaPadrao: input.exigirSenhaPadrao ?? DEFAULT_SHARE_CONFIGURATION.exigirSenhaPadrao,
    prazosExigemSenha: Array.isArray(input.prazosExigemSenha)
      ? input.prazosExigemSenha
      : DEFAULT_SHARE_CONFIGURATION.prazosExigemSenha,
  };
};

const isMissingColumnError = (error: { message?: string; code?: string } | null | undefined) => (
  !!error && (
    error.code === '42703'
    || error.code === '42704'
    || (error.message || '').toLowerCase().includes('does not exist')
    || (error.message || '').toLowerCase().includes('column')
  )
);

const isMissingTableError = (error: { message?: string; code?: string } | null | undefined) => !!error && (
  error.code === '42P01'
  || (error.message || '').toLowerCase().includes('relation "public.configuracoes_compartilhamento" does not exist')
);

const getCurrentEmpresaId = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) {
    throw new Error('Não foi possível identificar a empresa ativa para salvar a configuração.');
  }
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);
  throw new Error('A empresa ativa retornou um identificador inválido.');
};

export const getConfiguracaoCompartilhamento = async (): Promise<ShareConfiguration> => {
  try {
    const { data, error } = await supabase
      .from('configuracoes_compartilhamento')
      .select('tempo_padrao_minutos,exigir_senha,limitar_tipos,prazos_exigem_senha')
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('configuracoes_compartilhamento')
        .select('expirar_links_dias,exigir_senha')
        .maybeSingle();

      if (legacyError) {
        throw new Error(
          `Não foi possível carregar a configuração de compartilhamento: ${legacyError.message}`,
        );
      }

      const legacyMinutes = Math.max(1, (legacyData?.expirar_links_dias || 1) * 24 * 60);
      return normalizeShareConfig({
        tempoPadrao: getTempoPadraoLabelFromMinutes(legacyMinutes),
        tempoPadraoMinutos: legacyMinutes,
        limitarTipos: DEFAULT_SHARE_CONFIGURATION.limitarTipos,
        exigirSenhaPadrao: legacyData?.exigir_senha ?? DEFAULT_SHARE_CONFIGURATION.exigirSenhaPadrao,
        prazosExigemSenha: DEFAULT_SHARE_CONFIGURATION.prazosExigemSenha,
      });
    }

    if (error) {
      throw new Error(`Não foi possível carregar a configuração de compartilhamento: ${error.message}`);
    }

    const row = data as ShareConfiguracaoRow | null;
    const tempoPadraoMinutos = Number(row?.tempo_padrao_minutos) > 0
      ? Number(row?.tempo_padrao_minutos)
      : DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos;

    return normalizeShareConfig({
      tempoPadrao: getTempoPadraoLabelFromMinutes(tempoPadraoMinutos),
      tempoPadraoMinutos,
      limitarTipos: row?.limitar_tipos || DEFAULT_SHARE_CONFIGURATION.limitarTipos,
      exigirSenhaPadrao: row?.exigir_senha ?? DEFAULT_SHARE_CONFIGURATION.exigirSenhaPadrao,
      prazosExigemSenha: row?.prazos_exigem_senha || DEFAULT_SHARE_CONFIGURATION.prazosExigemSenha,
    });
  } catch (error) {
    console.error('[documentShareConfiguration.get] Erro inesperado:', error);
    if (error instanceof Error) throw error;
    throw new Error('Não foi possível carregar a configuração de compartilhamento.');
  }
};

export const saveConfiguracaoCompartilhamento = async (
  input: ShareConfiguration,
): Promise<ShareConfiguration> => {
  const empresaId = await getCurrentEmpresaId();
  const normalizedInput = normalizeShareConfig(input);
  const commonPayload = {
    expirar_links_dias: Math.max(1, Math.ceil(normalizedInput.tempoPadraoMinutos / (24 * 60))),
    exigir_senha: normalizedInput.exigirSenhaPadrao,
  };
  const attempts = [
    {
      payload: {
        ...commonPayload,
        tempo_padrao_minutos: normalizedInput.tempoPadraoMinutos,
        limitar_tipos: normalizedInput.limitarTipos,
        prazos_exigem_senha: normalizedInput.prazosExigemSenha,
        empresa_id: empresaId,
      },
      allowRetry: true,
    },
    {
      payload: { ...commonPayload, empresa_id: empresaId },
      allowRetry: false,
    },
  ];

  for (const attempt of attempts) {
    const { error } = await supabase
      .from('configuracoes_compartilhamento')
      .upsert(attempt.payload, { onConflict: 'empresa_id' });
    if (!error) return normalizedInput;
    if (!attempt.allowRetry || !isMissingColumnError(error)) {
      const detail = isMissingTableError(error) ? 'estrutura não disponível' : error.message;
      throw new Error(`Não foi possível salvar a configuração de compartilhamento: ${detail || 'erro desconhecido'}.`);
    }
  }

  throw new Error('Não foi possível salvar a configuração de compartilhamento.');
};
