import {
  formatShareDateTime,
  hashSharePassword,
  parseLegacySharedPayload,
} from '../../gestor/documentos/services/documentShareService';
import { supabase } from '../../../lib/supabase';
import type { PublicSharedDocumentPayload, SharedDocumentForPublicView } from './types';

type PublicShareRow = {
  id: string;
  share_group_id: string;
  documento: string;
  documento_id: string;
  empresa: string;
  empresa_cnpj: string | null;
  tempo_limite: string;
  data_geracao: string;
  data_expiracao: string;
  senha_obrigatoria: boolean;
  storage_bucket: string | null;
  storage_path: string | null;
  gerado_por: string | null;
};

const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseLegacyDateTime = (value: string) => {
  if (!value) return null;
  const cleaned = value.replace(',', '').trim();
  const [datePart, timePart = '00:00'] = cleaned.split(' ');
  const [day, month, year] = datePart.split('/');
  if (!day || !month || !year) return null;
  return new Date(`${Number(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`);
};

const buildPayloadFromRows = (rows: PublicShareRow[]): PublicSharedDocumentPayload | null => {
  if (!rows.length) return null;
  const first = rows[0];
  const created = parseDate(first.data_geracao);
  const expires = parseDate(first.data_expiracao);

  return {
    shareGroupId: first.share_group_id,
    empresa: first.empresa || 'Biblioteca pessoal',
    empresaCnpj: first.empresa_cnpj,
    geradoPor: first.gerado_por || 'Responsável',
    tempoLimite: first.tempo_limite || '1 hora',
    dataGeracao: formatShareDateTime(created || new Date(), 'America/Sao_Paulo'),
    dataGeracaoIso: first.data_geracao,
    dataExpiracao: formatShareDateTime(expires || new Date(), 'America/Sao_Paulo'),
    dataExpiracaoIso: first.data_expiracao,
    senhaObrigatoria: first.senha_obrigatoria,
    documents: rows.map((row) => ({
      id: row.id,
      documento: row.documento,
      storage_bucket: row.storage_bucket,
      storage_path: row.storage_path,
    })),
    isLegacy: false,
  };
};

const buildPayloadFromLegacy = (legacy: ReturnType<typeof parseLegacySharedPayload>): PublicSharedDocumentPayload | null => {
  if (!legacy) return null;
  const created = parseLegacyDateTime(legacy.dataGeracao);
  const expires = parseLegacyDateTime(legacy.dataExpiracao);

  return {
    shareGroupId: legacy.id,
    empresa: legacy.empresa || 'Biblioteca pessoal',
    empresaCnpj: null,
    geradoPor: 'Responsável',
    tempoLimite: legacy.tempoLimite || '1 hora',
    dataGeracao: formatShareDateTime(created || new Date(), 'America/Sao_Paulo'),
    dataGeracaoIso: created ? created.toISOString() : '',
    dataExpiracao: formatShareDateTime(expires || new Date(), 'America/Sao_Paulo'),
    dataExpiracaoIso: expires ? expires.toISOString() : '',
    senhaObrigatoria: false,
    documents: [{
      id: legacy.id,
      documento: legacy.documento,
      storage_bucket: null,
      storage_path: null,
    }],
    legacyUrl: legacy.arquivoUrl,
    isLegacy: true,
  };
};

export const getShareIdFromPath = () => window.location.pathname.split('/').filter(Boolean).at(-1) || null;

export const fetchPublicShare = async (passwordHash?: string): Promise<PublicSharedDocumentPayload | null> => {
  const shareId = getShareIdFromPath();
  if (!shareId) return null;

  const { data, error } = await supabase.rpc('get_public_document_share', {
    p_share_id: shareId,
    p_password_hash: passwordHash || null,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return buildPayloadFromRows(data as PublicShareRow[]);
  }

  return buildPayloadFromLegacy(parseLegacySharedPayload(window.location.hash.replace(/^#/, '')));
};

export const createDocumentAccessUrl = async (
  document: SharedDocumentForPublicView,
  expiresAtSeconds: number,
) => {
  if (!document.storage_bucket || !document.storage_path) return null;
  const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, expiresAtSeconds);
  return error ? null : (data?.signedUrl || null);
};

export const checkPassword = async (
  password: string,
  share: PublicSharedDocumentPayload,
) => {
  if (!share.senhaObrigatoria || share.isLegacy) {
    return {
      ok: true,
      share,
    };
  }
  const passwordHash = await hashSharePassword(password);
  const unlocked = await fetchPublicShare(passwordHash);
  return {
    ok: Boolean(unlocked && unlocked.documents.some((doc) => doc.storage_bucket && doc.storage_path)),
    share: unlocked,
  };
};

export const getDocumentMode = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'image';
  return 'generic';
};

export const loadPdfFirstPagePreview = async (signedUrl: string): Promise<string | null> => {
  try {
    const [pdfjsLib, pdfWorker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);

    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

    const pdf = await pdfjsLib.getDocument({ url: signedUrl }).promise;
    const page = await pdf.getPage(1);

    const targetWidth = 160;
    const targetHeight = 92;
    const baseViewport = page.getViewport({ scale: 1 });
    const scaleX = targetWidth / baseViewport.width;
    const scaleY = targetHeight / baseViewport.height;
    const scale = Math.max(0.7, Math.min(scaleX, scaleY, 2.2));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      page.cleanup();
      await pdf.destroy();
      return null;
    }

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const preview = canvas.toDataURL('image/png');
    page.cleanup();
    await pdf.destroy();

    return preview;
  } catch {
    return null;
  }
};

export const formatCountdownLabel = (milliseconds: number | null) => {
  if (milliseconds === null) return null;
  if (milliseconds <= 0) return 'Expirado';
  const total = Math.floor(milliseconds / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) {
    return `${String(days)}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
