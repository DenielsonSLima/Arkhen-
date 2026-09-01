import { isValidCpf, normalizeCpf } from '../../../../lib/cpf';
import { supabase } from '../../../../lib/supabase';
import type { User } from '@supabase/supabase-js';

export type LoginIdentifier =
  | { type: 'email'; value: string }
  | { type: 'cpf'; value: string };

interface CpfLoginResponse {
  ok?: boolean;
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

export class CpfLoginUnavailableError extends Error {
  constructor() {
    super('O serviço de login por CPF está temporariamente indisponível. Tente novamente em instantes.');
    this.name = 'CpfLoginUnavailableError';
  }
}

const getFunctionErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (typeof context !== 'object' || context === null || !('status' in context)) return null;
  const status = (context as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
};

export const parseLoginIdentifier = (rawValue: string): LoginIdentifier | null => {
  const value = rawValue.trim();
  if (value.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { type: 'email', value: value.toLowerCase() }
      : null;
  }

  return isValidCpf(value) ? { type: 'cpf', value: normalizeCpf(value) } : null;
};

export const signInWithCpf = async (cpf: string, password: string): Promise<User> => {
  const { data, error } = await supabase.functions.invoke<CpfLoginResponse>(
    'manage-employee-user',
    { body: { action: 'login', cpf: normalizeCpf(cpf), password } },
  );

  if (error || !data?.ok || !data.access_token || !data.refresh_token) {
    const status = getFunctionErrorStatus(error);
    if (error && (status === null || status >= 500)) {
      throw new CpfLoginUnavailableError();
    }
    throw new Error('E-mail/CPF ou senha inválidos.');
  }

  const sessionResult = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionResult.error || !sessionResult.data.user) {
    throw new CpfLoginUnavailableError();
  }

  return sessionResult.data.user;
};
