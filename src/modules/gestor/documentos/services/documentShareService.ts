import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { supabase } from '../../../../lib/supabase';

export interface SharedDocumentLink {
  id: string;
  documento: string;
  empresa: string;
  geradoPor: string;
  dataGeracao: string;
  tempoLimite: string;
  dataExpiracao: string;
  senha?: string;
  senhaHash?: string;
  link: string;
  arquivoUrl?: string;
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
const STORAGE_BUCKET = 'documentos';
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
  senha_visualizacao: string | null;
  arquivo_url: string | null;
  status: 'Ativo' | 'Expirado';
  created_at: string;
}

export const parseShareDurationMs = (duration: string) => {
  const [rawAmount, unit = ''] = duration.split(' ');
  const amount = Number(rawAmount) || 1;
  if (unit.startsWith('minuto')) return amount * 60 * 1000;
  if (unit.startsWith('hora')) return amount * 60 * 60 * 1000;
  if (unit.startsWith('dia')) return amount * 24 * 60 * 60 * 1000;
  return 3 * 60 * 60 * 1000;
};

export const formatShareDateTime = (date: Date) => (
  date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
);

const makeId = () => crypto.randomUUID();

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const hashSharePassword = async (password: string) => {
  const data = new TextEncoder().encode(password.trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const buildPublicLink = (link: Omit<SharedDocumentLink, 'link'>) => {
  const payload = toBase64Url(JSON.stringify({
    id: link.id,
    documento: link.documento,
    empresa: link.empresa,
    tempoLimite: link.tempoLimite,
    dataGeracao: link.dataGeracao,
    dataExpiracao: link.dataExpiracao,
    senhaHash: link.senhaHash,
    arquivoUrl: link.arquivoUrl,
  }));

  return `${window.location.origin}/shared/d/${link.id}#${payload}`;
};

const mapRowToLink = (row: SharedDocumentRow): SharedDocumentLink => {
  const linkData: Omit<SharedDocumentLink, 'link'> = {
    id: row.id,
    documentId: row.documento_id || undefined,
    documento: row.documento_nome,
    empresa: row.empresa_nome,
    geradoPor: row.gerado_por,
    dataGeracao: formatShareDateTime(new Date(row.created_at)),
    tempoLimite: row.tempo_limite,
    dataExpiracao: formatShareDateTime(new Date(row.expires_at)),
    senha: row.senha_visualizacao || undefined,
    senhaHash: row.senha_hash || undefined,
    arquivoUrl: row.arquivo_url || undefined,
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
        status: this.resolveStatus(link),
      }));
    } catch {
      return [];
    }
  },

  async list(): Promise<SharedDocumentLink[]> {
    const { data, error } = await supabase
      .from(SHARE_TABLE)
      .select('id,documento_id,documento_nome,empresa_nome,gerado_por,tempo_limite,expires_at,senha_hash,senha_visualizacao,arquivo_url,status,created_at')
      .order('created_at', { ascending: false });

    if (error) return this.listLocal();

    return ((data || []) as SharedDocumentRow[]).map(mapRowToLink).map((link) => ({
      ...link,
      status: this.resolveStatus(link),
    }));
  },

  save(links: SharedDocumentLink[]) {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  },

  resolveStatus(link: Pick<SharedDocumentLink, 'dataExpiracao' | 'status'>): 'Ativo' | 'Expirado' {
    const [datePart, timePart = '00:00'] = link.dataExpiracao.split(' ');
    const [day, month, year] = datePart.split('/');
    const parsed = new Date(`${year}-${month}-${day}T${timePart}:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) return 'Expirado';
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
    const expiresIn = Math.max(60, Math.floor(durationMs / 1000));
    const existing = this.listLocal();
    const senha = input.exigirSenha ? (input.senha?.trim() || DEFAULT_SHARE_PASSWORD) : undefined;
    const senhaHash = senha ? await hashSharePassword(senha) : undefined;

    const nextLinks = await Promise.all(input.documents.map(async (doc) => {
      const id = makeId();
      let arquivoUrl = doc.url;

      if (doc.storagePath) {
        const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storagePath, expiresIn);
        if (error) throw new Error(`Falha ao gerar link temporário de ${doc.nome}: ${error.message}`);
        arquivoUrl = data?.signedUrl || arquivoUrl;
      }

      const linkData: Omit<SharedDocumentLink, 'link'> = {
        id,
        documentId: doc.id,
        documento: doc.nome,
        empresa: doc.empresaNome || (doc.scope === 'empresa' ? 'Empresa vinculada' : 'Biblioteca pessoal'),
        geradoPor: input.geradoPor || 'João Silva',
        dataGeracao: formatShareDateTime(now),
        tempoLimite: input.tempoLimite,
        dataExpiracao: formatShareDateTime(expiresAt),
        senha,
        senhaHash,
        arquivoUrl,
        status: 'Ativo' as const,
      };

      return {
        ...linkData,
        link: buildPublicLink(linkData),
      };
    }));

    const rows = nextLinks.map((link) => ({
      id: link.id,
      documento_id: link.documentId || null,
      documento_nome: link.documento,
      empresa_nome: link.empresa,
      gerado_por: link.geradoPor,
      tempo_limite: link.tempoLimite,
      expires_at: expiresAt.toISOString(),
      senha_hash: link.senhaHash || null,
      senha_visualizacao: link.senha || null,
      arquivo_url: link.arquivoUrl || null,
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
