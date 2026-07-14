import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { supabase } from '../../../../lib/supabase';
import { hashSharePassword } from '../utils/shareCrypto';

export { hashSharePassword };

export interface SharedDocumentLink {
  id: string;
  documento: string;
  empresa: string;
  geradoPor: string;
  shareGroupId?: string;
  dataGeracao: string;
  dataGeracaoIso?: string;
  tempoLimite: string;
  dataExpiracao: string;
  dataExpiracaoIso?: string;
  senha?: string;
  senhaHash?: string;
  link: string;
  status: 'Ativo' | 'Expirado';
  documentId?: string;
}

export interface ShareableDocument extends CompanyDocument {
  empresaNome?: string;
}

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

const DEFAULT_SHARE_CONFIGURATION: ShareConfiguration = {
  tempoPadrao: '3 horas',
  tempoPadraoMinutos: 180,
  limitarTipos: ['dre', 'balanco', 'social'],
  exigirSenhaPadrao: true,
  prazosExigemSenha: ['12 horas', '24 horas', '3 dias'],
};

export const getShareExpirationMinutes = (value: string) => {
  const normalized = value.toLowerCase();
  const direct = SHARE_DURATION_MINUTES[normalized as keyof typeof SHARE_DURATION_MINUTES];
  if (typeof direct === 'number') return direct;
  const [rawAmount, unit = ''] = normalized.split(' ');
  const amount = Number(rawAmount) || 1;

  if (unit.startsWith('minuto')) return amount;
  if (unit.startsWith('hora')) return amount * 60;
  if (unit.startsWith('dia')) return amount * 24 * 60;
  return 180;
};

const getTempoPadraoLabelFromMinutes = (minutes: number) => {
  const exact = Object.entries(SHARE_DURATION_MINUTES).find(([, value]) => value === minutes);
  if (exact) return exact[0];

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 1) return '1 hora';
    return `${hours} horas`;
  }

  return `${minutes} minutos`;
};

const normalizeShareConfig = (input: ShareConfiguration | undefined): ShareConfiguration => {
  if (!input) return DEFAULT_SHARE_CONFIGURATION;

  const tempo = getTempoPadraoLabelFromMinutes(input.tempoPadraoMinutos);
  return {
    tempoPadrao: (SHARE_EXPIRATION_OPTIONS as readonly string[]).includes(tempo) ? tempo : DEFAULT_SHARE_CONFIGURATION.tempoPadrao,
    tempoPadraoMinutos: Number.isFinite(input.tempoPadraoMinutos) ? Math.max(1, Math.floor(input.tempoPadraoMinutos)) : DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos,
    limitarTipos: Array.isArray(input.limitarTipos) ? input.limitarTipos : DEFAULT_SHARE_CONFIGURATION.limitarTipos,
    exigirSenhaPadrao: Boolean(input.exigirSenhaPadrao),
    prazosExigemSenha: Array.isArray(input.prazosExigemSenha) ? input.prazosExigemSenha : DEFAULT_SHARE_CONFIGURATION.prazosExigemSenha,
  };
};

const DEMO_LINK_IDS = ['l1', 'l2', 'l3', 'l4'];
const SHARE_TABLE = 'documentos_compartilhamentos';
export const DEFAULT_SHARE_PASSWORD = 'ARKH-1876-SEC';

const SHARED_LINK_MIN_COLUMNS = 'id,documento_nome,empresa_nome,gerado_por,documento_id,tempo_limite,expires_at,status,created_at,senha_hash,senha_visualizacao';
const SHARED_LINK_COLUMNS_WITH_GROUP = `${SHARED_LINK_MIN_COLUMNS},share_group_id`;

interface SharedDocumentRow {
  id: string;
  documento_id: string | null;
  documento_nome: string;
  empresa_nome: string;
  gerado_por: string;
  share_group_id?: string | null;
  tempo_limite: string;
  expires_at: string;
  status: 'Ativo' | 'Expirado';
  created_at: string;
  senha_hash?: string | null;
  senha_visualizacao?: string | null;
}

interface ShareConfiguracaoRow {
  tempo_padrao_minutos?: number | null;
  expirar_links_dias?: number | null;
  exigir_senha?: boolean | null;
  limitar_tipos?: string[] | null;
  prazos_exigem_senha?: string[] | null;
}

const isMissingColumnError = (error: { message?: string; code?: string } | null | undefined) => (
  !!error && (
    error.code === '42703'
    || error.code === '42704'
    || (error.message || '').toLowerCase().includes('does not exist')
    || (error.message || '').toLowerCase().includes('column')
  )
);

const isMissingTableError = (error: { message?: string; code?: string } | null | undefined) => !!error && (
  error.code === '42P01' || (error.message || '').toLowerCase().includes('relation "public.configuracoes_compartilhamento" does not exist')
);

const normalizeBase64ForDecode = (value: string) => value
  .replace(/-/g, '+')
  .replace(/_/g, '/')
  .replace(/\s+/g, '');

const decodeBase64Payload = (value: string) => {
  const normalized = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  try {
    const binary = atob(normalizeBase64ForDecode(normalized));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    try {
      return new TextDecoder().decode(bytes);
    } catch {
      return binary;
    }
  } catch {
    return null;
  }
};

export interface LegacySharedPayload {
  id: string;
  documento: string;
  empresa: string;
  tempoLimite: string;
  dataGeracao: string;
  dataExpiracao: string;
  arquivoUrl: string;
}

export const parseLegacySharedPayload = (encoded: string): LegacySharedPayload | null => {
  const decoded = decodeBase64Payload(encoded);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as Partial<LegacySharedPayload>;
    if (!parsed?.id || !parsed?.arquivoUrl) return null;
    return {
      id: parsed.id,
      documento: parsed.documento || 'Documento compartilhado',
      empresa: parsed.empresa || 'Biblioteca pessoal',
      tempoLimite: parsed.tempoLimite || '1 hora',
      dataGeracao: parsed.dataGeracao || '',
      dataExpiracao: parsed.dataExpiracao || '',
      arquivoUrl: parsed.arquivoUrl,
    };
  } catch {
    return null;
  }
};

export const sanitizeSharedLink = (link: string) => {
  if (!link) return '';
  const withoutHash = link.replace(/#.*$/, '');
  if (!withoutHash) return '';

  try {
    const parsed = new URL(withoutHash);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const hasSharePath = pathParts.some((part) => part === 's' || part === 'shared');
    if (!hasSharePath) return withoutHash;

    const shareId = pathParts.at(-1);
    if (!shareId) return withoutHash;

    const normalizedPath = pathParts.join('/');
    if (normalizedPath.includes('/shared/d/')) {
      return `${parsed.origin}/shared/d/${shareId}`;
    }

    return `${parsed.origin}/s/${shareId}`;
  } catch {
    return withoutHash;
  }
};

export const parseShareDurationMs = (duration: string) => {
  const totalMinutes = getShareExpirationMinutes(duration);
  return totalMinutes * 60 * 1000;
};

export const formatShareDateTime = (date: Date, timeZone: string = 'America/Sao_Paulo') => (
  date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
);

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const parseLocalizedDateTime = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(',', '').trim();
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [day, month, year] = datePart.split('/');
  if (!day || !month || !year) return null;

  return new Date(`${Number(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`);
};

const buildPublicLink = (shareGroupId: string) => `${window.location.origin}/s/${shareGroupId}`;

const mapRowToLink = (row: SharedDocumentRow): SharedDocumentLink => ({
  id: row.id,
  documentId: row.documento_id || undefined,
  documento: row.documento_nome,
  empresa: row.empresa_nome,
  geradoPor: row.gerado_por,
  shareGroupId: row.share_group_id || row.id,
  dataGeracao: formatShareDateTime(new Date(row.created_at)),
  dataGeracaoIso: row.created_at,
  tempoLimite: row.tempo_limite,
  dataExpiracao: formatShareDateTime(new Date(row.expires_at)),
  dataExpiracaoIso: row.expires_at,
  status: row.status,
  senhaHash: row.senha_hash || undefined,
  senha: row.senha_visualizacao || undefined,
  link: buildPublicLink((row.share_group_id || row.id)),
});

const getCurrentEmpresaId = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) return null;
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);
  return null;
};

export const generateSharePassword = () => (
  `ARKH-${Math.floor(1000 + Math.random() * 9000)}-SEC`
);

export const documentShareService = {
  listRaw: async (includeGroupColumn: boolean): Promise<{ data: SharedDocumentRow[] | null; error: any | null }> => {
    const columns = includeGroupColumn ? SHARED_LINK_COLUMNS_WITH_GROUP : SHARED_LINK_MIN_COLUMNS;
    const { data, error } = await supabase
      .from(SHARE_TABLE)
      .select(columns)
      .order('created_at', { ascending: false });

    return { data: (data || null) as SharedDocumentRow[] | null, error };
  },

  async getConfiguracaoCompartilhamento(): Promise<ShareConfiguration> {
    try {
      const { data: dataWithNewColumns, error } = await supabase
        .from('configuracoes_compartilhamento')
        .select('tempo_padrao_minutos,exigir_senha,limitar_tipos,prazos_exigem_senha')
        .maybeSingle();

      if (error && isMissingColumnError(error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('configuracoes_compartilhamento')
          .select('expirar_links_dias,exigir_senha')
          .maybeSingle();

        if (legacyError) {
          if (isMissingTableError(legacyError)) return DEFAULT_SHARE_CONFIGURATION;
          console.error('[documentShareService.getConfiguracaoCompartilhamento] Não foi possível ler configuração:', legacyError);
          return DEFAULT_SHARE_CONFIGURATION;
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
        if (isMissingTableError(error)) return DEFAULT_SHARE_CONFIGURATION;
        console.error('[documentShareService.getConfiguracaoCompartilhamento] Não foi possível ler configuração:', error);
        return DEFAULT_SHARE_CONFIGURATION;
      }

      const row = dataWithNewColumns as ShareConfiguracaoRow | null;
      const tempoPadraoMinutos = Number(row?.tempo_padrao_minutos) > 0
        ? Number(row?.tempo_padrao_minutos)
        : DEFAULT_SHARE_CONFIGURATION.tempoPadraoMinutos;

      return normalizeShareConfig({
        tempoPadrao: getTempoPadraoLabelFromMinutes(tempoPadraoMinutos),
        tempoPadraoMinutos,
        limitarTipos: row?.limitar_tipos || DEFAULT_SHARE_CONFIGURATION.limitarTipos,
        exigirSenhaPadrao: Boolean(row?.exigir_senha),
        prazosExigemSenha: row?.prazos_exigem_senha || DEFAULT_SHARE_CONFIGURATION.prazosExigemSenha,
      });
    } catch (error) {
      console.error('[documentShareService.getConfiguracaoCompartilhamento] Erro ao recuperar configuração de compartilhamento:', error);
      return DEFAULT_SHARE_CONFIGURATION;
    }
  },

  async saveConfiguracaoCompartilhamento(input: ShareConfiguration): Promise<ShareConfiguration> {
    const empresaId = await getCurrentEmpresaId();

  const payload: Record<string, unknown> = {
      tempo_padrao_minutos: Math.max(1, Math.floor(input.tempoPadraoMinutos)),
      expirar_links_dias: Math.max(1, Math.ceil(input.tempoPadraoMinutos / (24 * 60))),
      exigir_senha: input.exigirSenhaPadrao,
      limitar_tipos: input.limitarTipos,
      prazos_exigem_senha: input.prazosExigemSenha,
  };

    if (empresaId) payload.empresa_id = empresaId;

    const commonPayload = {
      expirar_links_dias: payload.expirar_links_dias,
      exigir_senha: payload.exigir_senha,
    };

    const legacyPayload = {
      ...commonPayload,
      empresa_id: empresaId || undefined,
    };

    const newPayload = {
      ...commonPayload,
      tempo_padrao_minutos: payload.tempo_padrao_minutos,
      limitar_tipos: payload.limitar_tipos,
      prazos_exigem_senha: payload.prazos_exigem_senha,
      empresa_id: empresaId || undefined,
    };

    const attempts = [
      { payload: newPayload, allowRetry: true },
      { payload: legacyPayload, allowRetry: false },
    ];

    for (const attempt of attempts) {
      const { error } = await supabase
        .from('configuracoes_compartilhamento')
        .upsert(attempt.payload, { onConflict: 'empresa_id' });

      if (!error) {
        return normalizeShareConfig(input);
      }

      if (!attempt.allowRetry || !isMissingColumnError(error)) {
        console.error('[documentShareService.saveConfiguracaoCompartilhamento] Falha ao salvar configuração:', error);
        if (isMissingTableError(error)) return normalizeShareConfig(input);
        return normalizeShareConfig(input);
      }
    }

    return normalizeShareConfig(input);
  },

  async list(): Promise<SharedDocumentLink[]> {
    let { data, error } = await this.listRaw(true);
    if (isMissingColumnError(error)) {
      ({ data, error } = await this.listRaw(false));
    }

    if (error) {
      console.error('[documentShareService.list] Erro ao listar compartilhamentos do Supabase:', error);
      return [];
    }

    const links = (data || [])
      .filter((link) => !DEMO_LINK_IDS.includes(link.id))
      .map(mapRowToLink)
      .map((link) => ({
        ...link,
        link: sanitizeSharedLink(link.link),
        status: documentShareService.resolveStatus(link),
      }));

    return links;
  },

  resolveStatus(link: Pick<SharedDocumentLink, 'dataExpiracao' | 'dataExpiracaoIso' | 'status'>): 'Ativo' | 'Expirado' {
    const parsed = link.dataExpiracaoIso
      ? new Date(link.dataExpiracaoIso)
      : parseLocalizedDateTime(link.dataExpiracao);
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) return 'Expirado';
    return link.status === 'Expirado' ? 'Expirado' : 'Ativo';
  },

  async createLinks(input: {
    documents: ShareableDocument[];
    tempoLimite: string;
    exigirSenha: boolean;
    senha?: string;
    geradoPor?: string;
  }): Promise<SharedDocumentLink[]> {
    const now = new Date();
    const durationMs = parseShareDurationMs(input.tempoLimite);
    const expiresAt = new Date(now.getTime() + durationMs);
    const senha = input.exigirSenha ? (input.senha?.trim() || DEFAULT_SHARE_PASSWORD) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : undefined;
    const shareGroupId = makeId();

    const empresaId = await getCurrentEmpresaId();

    let empresaNomeReal = 'Empresa Fictícia Contábil';
    try {
      if (empresaId) {
        const { data: configDataEmpresa } = await supabase
          .from('configuracoes_empresa')
          .select('nome_fantasia, razao_social')
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (configDataEmpresa) {
          empresaNomeReal = configDataEmpresa.nome_fantasia || configDataEmpresa.razao_social || empresaNomeReal;
        }
      }
    } catch (err) {
      console.error('[documentShareService.createLinks] Falha ao recuperar empresa para nome padrão:', err);
    }

    const nextLinks = input.documents.map((doc) => {
      const id = makeId();
      const linkData: Omit<SharedDocumentLink, 'link'> = {
        id,
        shareGroupId,
        documentId: doc.id,
        documento: doc.nome,
        empresa: doc.empresaNome || empresaNomeReal,
        geradoPor: input.geradoPor || 'João Silva',
        dataGeracao: formatShareDateTime(now),
        dataGeracaoIso: now.toISOString(),
        tempoLimite: input.tempoLimite,
        dataExpiracao: formatShareDateTime(expiresAt),
        dataExpiracaoIso: expiresAt.toISOString(),
        senha,
        senhaHash,
        status: 'Ativo',
      };

      return {
        ...linkData,
        link: buildPublicLink(shareGroupId),
      };
    });

    const rowsBase = nextLinks.map((link) => {
      const row: Record<string, unknown> = {
        id: link.id,
        documento_id: link.documentId || null,
        documento_nome: link.documento,
        empresa_nome: link.empresa,
        gerado_por: link.geradoPor,
        tempo_limite: link.tempoLimite,
        expires_at: expiresAt.toISOString(),
        status: link.status,
      };

      if (empresaId) row.empresa_id = empresaId;
      if (shareGroupId) row.share_group_id = shareGroupId;
      if (senhaHash) row.senha_hash = senhaHash;
      if (senha) row.senha_visualizacao = senha;

      return row;
    });

    const { error } = await supabase.from(SHARE_TABLE).insert(rowsBase);
    if (error) {
      console.error('[documentShareService.createLinks] Erro ao inserir compartilhamentos no Supabase:', error);
      return [];
    }

    return nextLinks;
  },

  async revoke(targetId: string) {
    let { error } = await supabase
      .from(SHARE_TABLE)
      .update({ status: 'Expirado' })
      .or(`id.eq.${targetId},share_group_id.eq.${targetId}`);

    if (isMissingColumnError(error)) {
      const fallback = await supabase
        .from(SHARE_TABLE)
        .update({ status: 'Expirado' })
        .eq('id', targetId);
      error = fallback.error;
    }

    if (error) {
      console.error('[documentShareService.revoke] Erro ao revogar no Supabase:', error);
      return false;
    }

    return true;
  },

  async renew(targetId: string, input: { tempoLimite: string; exigirSenha: boolean; senha?: string }) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parseShareDurationMs(input.tempoLimite));
    const senha = input.exigirSenha ? (input.senha?.trim() || DEFAULT_SHARE_PASSWORD) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : null;

    const updatePayload = {
      tempo_limite: input.tempoLimite,
      expires_at: expiresAt.toISOString(),
      status: 'Ativo' as const,
      senha_hash: senhaHash,
      senha_visualizacao: senha || null,
    };

    let { error } = await supabase
      .from(SHARE_TABLE)
      .update(updatePayload)
      .or(`id.eq.${targetId},share_group_id.eq.${targetId}`);

    if (isMissingColumnError(error)) {
      const fallback = await supabase
        .from(SHARE_TABLE)
        .update(updatePayload)
        .eq('id', targetId);
      error = fallback.error;
    }

    if (error) {
      console.error('[documentShareService.renew] Erro ao renovar no Supabase:', error);
      return false;
    }

    return true;
  },

  async delete(targetId: string) {
    let { error } = await supabase
      .from(SHARE_TABLE)
      .delete()
      .or(`id.eq.${targetId},share_group_id.eq.${targetId}`);

    if (isMissingColumnError(error)) {
      const fallback = await supabase
        .from(SHARE_TABLE)
        .delete()
        .eq('id', targetId);
      error = fallback.error;
    }

    if (error) {
      console.error('[documentShareService.delete] Erro ao deletar no Supabase:', error);
      return false;
    }

    return true;
  },
};
