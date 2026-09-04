/** @vitest-environment jsdom */

import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initialLocation: {
    pathname: '/redefinir-senha',
    search: '',
    hash: '#type=invite',
  },
}));

vi.mock('../../../lib/supabase', () => ({
  getInitialAuthLocation: () => mocks.initialLocation,
  createIsolatedPasswordRecoveryClient: vi.fn(),
  takeInitialPasswordRecoveryTokens: vi.fn(),
  supabase: { auth: { resetPasswordForEmail: vi.fn() } },
}));

import { PasswordRecoveryGate } from './PasswordRecoveryGate';

type GateProps = ComponentProps<typeof PasswordRecoveryGate>;

const renderGate = (overrides: Partial<GateProps> = {}) => render(
  <PasswordRecoveryGate
    status="ready"
    callbackError={null}
    onSubmitPassword={vi.fn(async () => undefined)}
    onCancel={vi.fn(async () => undefined)}
    onContinue={vi.fn(async () => undefined)}
    {...overrides}
  />,
);

describe('PasswordRecoveryGate', () => {
  afterEach(() => cleanup());

  it('infere o modo convite do callback capturado e mostra o primeiro acesso', () => {
    renderGate();

    expect(screen.getByRole('heading', { name: 'Criar senha de acesso' })).toBeDefined();
    expect(screen.getByText(/10 a 128 caracteres/i)).toBeDefined();
    expect(document.title).toBe('Ativar acesso | Arkhen Gestão Contábil');
  });

  it('permite que o modo explícito mantenha a recuperação convencional', () => {
    renderGate({ mode: 'recovery' });

    expect(screen.getByRole('heading', { name: 'Criar nova senha' })).toBeDefined();
    expect(screen.getByText(/pelo menos 6 caracteres/i)).toBeDefined();
  });

  it('confirma a ativação quando o convite é concluído', () => {
    renderGate({ status: 'complete' });

    expect(screen.getByRole('heading', { name: 'Acesso ativado' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toMatch(/primeiro acesso concluído/i);
    expect(screen.getByText('Sessão do convite encerrada')).toBeDefined();
  });
});
