import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { supabase } from '../../../../lib/supabase';
import { hashSharePassword } from '../utils/shareCrypto';
import { resolveDocumentShareIdentity } from './documentShareIdentity';
import {
  getConfiguracaoCompartilhamento,
  getShareExpirationMinutes,
  isSharePasswordRequired,
  saveConfiguracaoCompartilhamento,
} from './documentShareConfiguration';

export { hashSharePassword };
export {
  SHARE_EXPIRATION_OPTIONS,
  getShareExpirationMinutes,
  isSharePasswordRequired,
  type ShareConfiguration,
} from './documentShareConfiguration';

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

const DEMO_LINK_IDS = ['l1', 'l2', 'l3', 'l4'];
const SHARE_TABLE = 'documentos_compartilhamentos';

const SHARED_LINK_MIN_COLUMNS = 'id,documento_nome,empresa_nome,gerado_por,documento_id,tempo_limite,expires_at,status,created_at,senha_hash';
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
}

const isMissingColumnError = (error: { message?: string; code?: string } | null | undefined) => (
  !!error && (
    error.code === '42703'
    || error.code === '42704'
    || (error.message || '').toLowerCase().includes('does not exist')
    || (error.message || '').toLowerCase().includes('column')
  )
);

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
  link: buildPublicLink((row.share_group_id || row.id)),
});

export const generateSharePassword = () => (
  `ARKH-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => (
    byte.toString(16).padStart(2, '0')
  )).join('')}`
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

  getConfiguracaoCompartilhamento,

  saveConfiguracaoCompartilhamento,

  async list(): Promise<SharedDocumentLink[]> {
    let { data, error } = await this.listRaw(true);
    if (isMissingColumnError(error)) {
      ({ data, error } = await this.listRaw(false));
    }

    if (error) {
      console.error('[documentShareService.list] Erro ao listar compartilhamentos do Supabase:', error);
      throw new Error('Não foi possível carregar os compartilhamentos. Tente novamente.');
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
  }): Promise<SharedDocumentLink[]> {
    if (input.documents.length === 0) {
      throw new Error('Selecione ao menos um arquivo para compartilhar.');
    }
    const now = new Date();
    const durationMs = parseShareDurationMs(input.tempoLimite);
    const expiresAt = new Date(now.getTime() + durationMs);
    const shareConfig = await getConfiguracaoCompartilhamento();
    const exigirSenha = isSharePasswordRequired(shareConfig, input.tempoLimite, input.exigirSenha);
    const senha = exigirSenha ? (input.senha?.trim() || generateSharePassword()) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : undefined;
    const shareGroupId = makeId();

    const identity = await resolveDocumentShareIdentity();
    const empresaId = identity.empresaId;

    const nextLinks = input.documents.map((doc) => {
      const id = makeId();
      const linkData: Omit<SharedDocumentLink, 'link'> = {
        id,
        shareGroupId,
        documentId: doc.id,
        documento: doc.nome,
        empresa: doc.empresaNome || identity.empresaNome,
        geradoPor: identity.usuarioNome,
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

      return row;
    });

    const { error } = await supabase.from(SHARE_TABLE).insert(rowsBase);
    if (error) {
      console.error('[documentShareService.createLinks] Erro ao inserir compartilhamentos no Supabase:', error);
      throw new Error('Não foi possível gerar o compartilhamento. Tente novamente.');
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
      throw new Error('Não foi possível revogar o compartilhamento. O link continua ativo.');
    }

    return true;
  },

  async renew(targetId: string, input: { tempoLimite: string; exigirSenha: boolean; senha?: string }) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parseShareDurationMs(input.tempoLimite));
    const shareConfig = await getConfiguracaoCompartilhamento();
    const exigirSenha = isSharePasswordRequired(shareConfig, input.tempoLimite, input.exigirSenha);
    const senha = exigirSenha ? (input.senha?.trim() || generateSharePassword()) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : null;

    const updatePayload = {
      tempo_limite: input.tempoLimite,
      expires_at: expiresAt.toISOString(),
      status: 'Ativo' as const,
      senha_hash: senhaHash,
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
      throw new Error('Não foi possível renovar o compartilhamento. O link não foi alterado.');
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
      throw new Error('Não foi possível excluir o compartilhamento. Tente novamente.');
    }

    return true;
  },
};
