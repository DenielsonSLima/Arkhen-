/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogin } from '../hooks/useLogin';
import { LoginForm } from './LoginForm';

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('../services/loginService', () => ({ loginService: { autenticar: authenticate } }));
vi.mock('../../../gestor/gestao-empresarial/services/cnpjLookupService', () => ({ cnpjLookupService: {} }));

const Harness = ({ onSuccess = vi.fn() }) => <LoginForm loginState={useLogin()} onLoginSuccess={onSuccess} />;
const submit = () => {
  fireEvent.change(screen.getByLabelText('E-mail ou CPF'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SenhaDeTeste42' } });
  fireEvent.click(screen.getByRole('button', { name: 'ACESSAR SISTEMA' }));
};

describe('motivo do bloqueio de login', () => {
  beforeEach(() => authenticate.mockReset());
  afterEach(cleanup);

  it('mostra a causa real de permissao sem atribui-la ao horario', async () => {
    authenticate.mockResolvedValue({ success: false, blockedByAccess: true, message: 'Sessao de credencial desatualizada.' });
    render(<Harness />);
    submit();
    expect(await screen.findByRole('heading', { name: 'Acesso não autorizado' })).toBeDefined();
    expect(screen.getByText('Sessao de credencial desatualizada.')).toBeDefined();
    expect(screen.queryByText('Acesso fora do período permitido')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('heading', { name: 'Acesso não autorizado' })).toBeNull();
  });

  it('preserva a mensagem de uma restricao de horario real e limpa bloqueio ao tentar de novo', async () => {
    const onSuccess = vi.fn();
    authenticate.mockResolvedValueOnce({ success: false, blockedByAccess: true, message: 'Acesso permitido somente das 08:00 às 18:00.' });
    authenticate.mockResolvedValueOnce({ success: true, message: 'Login realizado com sucesso!' });
    render(<Harness onSuccess={onSuccess} />);
    submit();
    expect(await screen.findByText('Acesso permitido somente das 08:00 às 18:00.')).toBeDefined();
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(screen.queryByRole('heading', { name: 'Acesso não autorizado' })).toBeNull();
  });
});
