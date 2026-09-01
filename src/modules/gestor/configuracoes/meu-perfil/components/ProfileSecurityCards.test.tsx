/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPLOYEE_PASSWORD_REQUIREMENTS } from '../../../../../lib/employeePasswordPolicy';
import { ProfileSecurityCards } from './ProfileSecurityCards';

afterEach(cleanup);

const renderCards = (authMethod: 'email' | 'cpf') => {
  const onChangePassword = vi.fn().mockResolvedValue(true);
  const onError = vi.fn();

  render(
    <ProfileSecurityCards
      authMethod={authMethod}
      cpf="529.982.247-25"
      email="gestao@exemplo.com"
      isChangingPassword={false}
      isSendingResetEmail={false}
      onChangePassword={onChangePassword}
      onSendResetEmail={vi.fn()}
      onError={onError}
    />,
  );

  return { onChangePassword, onError };
};

const submitPassword = (password: string) => {
  fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: password } });
  const submitButton = screen.getByRole('button', { name: 'Alterar Senha' });
  fireEvent.submit(submitButton.closest('form')!);
};

describe('ProfileSecurityCards', () => {
  it('aplica a política forte e impede CPF na senha de contas por CPF', () => {
    const { onChangePassword, onError } = renderCards('cpf');

    submitPassword('A529.982.247-25x');

    expect(onError).toHaveBeenCalledWith(EMPLOYEE_PASSWORD_REQUIREMENTS);
    expect(onChangePassword).not.toHaveBeenCalled();
  });

  it('preserva a regra legada de seis caracteres para contas por e-mail', async () => {
    const { onChangePassword, onError } = renderCards('email');

    submitPassword('abc123');

    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith('abc123'));
    expect(onError).not.toHaveBeenCalled();
  });
});
