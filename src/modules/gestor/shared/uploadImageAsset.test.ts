/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc,
    storage: { from: vi.fn() },
  },
}));

import {
  PDF_COMPATIBLE_IMAGE_MIME_TYPES,
  uploadImageAsset,
} from './uploadImageAsset';

describe('upload de imagens destinadas ao PDF', () => {
  it.each([
    ['animacao.gif', 'image/gif'],
    ['arte.avif', 'image/avif'],
  ])('rejeita %s antes de acessar o Supabase', async (name, mimeType) => {
    const file = new File(['imagem'], name, { type: mimeType });

    await expect(uploadImageAsset(file, 'watermarks-portrait', 'empresa', {
      allowedMimeTypes: PDF_COMPATIBLE_IMAGE_MIME_TYPES,
      invalidTypeMessage: 'Use uma imagem PNG, JPG ou WebP.',
    })).rejects.toThrow('Use uma imagem PNG, JPG ou WebP.');
    expect(rpc).not.toHaveBeenCalled();
  });
});
