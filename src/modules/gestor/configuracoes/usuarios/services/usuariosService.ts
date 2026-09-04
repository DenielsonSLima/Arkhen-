import { supabase } from '../../../../../lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type UsuarioStatus = 'Ativo' | 'Inativo' | 'Pendente';
export type UsuarioAuthMethod = 'email' | 'cpf';

export class UsuarioAccessContextError extends Error {
  readonly blockedByPolicy: boolean;

  constructor(
    message: string,
    blockedByPolicy: boolean,
  ) {
    super(message);
    this.name = 'UsuarioAccessContextError';
    this.blockedByPolicy = blockedByPolicy;
  }
}

export interface UsuarioAccessInterval {
  start: string;
  end: string;
}

export interface UsuarioAccessConfig {
  enabled: boolean;
  days: number[];
  intervals: UsuarioAccessInterval[];
  message: string;
}

export interface Usuario {
  id: string;
  authUserId?: string | null;
  empresaId?: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  formaAcesso: UsuarioAuthMethod;
  perfilId?: string | null;
  perfil: string;
  status: UsuarioStatus;
  accessConfig: UsuarioAccessConfig;
  mustChangePassword: boolean;
  ultimoAcessoEm?: string | null;
  createdAt: string;
}

export interface SaveUsuarioInput {
  id?: string | null;
  nome: string;
  formaAcesso: UsuarioAuthMethod;
  email: string;
  cpf: string;
  telefone: string;
  senha?: string;
  confirmacaoSenha?: string;
  perfilId?: string;
  perfil: string;
  status: UsuarioStatus;
  accessConfig: UsuarioAccessConfig;
}

export type UsuarioProvisioningDelivery =
  | { type: 'email_invite'; email: string }
  | { type: 'temporary_password'; temporaryPassword: string };

export interface SaveUsuarioResult {
  usuario: Usuario;
  delivery?: UsuarioProvisioningDelivery;
}

interface UsuarioRow {
  id: string;
  auth_user_id: string | null;
  empresa_id?: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  login_method?: UsuarioAuthMethod | null;
  perfil_acesso_id?: string | null;
  perfil: string;
  status: UsuarioStatus;
  access_config: UsuarioAccessConfig | null;
  must_change_password?: boolean | null;
  ultimo_acesso_em: string | null;
  created_at: string;
}

interface ManageEmployeeUserResponse {
  ok?: boolean;
  usuario?: UsuarioRow;
  error?: string;
  message?: string;
  temporary_password?: string;
  invite_sent?: boolean;
}

const USER_SELECT = [
  'id',
  'auth_user_id',
  'empresa_id',
  'nome',
  'email',
  'cpf',
  'telefone',
  'login_method',
  'perfil_acesso_id',
  'perfil',
  'status',
  'access_config',
  'must_change_password',
  'ultimo_acesso_em',
  'created_at',
].join(',');

const defaultAccessConfig: UsuarioAccessConfig = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  intervals: [{ start: '08:00', end: '18:00' }],
  message: 'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.',
};

const normalizeAccessConfig = (config?: Partial<UsuarioAccessConfig> | null): UsuarioAccessConfig => ({
  enabled: Boolean(config?.enabled),
  days: Array.isArray(config?.days) && config.days.length > 0 ? config.days.map(Number) : defaultAccessConfig.days,
  intervals: Array.isArray(config?.intervals) && config.intervals.length > 0
    ? config.intervals.map((item) => ({
        start: item.start || '08:00',
        end: item.end || '18:00',
      }))
    : defaultAccessConfig.intervals,
  message: config?.message || defaultAccessConfig.message,
});

const fromRow = (row: UsuarioRow): Usuario => ({
  id: row.id,
  authUserId: row.auth_user_id,
  empresaId: row.empresa_id,
  nome: row.nome,
  email: row.email || '',
  cpf: row.cpf || '',
  telefone: row.telefone || '',
  formaAcesso: row.login_method === 'cpf' ? 'cpf' : 'email',
  perfilId: row.perfil_acesso_id,
  perfil: row.perfil,
  status: row.status,
  accessConfig: normalizeAccessConfig(row.access_config),
  mustChangePassword: Boolean(row.must_change_password),
  ultimoAcessoEm: row.ultimo_acesso_em,
  createdAt: row.created_at,
});

const invokeEmployeeUser = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke<ManageEmployeeUserResponse>(
    'manage-employee-user',
    { body },
  );

  if (error || !data?.ok) {
    let responseMessage: string | undefined;
    if (error instanceof FunctionsHttpError) {
      try {
        const errorBody = await error.context.clone().json() as ManageEmployeeUserResponse;
        responseMessage = errorBody.error || errorBody.message;
      } catch {
        responseMessage = undefined;
      }
    }
    throw new Error(
      data?.error
      || data?.message
      || responseMessage
      || error?.message
      || 'Não foi possível concluir a operação do funcionário.',
    );
  }
  return data;
};

export const usuariosService = {
  async getUsuarios(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('configuracoes_usuarios')
      .select(USER_SELECT)
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao carregar usuários: ${error.message}`);
    return ((data || []) as unknown as UsuarioRow[]).map(fromRow);
  },

  async saveUsuario(input: SaveUsuarioInput): Promise<SaveUsuarioResult> {
    if (!input.id && input.formaAcesso === 'cpf') {
      if (!input.perfilId) {
        throw new Error('O perfil é obrigatório para criar o acesso por CPF.');
      }

      const response = await invokeEmployeeUser({
        action: 'create',
        nome: input.nome.trim(),
        cpf: input.cpf,
        perfil_id: input.perfilId,
        email: null,
        telefone: input.telefone.trim() || null,
        access_config: normalizeAccessConfig(input.accessConfig),
      });
      if (!response.usuario) throw new Error('O funcionário foi processado sem retornar o cadastro criado.');
      if (!response.temporary_password) {
        throw new Error('O funcionário foi criado, mas a senha temporária não foi retornada.');
      }
      return {
        usuario: fromRow(response.usuario),
        delivery: {
          type: 'temporary_password',
          temporaryPassword: response.temporary_password,
        },
      };
    }

    if (!input.id && input.formaAcesso === 'email') {
      if (!input.perfilId) {
        throw new Error('O perfil é obrigatório para enviar o convite.');
      }
      const normalizedEmail = input.email.trim().toLowerCase();
      const response = await invokeEmployeeUser({
        action: 'invite_email',
        nome: input.nome.trim(),
        email: normalizedEmail,
        cpf: input.cpf,
        telefone: input.telefone.trim() || null,
        perfil_id: input.perfilId,
        access_config: normalizeAccessConfig(input.accessConfig),
      });
      if (!response.usuario || response.invite_sent !== true) {
        throw new Error('O usuário foi processado sem confirmar o envio do convite.');
      }
      return {
        usuario: fromRow(response.usuario),
        delivery: { type: 'email_invite', email: normalizedEmail },
      };
    }

    const { data: empresaId, error: empresaError } = await supabase.rpc('current_empresa_id');
    if (empresaError || !empresaId) throw new Error('Empresa atual não encontrada para salvar usuário.');

    const payload = {
      empresa_id: String(empresaId),
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase() || null,
      cpf: input.cpf.trim() || null,
      telefone: input.telefone.trim() || null,
      perfil_acesso_id: input.perfilId || null,
      perfil: input.perfil,
      status: input.status,
      access_config: normalizeAccessConfig(input.accessConfig),
      ...(!input.id ? { login_method: 'email' as const } : {}),
    };

    const request = input.id
      ? supabase
          .from('configuracoes_usuarios')
          .update(payload)
          .eq('id', input.id)
          .select(USER_SELECT)
          .single()
      : supabase
          .from('configuracoes_usuarios')
          .insert(payload)
          .select(USER_SELECT)
          .single();

    const { data, error } = await request;
    if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);
    return { usuario: fromRow(data as unknown as UsuarioRow) };
  },

  async inativarUsuario(id: string): Promise<void> {
    const { error } = await supabase
      .from('configuracoes_usuarios')
      .update({ status: 'Inativo' })
      .eq('id', id);

    if (error) throw new Error(`Erro ao inativar usuário: ${error.message}`);
  },

  async excluirUsuario(usuario: Usuario): Promise<void> {
    if (usuario.authUserId) {
      throw new Error('Este usuário possui uma conta de acesso. Use Inativar para preservar o vínculo e o histórico.');
    }

    const { error } = await supabase
      .from('configuracoes_usuarios')
      .delete()
      .eq('id', usuario.id);

    if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);
  },

  async getUsuarioAtual(): Promise<Usuario | null> {
    const { data, error } = await supabase.rpc('obter_contexto_usuario_atual');
    if (error) {
      const blockedByPolicy = error.code === '42501' || error.code === '28000';
      throw new UsuarioAccessContextError(
        blockedByPolicy
          ? error.message || 'Seu acesso não está disponível. Entre em contato com o gestor.'
          : 'O serviço de acesso está temporariamente indisponível. Tente novamente em instantes.',
        blockedByPolicy,
      );
    }
    if (!data) return null;

    const row = (Array.isArray(data) ? data[0] : data) as UsuarioRow | undefined;
    return row?.id ? fromRow(row) : null;
  },

  async redefinirSenhaFuncionario(usuarioId: string, password: string): Promise<void> {
    await invokeEmployeeUser({
      action: 'reset_password',
      usuario_id: usuarioId,
      password,
    });
  },
};
