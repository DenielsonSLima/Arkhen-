import { supabase } from '../../../lib/supabase';

const ASSETS_BUCKET = 'app-assets';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
  if (fromName && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpg' ? 'jpeg' : fromName;
  }

  const fromMime = file.type.split('/')[1]?.toLowerCase();
  return fromMime && ['png', 'jpeg', 'webp', 'gif'].includes(fromMime) ? fromMime : 'png';
};

export const uploadImageAsset = async (file: File, folder: string, entityId: string) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const extension = getImageExtension(file);
  const storagePath = `${sanitizeSegment(folder)}/${sanitizeSegment(entityId)}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(storagePath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`Erro ao enviar imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
};
