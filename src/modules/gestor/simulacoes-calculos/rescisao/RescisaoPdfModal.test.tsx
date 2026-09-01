/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RescisaoPdfModal } from './RescisaoPdfModal';

afterEach(cleanup);

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir relatório</button>
      {open ? (
        <RescisaoPdfModal
          bytes={null}
          pageCount={0}
          loading={false}
          error=""
          onClose={() => setOpen(false)}
          onDownload={vi.fn()}
        />
      ) : null}
    </>
  );
};

describe('RescisaoPdfModal', () => {
  it('mantém o foco no diálogo, fecha com Escape e restaura o foco anterior', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir relatório' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Relatório de Rescisão' });
    expect(document.body.contains(dialog)).toBe(true);
    const headerClose = screen.getByRole('button', { name: 'Fechar prévia' });
    const footerClose = screen.getByRole('button', { name: /^Fechar$/ });
    expect(document.activeElement).toBe(headerClose);

    footerClose.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(headerClose);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(footerClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
