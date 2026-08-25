/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCroppedLogoFile: vi.fn(),
}));

vi.mock('../services/logoImageProcessor', async () => {
  const actual = await vi.importActual<typeof import('../services/logoImageProcessor')>(
    '../services/logoImageProcessor',
  );
  return { ...actual, createCroppedLogoFile: mocks.createCroppedLogoFile };
});

import { LogoCropModal } from './LogoCropModal';

const sourceFile = new File(['source'], 'empresa.png', { type: 'image/png' });

describe('LogoCropModal', () => {
  beforeEach(() => {
    mocks.createCroppedLogoFile.mockReset();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:logo-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('fecha com Escape, restaura a rolagem e libera a URL temporária', () => {
    const onCancel = vi.fn();
    document.body.style.overflow = 'auto';
    const { unmount } = render(
      <LogoCropModal file={sourceFile} onCancel={onCancel} onApply={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Recortar logotipo' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();

    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logo-preview');
  });

  it('gera o arquivo recortado e o entrega somente ao confirmar', async () => {
    const croppedFile = new File(['crop'], 'empresa-recortada.webp', { type: 'image/webp' });
    const onApply = vi.fn().mockResolvedValue(undefined);
    mocks.createCroppedLogoFile.mockResolvedValue(croppedFile);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 320,
      height: 320,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(<LogoCropModal file={sourceFile} onCancel={vi.fn()} onApply={onApply} />);

    const image = screen.getByRole('img', { name: 'Prévia do recorte do logotipo' });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 4000 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 400 });
    fireEvent.load(image);

    const stage = screen.getByRole('group', { name: /área de recorte/i });
    await waitFor(() => expect(stage.style.aspectRatio).toBe('10'));
    const initialTransform = image.style.transform;
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    await waitFor(() => expect(image.style.transform).not.toBe(initialTransform));

    const applyButton = screen.getByRole('button', { name: 'Aplicar recorte' });
    await waitFor(() => expect((applyButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(applyButton);

    await waitFor(() => expect(mocks.createCroppedLogoFile).toHaveBeenCalledOnce());
    expect(onApply).toHaveBeenCalledWith(croppedFile);
  });
});
