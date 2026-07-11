import { supabase } from '../../../../lib/supabase';
import { usuariosService, type UsuarioAccessConfig } from '../../../gestor/configuracoes/usuarios/services/usuariosService';

export const DEMO_AUTH = {
  nome: 'João Silva Demonstração',
  empresaNome: 'Empresa Fictícia Contábil',
  cnpj: '12.345.678/0001-90',
  email: 'demo@arkhen.com.br',
  senha: 'Demo@123456',
};

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
  logoUrl?: string;
  watermarkPaisagemUrl?: string;
  watermarkRetratoUrl?: string;
  cpf?: string;
  telefone?: string;
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

const completeOnboarding = async (payload?: Partial<SignupPayload>) => {
  const { data, error } = await supabase.rpc('finalizar_cadastro_auth', {
    p_payload: {
      nome: payload?.nome || DEMO_AUTH.nome,
      empresa_nome: payload?.empresaNome || DEMO_AUTH.empresaNome,
      cnpj: payload?.cnpj || DEMO_AUTH.cnpj,
      email: payload?.email || DEMO_AUTH.email,
      logo_url: payload?.logoUrl || '',
      file_url_paisagem: payload?.watermarkPaisagemUrl || '',
      file_url_retrato: payload?.watermarkRetratoUrl || '',
      cpf: payload?.cpf || '',
      telefone: payload?.telefone || '',
    },
  });

  if (error) {
    throw new Error(`Falha ao vincular empresa ao usuário: ${error.message}`);
  }

  return data as { empresa_id?: string; nome?: string; email?: string } | null;
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

    const onboarding = await completeOnboarding({ email: payload.usuario });
    const usuarioConfig = await usuariosService.vincularAuthUserPorEmail(data.user.email || payload.usuario, data.user.id);

    if (usuarioConfig?.status === 'Inativo') {
      await supabase.auth.signOut();
      return {
        success: false,
        blockedByAccess: true,
        message: 'Seu usuário está inativo. Entre em contato com o gestor para reativar o acesso.',
      };
    }

    if (usuarioConfig) {
      const access = validateAccessWindow(usuarioConfig.accessConfig);
      if (!access.allowed) {
        await supabase.auth.signOut();
        return { success: false, blockedByAccess: true, message: access.message };
      }
    }

    return {
      success: true,
      message: 'Login realizado com sucesso!',
      user: {
        id: data.user.id,
        nome: onboarding?.nome || data.user.user_metadata?.nome || DEMO_AUTH.nome,
        email: data.user.email || payload.usuario,
        empresaId: onboarding?.empresa_id || '',
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
        },
      },
    });

    if (error) {
      return { success: false, message: error.message || 'Não foi possível criar o cadastro.' };
    }

    if (data.session) {
      const onboarding = await completeOnboarding(payload);
      return {
        success: true,
        message: 'Cadastro criado e sessão iniciada.',
        user: {
          id: data.user?.id || '',
          nome: payload.nome,
          email: data.user?.email || payload.email,
          empresaId: onboarding?.empresa_id || '',
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl(),
    });

    if (error) {
      throw new Error(error.message || 'Erro ao enviar recuperação de senha.');
    }
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
};
