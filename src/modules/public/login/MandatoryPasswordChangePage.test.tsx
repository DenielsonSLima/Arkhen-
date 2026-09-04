/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MandatoryPasswordChangePage } from './MandatoryPasswordChangePage';

const mocks = vi.hoisted(() => ({
  onSubmitPassword: vi.fn(),
  onLogout: vi.fn(),
}));

const renderPage = () => render(
  <MandatoryPasswordChangePage
    cpf="529.982.247-25"
    onSubmitPassword={mocks.onSubmitPassword}
    onLogout={mocks.onLogout}
  />,
);

const fillPasswords = (password: string, confirmation = password) => {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
    target: { value: confirmation },
  });
};

const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'CRIAR SENHA E CONTINUAR' }));
};

describe('MandatoryPasswordChangePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onSubmitPassword.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it.each([
    ['senha curta', 'abc123'],
    ['senha que contém o CPF', 'Senha52998224725'],
  ])('rejeita %s pela política de senha do funcionário', (_scenario, password) => {
    renderPage();
    fillPasswords(password);
    submit();

    expect(screen.getByRole('alert').textContent).toContain('10 a 128 caracteres');
    expect(mocks.onSubmitPassword).not.toHaveBeenCalled();
  });

  it('rejeita confirmação divergente sem chamar a atualização', () => {
    renderPage();
    fillPasswords('SenhaDefinitiva123', 'SenhaDefinitiva124');
    submit();

    expect(screen.getByRole('alert').textContent).toContain('confirmação não corresponde');
    expect(mocks.onSubmitPassword).not.toHaveBeenCalled();
  });

  it('envia a nova senha quando política e confirmação são válidas', async () => {
    renderPage();
    fillPasswords('SenhaDefinitiva123');
    submit();

    await waitFor(() => {
      expect(mocks.onSubmitPassword).toHaveBeenCalledOnce();
      expect(mocks.onSubmitPassword).toHaveBeenCalledWith('SenhaDefinitiva123');
    });
  });
});
