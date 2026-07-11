import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { supabase } from '../../../../lib/supabase';

export interface SharedDocumentLink {
  id: string;
  documento: string;
  empresa: string;
  geradoPor: string;
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

export const SHARE_EXPIRATION_OPTIONS = [
  '10 minutos',
  '30 minutos',
  '1 hora',
  '3 horas',
  '6 horas',
  '12 horas',
  '24 horas',
  '3 dias',
];

const LINKS_STORAGE_KEY = 'cfg_share_links_gerados';
const DEMO_LINK_IDS = ['l1', 'l2', 'l3', 'l4'];
const SHARE_TABLE = 'documentos_compartilhamentos';
export const DEFAULT_SHARE_PASSWORD = 'ARKH-1876-SEC';

interface SharedDocumentRow {
  id: string;
  documento_id: string | null;
  documento_nome: string;
  empresa_nome: string;
  gerado_por: string;
  tempo_limite: string;
  expires_at: string;
  senha_hash: string | null;
  status: 'Ativo' | 'Expirado';
  created_at: string;
}

export interface LegacySharedPayload {
  id: string;
  documento: string;
  empresa: string;
  tempoLimite: string;
  dataGeracao: string;
  dataExpiracao: string;
  arquivoUrl: string;
}

const normalizeBase64ForDecode = (value: string) => value
  .replace(/-/g, '+')
  .replace(/_/g, '/')
  .replace(/\s+/g, '');

export const parseLegacySharedPayload = (encoded: string): LegacySharedPayload | null => {
  const padding = '='.repeat((4 - (encoded.length % 4)) % 4);
  const normalized = `${encoded}${padding}`;
  try {
    const decoded = atob(normalizeBase64ForDecode(normalized));
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
    return `${parsed.origin}/s/${shareId}`;
  } catch {
    return withoutHash;
  }
};

export const parseShareDurationMs = (duration: string) => {
  const [rawAmount, unit = ''] = duration.split(' ');
  const amount = Number(rawAmount) || 1;
  if (unit.startsWith('minuto')) return amount * 60 * 1000;
  if (unit.startsWith('hora')) return amount * 60 * 60 * 1000;
  if (unit.startsWith('dia')) return amount * 24 * 60 * 60 * 1000;
  return 3 * 60 * 60 * 1000;
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

const makeId = () => crypto.randomUUID();

const parseLocalizedDateTime = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(',', '').trim();
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [day, month, year] = datePart.split('/');
  if (!day || !month || !year) return null;

  return new Date(`${Number(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`);
};

export const hashSharePassword = async (password: string) => {
  const data = new TextEncoder().encode(password.trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const buildPublicLink = (link: Pick<SharedDocumentLink, 'id'>) => `${window.location.origin}/s/${link.id}`;

const mapRowToLink = (row: SharedDocumentRow): SharedDocumentLink => {
  const linkData: Omit<SharedDocumentLink, 'link'> = {
    id: row.id,
    documentId: row.documento_id || undefined,
    documento: row.documento_nome,
    empresa: row.empresa_nome,
    geradoPor: row.gerado_por,
    dataGeracao: formatShareDateTime(new Date(row.created_at)),
    dataGeracaoIso: row.created_at,
    tempoLimite: row.tempo_limite,
    dataExpiracao: formatShareDateTime(new Date(row.expires_at)),
    dataExpiracaoIso: row.expires_at,
    status: row.status,
  };

  return {
    ...linkData,
    link: buildPublicLink(linkData),
  };
};

export const generateSharePassword = () => (
  `ARKH-${Math.floor(1000 + Math.random() * 9000)}-SEC`
);

export const documentShareService = {
  listLocal(): SharedDocumentLink[] {
    const data = localStorage.getItem(LINKS_STORAGE_KEY);
    if (!data) return [];

    try {
      const links = (JSON.parse(data) as SharedDocumentLink[]).filter((link) => !DEMO_LINK_IDS.includes(link.id));
      if (links.length !== (JSON.parse(data) as SharedDocumentLink[]).length) this.save(links);
      return links.map((link) => ({
        ...link,
        link: sanitizeSharedLink(link.link),
        status: this.resolveStatus(link),
      }));
    } catch {
      return [];
    }
  },

  async list(): Promise<SharedDocumentLink[]> {
    const { data, error } = await supabase
      .from(SHARE_TABLE)
      .select('id,documento_id,documento_nome,empresa_nome,gerado_por,tempo_limite,expires_at,senha_hash,status,created_at')
      .order('created_at', { ascending: false });

    if (error) return this.listLocal();

    return ((data || []) as SharedDocumentRow[]).map(mapRowToLink).map((link) => ({
      ...link,
      link: sanitizeSharedLink(link.link),
      status: this.resolveStatus(link),
    }));
  },

  save(links: SharedDocumentLink[]) {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
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
    const existing = this.listLocal();
    const senha = input.exigirSenha ? (input.senha?.trim() || DEFAULT_SHARE_PASSWORD) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : undefined;

    const nextLinks = input.documents.map((doc) => {
      const id = makeId();

      const linkData: Omit<SharedDocumentLink, 'link'> = {
        id,
        documentId: doc.id,
        documento: doc.nome,
        empresa: doc.empresaNome || (doc.scope === 'empresa' ? 'Empresa vinculada' : 'Biblioteca pessoal'),
        geradoPor: input.geradoPor || 'João Silva',
        dataGeracao: formatShareDateTime(now),
        dataGeracaoIso: now.toISOString(),
        tempoLimite: input.tempoLimite,
        dataExpiracao: formatShareDateTime(expiresAt),
        dataExpiracaoIso: expiresAt.toISOString(),
        senha,
        senhaHash,
        status: 'Ativo' as const,
      };

      return {
        ...linkData,
        link: buildPublicLink(linkData),
      };
    });

    const rows = nextLinks.map((link) => ({
      id: link.id,
      documento_id: link.documentId || null,
      documento_nome: link.documento,
      empresa_nome: link.empresa,
      gerado_por: link.geradoPor,
      tempo_limite: link.tempoLimite,
      expires_at: expiresAt.toISOString(),
      senha_hash: link.senhaHash || null,
      status: link.status,
    }));

    const { error } = await supabase.from(SHARE_TABLE).insert(rows);
    if (error) {
      this.save([...nextLinks, ...existing]);
    } else {
      this.save(nextLinks);
    }

    return nextLinks;
  },

  async revoke(id: string) {
    const { error } = await supabase.from(SHARE_TABLE).update({ status: 'Expirado' }).eq('id', id);
    const links = this.listLocal().map((link) => (
      link.id === id ? { ...link, status: 'Expirado' as const } : link
    ));
    this.save(links);
    if (error) return;
  },
};
