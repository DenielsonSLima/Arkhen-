/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsuarioTemporaryPasswordModal } from './UsuarioTemporaryPasswordModal';

const TEMPORARY_PASSWORD = 'Temp-Segura-4821';
const clipboardWrite = vi.fn();

const LocalStateHarness = () => {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(TEMPORARY_PASSWORD);

  if (!temporaryPassword) return <output>Credencial temporária removida</output>;
  return (
    <UsuarioTemporaryPasswordModal
      usuarioNome="Maria da Silva"
      cpf="52998224725"
      temporaryPassword={temporaryPassword}
      onClose={() => setTemporaryPassword(null)}
    />
  );
};

describe('UsuarioTemporaryPasswordModal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clipboardWrite.mockReset();
    clipboardWrite.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('remove a senha do DOM ao fechar e não a persiste em armazenamento do navegador', () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    render(<LocalStateHarness />);

    expect(screen.getByText(TEMPORARY_PASSWORD)).toBeDefined();
    expect(storageWrite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar e apagar senha temporária' }));

    expect(screen.queryByText(TEMPORARY_PASSWORD)).toBeNull();
    expect(screen.getByText('Credencial temporária removida')).toBeDefined();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('só envia a senha ao clipboard após ação explícita do gestor', async () => {
    render(<LocalStateHarness />);

    expect(clipboardWrite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar senha' }));

    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(TEMPORARY_PASSWORD));
    expect(screen.getByRole('button', { name: 'Senha copiada' })).toBeDefined();
  });
});
