import { supabase } from '../../../lib/supabase';

const ASSETS_BUCKET = 'app-assets';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const PDF_COMPATIBLE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const PDF_COMPATIBLE_IMAGE_ACCEPT = PDF_COMPATIBLE_IMAGE_MIME_TYPES.join(',');

interface UploadImageAssetOptions {
  allowedMimeTypes?: readonly string[];
  invalidTypeMessage?: string;
}

const sanitizeSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset'
);

const getImageExtension = (file: File) => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(fromName)) {
    return fromName === 'jpg' ? 'jpeg' : fromName;
  }

  const fromMime = file.type.split('/')[1]?.toLowerCase();
  return fromMime && ['png', 'jpeg', 'webp', 'gif', 'svg+xml'].includes(fromMime)
    ? fromMime.replace('+xml', '')
    : 'png';
};

export const uploadImageAsset = async (
  file: File,
  folder: string,
  entityId: string,
  options: UploadImageAssetOptions = {},
) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  const normalizedMime = file.type.toLowerCase();
  if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(normalizedMime)) {
    throw new Error(options.invalidTypeMessage ?? 'O formato da imagem não é permitido.');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const { data: empresaId, error: empresaError } = await supabase.rpc('current_empresa_id');
  if (empresaError || !empresaId) {
    throw empresaError ?? new Error('Empresa ativa não encontrada para o upload.');
  }

  const extension = getImageExtension(file);
  const storagePath = `${empresaId}/${sanitizeSegment(folder)}/${sanitizeSegment(entityId)}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(storagePath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Erro ao enviar imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
};
