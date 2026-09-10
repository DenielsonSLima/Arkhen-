/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GuideScreenshotFigure } from './GuideScreenshotFigure';
import type { GuideScreenshot } from '../types';

const image: GuideScreenshot = {
  src: '/guia-ajuda/screens/parceiros.png',
  alt: 'Lista de parceiros e botão Novo parceiro',
  caption: 'Onde cadastrar um parceiro',
  markers: [{ x: 82, y: 24, label: 'Novo parceiro', description: 'Abre o formulário de cadastro.' }],
};

afterEach(() => cleanup());

function openViewer() {
  const trigger = screen.getByRole('button', { name: `Ampliar imagem: ${image.caption}` });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('Fotos do manual', () => {
  it('exibe a foto real sem carregar antecipadamente e explica as marcações', () => {
    render(<GuideScreenshotFigure image={image} />);
    const photo = screen.getByRole('img', { name: image.alt });
    expect(photo.getAttribute('src')).toBe(image.src);
    expect(photo.getAttribute('loading')).toBe('lazy');
    expect(within(screen.getByRole('list', { name: 'Indicações na imagem' })).getByText('Novo parceiro')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre em portal, prende o foco, fecha com Escape e restaura o foco e a rolagem', () => {
    document.body.style.overflow = 'auto';
    const { container } = render(<GuideScreenshotFigure image={image} />);
    const trigger = openViewer();
    const dialog = screen.getByRole('dialog', { name: image.caption });
    const close = within(dialog).getByRole('button', { name: 'Fechar imagem ampliada' });
    const zoom = within(dialog).getByRole('button', { name: 'Ver detalhes' });
    const viewport = within(dialog).getByRole('region');
    expect(container.contains(dialog)).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');
    viewport.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(zoom);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(viewport);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('alterna a ampliação sem fechar ao tocar na imagem e fecha somente pelo fundo', () => {
    render(<GuideScreenshotFigure image={image} />);
    openViewer();
    const dialog = screen.getByRole('dialog');
    const zoom = within(dialog).getByRole('button', { name: 'Ver detalhes' });
    zoom.focus();
    fireEvent.click(zoom);
    expect(zoom.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(zoom);
    expect(within(dialog).getByRole('region').classList.contains('is-zoomed')).toBe(true);
    fireEvent.click(within(dialog).getByRole('img'));
    expect(screen.getByRole('dialog')).toBe(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajustar à tela' }));
    expect(within(dialog).getByRole('region').classList.contains('is-zoomed')).toBe(false);
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('libera a rolagem ao desmontar com uma foto aberta', () => {
    const { unmount } = render(<GuideScreenshotFigure image={image} />);
    openViewer();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
