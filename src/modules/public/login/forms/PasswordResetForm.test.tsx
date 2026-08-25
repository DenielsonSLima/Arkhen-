/** @vitest-environment jsdom */

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { updatePasswordMock } = vi.hoisted(() => ({
  updatePasswordMock: vi.fn(),
}));

import { PasswordResetForm } from './PasswordResetForm';

type PasswordResetFormProps = ComponentProps<typeof PasswordResetForm>;

const renderForm = (overrides: Partial<PasswordResetFormProps> = {}) => {
  const props: PasswordResetFormProps = {
    isValidating: false,
    isSessionReady: true,
    callbackError: null,
    onSubmitPassword: updatePasswordMock,
    onCancel: vi.fn(async () => undefined),
    ...overrides,
  };

  render(<PasswordResetForm {...props} />);
  return props;
};

const fillPasswords = (password: string, confirmation = password) => {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: confirmation } });
};

const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'SALVAR NOVA SENHA' }));
};

describe('PasswordResetForm', () => {
  beforeEach(() => {
    updatePasswordMock.mockReset();
    updatePasswordMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('informa que a sessão está ausente e permite solicitar outro link', () => {
    const onCancel = vi.fn(async () => undefined);
    renderForm({ isSessionReady: false, callbackError: null, onCancel });

    expect(screen.getByRole('alert').textContent).toContain('não possui uma sessão de recuperação válida');
    expect(screen.queryByLabelText('Nova senha')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /solicitar outro link/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('mostra a validação do link sem liberar o formulário', () => {
    renderForm({ isValidating: true, isSessionReady: false });

    expect(screen.getByRole('status').textContent).toMatch(/validando/i);
    expect(screen.queryByLabelText('Nova senha')).toBeNull();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('rejeita senha fraca sem chamar o serviço', () => {
    renderForm();
    fillPasswords('abc');
    submit();

    expect(screen.getByRole('alert').textContent).toContain('pelo menos 6 caracteres');
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('rejeita confirmação divergente sem chamar o serviço', () => {
    renderForm();
    fillPasswords('abc123', 'abc124');
    submit();

    expect(screen.getByRole('alert').textContent).toContain('confirmação não corresponde');
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('atualiza uma vez e conclui o fluxo quando o formulário é válido', async () => {
    renderForm();
    fillPasswords('abc123');
    submit();

    await waitFor(() => expect(updatePasswordMock).toHaveBeenCalledTimes(1));
    expect(updatePasswordMock).toHaveBeenCalledWith('abc123');
  });

  it('mantém o formulário preenchido quando a atualização falha', async () => {
    updatePasswordMock.mockRejectedValueOnce(new Error('Falha remota ao atualizar.'));
    renderForm();
    fillPasswords('abc123');
    submit();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Falha remota ao atualizar.');
    });
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('abc123');
    expect((screen.getByLabelText('Confirmar nova senha') as HTMLInputElement).value).toBe('abc123');
    expect(screen.getByRole('button', { name: 'SALVAR NOVA SENHA' })).toBeDefined();
  });

  it('bloqueia um segundo envio enquanto o primeiro está pendente', async () => {
    let resolveUpdate: (() => void) | undefined;
    updatePasswordMock.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    }));
    renderForm();
    fillPasswords('abc123');

    const submitButton = screen.getByRole('button', { name: 'SALVAR NOVA SENHA' }) as HTMLButtonElement;
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton.disabled).toBe(true));
    fireEvent.click(submitButton);
    expect(updatePasswordMock).toHaveBeenCalledTimes(1);

    resolveUpdate?.();
    await waitFor(() => expect(submitButton.disabled).toBe(false));
    expect(updatePasswordMock).toHaveBeenCalledTimes(1);
  });

  it('não atualiza sem uma sessão de recuperação pronta', () => {
    renderForm({ isSessionReady: false });

    expect(screen.getByRole('alert').textContent).toMatch(/sessão de recuperação/i);
    expect(screen.queryByLabelText('Nova senha')).toBeNull();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('exibe a falha ao cancelar sem gerar rejeição não tratada', async () => {
    renderForm({
      isSessionReady: false,
      onCancel: vi.fn(async () => { throw new Error('Falha ao encerrar sessão.'); }),
    });

    fireEvent.click(screen.getByRole('button', { name: /solicitar outro link/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Falha ao encerrar sessão.'));
  });
});
