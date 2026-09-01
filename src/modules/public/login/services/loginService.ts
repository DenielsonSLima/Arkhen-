import { supabase } from '../../../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { usuariosService, type Usuario } from '../../../gestor/configuracoes/usuarios/services/usuariosService';
import { passwordRecoveryService } from './passwordRecoveryService';
import {
  CpfLoginUnavailableError,
  parseLoginIdentifier,
  signInWithCpf,
} from './loginIdentifierService';
import { isValidCpf, normalizeCpf } from '../../../../lib/cpf';

export interface LoginPayload {
  usuario: string;
  senha?: string;
  role: 'funcionario' | 'gestor';
}

export interface SignupPayload {
  nome: string;
  empresaNome: string;
  cnpj: string;
  email: string;
  senha: string;
  cpf?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  needsConfirmation?: boolean;
  blockedByAccess?: boolean;
  user?: {
    id: string;
    nome: string;
    email: string;
    empresaId: string;
    role: 'funcionario' | 'gestor';
    cpf?: string;
    perfil?: string;
    authMethod?: 'email' | 'cpf';
  };
}

const getRedirectUrl = () => window.location.origin;

type OnboardingResult = {
  empresa_id?: string;
  nome?: string;
  email?: string;
  cpf?: string;
  perfil?: string;
  auth_method?: 'email' | 'cpf';
} | null;

interface AccountAuthorizationResult {
  allowed: boolean;
  message: string;
  onboarding: OnboardingResult;
  blockedByAccess?: boolean;
}

const onboardingRequests = new Map<string, Promise<OnboardingResult>>();

const buildOnboardingPayload = (payload?: Partial<SignupPayload>) => {
  const rpcPayload: Record<string, string> = {};
  const append = (key: string, value?: string) => {
    const normalized = value?.trim();
    if (normalized) rpcPayload[key] = normalized;
  };

  append('nome', payload?.nome);
  append('empresa_nome', payload?.empresaNome);
  append('cnpj', payload?.cnpj);
  append('email', payload?.email);
  append('cpf', payload?.cpf);
  append('telefone', payload?.telefone);
  append('cep', payload?.cep);
  append('endereco', payload?.endereco);
  append('cidade', payload?.cidade);
  append('estado', payload?.estado);

  return rpcPayload;
};

const toOnboardingResult = (usuario: Usuario): OnboardingResult => ({
  empresa_id: usuario.empresaId,
  nome: usuario.nome,
  email: usuario.email,
  cpf: usuario.cpf,
  perfil: usuario.perfil,
  auth_method: usuario.formaAcesso,
});

const authorizationErrorMessage = (error: unknown) => (
  error instanceof Error && error.message
    ? error.message
    : 'Não foi possível validar sua permissão de acesso.'
);

const authorizationFailure = (
  error: unknown,
  onboarding: OnboardingResult = null,
): AccountAuthorizationResult => ({
  allowed: false,
  message: authorizationErrorMessage(error),
  onboarding,
  blockedByAccess: Boolean(
    typeof error === 'object'
    && error !== null
    && 'blockedByPolicy' in error
    && error.blockedByPolicy === true
  ),
});

const isCpfEmployeeAccount = (user: User) => (
  user.app_metadata?.account_type === 'employee_cpf'
  || user.app_metadata?.login_method === 'cpf'
);

const completeOnboarding = (userId: string, payload?: Partial<SignupPayload>) => {
  const cacheKey = userId.trim();
  if (!cacheKey) {
    return Promise.reject(new Error('Não foi possível identificar o usuário autenticado.'));
  }

  const cachedRequest = onboardingRequests.get(cacheKey);
  if (cachedRequest) return cachedRequest;

  const request = (async (): Promise<OnboardingResult> => {
    const { data, error } = await supabase.rpc('finalizar_cadastro_auth', {
      p_payload: buildOnboardingPayload(payload),
    });

    if (error) {
      throw new Error(`Falha ao vincular empresa ao usuário: ${error.message}`);
    }

    return data as OnboardingResult;
  })();

  onboardingRequests.set(cacheKey, request);
  const clearRequest = () => {
    if (onboardingRequests.get(cacheKey) === request) {
      onboardingRequests.delete(cacheKey);
    }
  };
  void request.then(clearRequest, clearRequest);

  return request;
};

const authorizeAuthenticatedUser = async (
  user: User,
  payload?: Partial<SignupPayload>,
): Promise<AccountAuthorizationResult> => {
  let configuredUser: Usuario | null;
  try {
    configuredUser = await usuariosService.getUsuarioAtual();
  } catch (error) {
    return authorizationFailure(error);
  }
  if (configuredUser) {
    if (configuredUser.formaAcesso === 'email') {
      try {
        await completeOnboarding(user.id, payload);
        configuredUser = await usuariosService.getUsuarioAtual();
      } catch (error) {
        return authorizationFailure(error);
      }
      if (!configuredUser) {
        return {
          allowed: false,
          message: 'Seu usuário não possui uma configuração de acesso válida para esta empresa.',
          onboarding: null,
          blockedByAccess: true,
        };
      }
    }
    return { allowed: true, message: '', onboarding: toOnboardingResult(configuredUser) };
  }

  if (isCpfEmployeeAccount(user)) {
    return {
      allowed: false,
      message: 'Seu usuário não possui uma configuração de acesso válida para esta empresa.',
      onboarding: null,
      blockedByAccess: true,
    };
  }

  const onboarding = await completeOnboarding(user.id, payload);
  let usuarioConfig: Usuario | null;
  try {
    usuarioConfig = await usuariosService.getUsuarioAtual();
  } catch (error) {
    return authorizationFailure(error, onboarding);
  }
  if (!usuarioConfig) {
    return {
      allowed: false,
      message: 'Seu usuário não possui uma configuração de acesso válida para esta empresa.',
      onboarding,
      blockedByAccess: true,
    };
  }

  return { allowed: true, message: '', onboarding: toOnboardingResult(usuarioConfig) };
};

export const loginService = {
  async autenticar(payload: LoginPayload): Promise<LoginResponse> {
    if (!payload.usuario || !payload.senha) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    const identifier = parseLoginIdentifier(payload.usuario);
    if (!identifier) {
      return { success: false, message: 'E-mail/CPF ou senha inválidos.' };
    }

    let authenticatedUser: User;
    if (identifier.type === 'cpf') {
      try {
        authenticatedUser = await signInWithCpf(identifier.value, payload.senha);
      } catch (error) {
        if (error instanceof CpfLoginUnavailableError) {
          return { success: false, message: error.message };
        }
        return { success: false, message: 'E-mail/CPF ou senha inválidos.' };
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier.value,
        password: payload.senha,
      });
      if (error) {
        return { success: false, message: 'E-mail/CPF ou senha inválidos.' };
      }
      authenticatedUser = data.user;
    }

    const authorization = await authorizeAuthenticatedUser(authenticatedUser);
    if (!authorization.allowed) {
      await supabase.auth.signOut();
      return {
        success: false,
        blockedByAccess: authorization.blockedByAccess,
        message: authorization.message,
      };
    }

    return {
      success: true,
      message: 'Login realizado com sucesso!',
      user: {
        id: authenticatedUser.id,
        nome: authorization.onboarding?.nome || authenticatedUser.user_metadata?.nome || authenticatedUser.email?.split('@')[0] || 'Usuário',
        email: identifier.type === 'cpf' ? '' : authenticatedUser.email || identifier.value,
        empresaId: authorization.onboarding?.empresa_id || '',
        role: identifier.type === 'cpf' ? 'funcionario' : payload.role,
        cpf: authorization.onboarding?.cpf || '',
        perfil: authorization.onboarding?.perfil,
        authMethod: identifier.type,
      },
    };
  },

  async cadastrar(payload: SignupPayload): Promise<LoginResponse> {
    if (!payload.nome.trim() || !payload.empresaNome.trim() || !payload.email.trim() || !payload.senha) {
      return { success: false, message: 'Preencha nome, empresa, e-mail e senha.' };
    }

    const normalizedName = payload.nome.trim().replace(/\s+/g, ' ');
    const phoneDigits = (payload.telefone || '').replace(/\D/g, '');
    if (
      normalizedName.length < 2
      || normalizedName.length > 150
      || !/\p{L}/u.test(normalizedName)
      || /[\p{Cc}<>]/u.test(normalizedName)
    ) {
      return { success: false, message: 'Informe um nome válido com até 150 caracteres.' };
    }
    if (!isValidCpf(payload.cpf || '')) {
      return { success: false, message: 'Informe um CPF válido.' };
    }
    if (![10, 11].includes(phoneDigits.length)) {
      return { success: false, message: 'Informe um telefone válido com 10 ou 11 dígitos.' };
    }

    if (payload.senha.length < 6) {
      return { success: false, message: 'A senha deve conter pelo menos 6 caracteres.' };
    }

    const hasLetter = /[a-zA-Z]/.test(payload.senha);
    const hasNumber = /[0-9]/.test(payload.senha);
    if (!hasLetter || !hasNumber) {
      return { success: false, message: 'A senha deve conter letras e números.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.senha,
      options: {
        emailRedirectTo: getRedirectUrl(),
        data: {
          nome: normalizedName,
          empresa_nome: payload.empresaNome.trim(),
          cnpj: payload.cnpj.trim(),
          cpf: normalizeCpf(payload.cpf || ''),
          telefone: phoneDigits,
          cep: payload.cep?.trim() || '',
          endereco: payload.endereco?.trim() || '',
          cidade: payload.cidade?.trim() || '',
          estado: payload.estado?.trim() || '',
        },
      },
    });

    if (error) {
      return { success: false, message: error.message || 'Não foi possível criar o cadastro.' };
    }

    if (data.session) {
      if (!data.user?.id) {
        return { success: false, message: 'Cadastro criado, mas o usuário autenticado não foi identificado.' };
      }

      const authorization = await authorizeAuthenticatedUser(data.user, payload);
      if (!authorization.allowed) {
        await supabase.auth.signOut();
        return {
          success: false,
          blockedByAccess: authorization.blockedByAccess,
          message: authorization.message,
        };
      }
      return {
        success: true,
        message: 'Cadastro criado e sessão iniciada.',
        user: {
          id: data.user?.id || '',
          nome: normalizedName,
          email: data.user?.email || payload.email,
          empresaId: authorization.onboarding?.empresa_id || '',
          role: 'gestor',
          cpf: authorization.onboarding?.cpf || payload.cpf || '',
          perfil: authorization.onboarding?.perfil || 'Gestor',
          authMethod: 'email',
        },
      };
    }

    return {
      success: true,
      needsConfirmation: true,
      message: 'Cadastro criado. Confirme seu e-mail antes de entrar.',
    };
  },

  async recuperarSenha(email: string): Promise<void> {
    await passwordRecoveryService.sendRecoveryEmail(email);
  },

  async loginGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (error) {
      throw new Error(error.message || 'Erro ao iniciar login com Google.');
    }
  },

  completeOnboarding,
  authorizeAuthenticatedUser,
};
