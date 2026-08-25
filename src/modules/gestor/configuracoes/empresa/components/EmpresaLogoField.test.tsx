/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./LogoCropModal', () => ({
  LogoCropModal: ({ file, onCancel, onApply }: {
    file: File;
    onCancel: () => void;
    onApply: (file: File) => Promise<void> | void;
  }) => (
    <div role="dialog" aria-label="Editor simulado">
      <button type="button" onClick={onCancel}>Cancelar recorte</button>
      <button type="button" onClick={() => onApply(new File(['crop'], `crop-${file.name}`, { type: 'image/webp' }))}>
        Aplicar recorte
      </button>
    </div>
  ),
}));

import { EmpresaLogoField } from './EmpresaLogoField';

describe('EmpresaLogoField', () => {
  afterEach(cleanup);

  it('permite aumentar a altura do logotipo até 240px', () => {
    const onDisplaySizeChange = vi.fn();
    render(
      <EmpresaLogoField
        previewUrl="https://example.com/logo.png"
        displaySize={110}
        disabled={false}
        onDisplaySizeChange={onDisplaySizeChange}
        onLogoUpload={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Altura de exibição' }) as HTMLInputElement;
    expect(slider.min).toBe('30');
    expect(slider.max).toBe('240');

    fireEvent.change(slider, { target: { value: '240' } });
    expect(onDisplaySizeChange).toHaveBeenCalledWith(240);
  });

  it('só envia o arquivo depois que o usuário aplica o recorte', async () => {
    const onLogoUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <EmpresaLogoField
        previewUrl={null}
        displaySize={80}
        disabled={false}
        onDisplaySizeChange={vi.fn()}
        onLogoUpload={onLogoUpload}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const selectedFile = new File(['logo'], 'empresa.png', { type: 'image/png' });

    fireEvent.change(input!, { target: { files: [selectedFile] } });
    expect(screen.getByRole('dialog', { name: 'Editor simulado' })).toBeTruthy();
    expect(onLogoUpload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar recorte' }));
    await waitFor(() => expect(onLogoUpload).toHaveBeenCalledOnce());
    expect(onLogoUpload.mock.calls[0][0]).toMatchObject({
      name: 'crop-empresa.png',
      type: 'image/webp',
    });
  });
});
