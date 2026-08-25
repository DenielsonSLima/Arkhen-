import { supabase } from '../../../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { usuariosService, type UsuarioAccessConfig } from '../../../gestor/configuracoes/usuarios/services/usuariosService';
import { passwordRecoveryService } from './passwordRecoveryService';

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
  };
}

const getRedirectUrl = () => window.location.origin;

type OnboardingResult = { empresa_id?: string; nome?: string; email?: string } | null;

interface AccountAuthorizationResult {
  allowed: boolean;
  message: string;
  onboarding: OnboardingResult;
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

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const validateAccessWindow = (config: UsuarioAccessConfig) => {
  if (!config.enabled) return { allowed: true, message: '' };

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayAllowed = config.days.includes(currentDay);
  const timeAllowed = config.intervals.some((interval) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    return currentMinutes >= start && currentMinutes <= end;
  });

  if (dayAllowed && timeAllowed) return { allowed: true, message: '' };
  return {
    allowed: false,
    message: config.message || 'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.',
  };
};

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
  const onboarding = await completeOnboarding(user.id, payload);
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return { allowed: false, message: 'E-mail do usuário autenticado não encontrado.', onboarding };
  }

  const usuarioConfig = await usuariosService.vincularAuthUserPorEmail(email, user.id);
  if (!usuarioConfig) {
    return {
      allowed: false,
      message: 'Seu usuário não possui uma configuração de acesso válida para esta empresa.',
      onboarding,
    };
  }

  if (usuarioConfig.status === 'Inativo') {
    return {
      allowed: false,
      message: 'Seu usuário está inativo. Entre em contato com o gestor para reativar o acesso.',
      onboarding,
    };
  }

  const access = validateAccessWindow(usuarioConfig.accessConfig);
  if (!access.allowed) {
    return { allowed: false, message: access.message, onboarding };
  }

  return { allowed: true, message: '', onboarding };
};

export const loginService = {
  async autenticar(payload: LoginPayload): Promise<LoginResponse> {
    if (!payload.usuario || !payload.senha) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.usuario,
      password: payload.senha,
    });

    if (error) {
      return { success: false, message: error.message || 'Não foi possível autenticar.' };
    }

    const authorization = await authorizeAuthenticatedUser(data.user);
    if (!authorization.allowed) {
      await supabase.auth.signOut();
      return { success: false, blockedByAccess: true, message: authorization.message };
    }

    return {
      success: true,
      message: 'Login realizado com sucesso!',
      user: {
        id: data.user.id,
        nome: authorization.onboarding?.nome || data.user.user_metadata?.nome || data.user.email?.split('@')[0] || 'Usuário',
        email: data.user.email || payload.usuario,
        empresaId: authorization.onboarding?.empresa_id || '',
        role: payload.role,
      },
    };
  },

  async cadastrar(payload: SignupPayload): Promise<LoginResponse> {
    if (!payload.nome.trim() || !payload.empresaNome.trim() || !payload.email.trim() || !payload.senha) {
      return { success: false, message: 'Preencha nome, empresa, e-mail e senha.' };
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
          nome: payload.nome.trim(),
          empresa_nome: payload.empresaNome.trim(),
          cnpj: payload.cnpj.trim(),
          cpf: payload.cpf?.trim() || '',
          telefone: payload.telefone?.trim() || '',
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
        return { success: false, blockedByAccess: true, message: authorization.message };
      }
      return {
        success: true,
        message: 'Cadastro criado e sessão iniciada.',
        user: {
          id: data.user?.id || '',
          nome: payload.nome,
          email: data.user?.email || payload.email,
          empresaId: authorization.onboarding?.empresa_id || '',
          role: 'gestor',
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
