import { supabase } from '../../../../../lib/supabase';

export type UsuarioStatus = 'Ativo' | 'Inativo' | 'Pendente';

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
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  perfil: string;
  status: UsuarioStatus;
  accessConfig: UsuarioAccessConfig;
  ultimoAcessoEm?: string | null;
  createdAt: string;
}

export interface SaveUsuarioInput {
  id?: string | null;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  perfil: string;
  status: UsuarioStatus;
  accessConfig: UsuarioAccessConfig;
}

interface UsuarioRow {
  id: string;
  auth_user_id: string | null;
  perfil_id: string | null;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  perfil: string;
  status: UsuarioStatus;
  access_config: UsuarioAccessConfig | null;
  ultimo_acesso_em: string | null;
  created_at: string;
}

const USER_COLUMNS = 'id,auth_user_id,perfil_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at';

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
  nome: row.nome,
  email: row.email,
  cpf: row.cpf || '',
  telefone: row.telefone || '',
  perfil: row.perfil,
  status: row.status,
  accessConfig: normalizeAccessConfig(row.access_config),
  ultimoAcessoEm: row.ultimo_acesso_em,
  createdAt: row.created_at,
});

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) throw new Error('Empresa atual não encontrada para gerenciar usuários.');
  return String(data);
};

const getUsuarioRow = async (empresaId: string, id: string): Promise<UsuarioRow> => {
  const { data, error } = await supabase
    .from('configuracoes_usuarios')
    .select(USER_COLUMNS)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('Usuário não encontrado nesta empresa.');
  return data as UsuarioRow;
};

const assertNotCurrentUser = async (row: UsuarioRow, operation: string) => {
  if (!row.auth_user_id) return;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error('Não foi possível validar a sessão atual.');
  if (data.user?.id === row.auth_user_id) {
    throw new Error(`Você não pode ${operation} o próprio acesso.`);
  }
};

const saveExistingUsuario = async (input: SaveUsuarioInput): Promise<Usuario> => {
  if (!input.id) throw new Error('Usuário inválido para atualização.');
  const { data, error } = await supabase.rpc('salvar_usuario_configurado', {
    p_usuario_id: input.id,
    p_payload: {
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      cpf: input.cpf.trim(),
      telefone: input.telefone.trim(),
      perfil: input.perfil.trim(),
      status: input.status,
      accessConfig: normalizeAccessConfig(input.accessConfig),
    },
  });
  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível salvar o usuário.');
  }
  return fromRow(data as UsuarioRow);
};

const inactivateExistingUsuario = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('salvar_usuario_configurado', {
    p_usuario_id: id,
    p_payload: { status: 'Inativo' },
  });
  if (error) throw new Error(error.message || 'Não foi possível inativar o usuário.');
};

export const usuariosService = {
  async getUsuarios(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('configuracoes_usuarios')
      .select(USER_COLUMNS)
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao carregar usuários: ${error.message}`);
    return ((data || []) as UsuarioRow[]).map(fromRow);
  },

  async saveUsuario(input: SaveUsuarioInput): Promise<Usuario> {
    if (!input.id) {
      const { data, error } = await supabase.functions.invoke('invite-accounting-user', {
        body: {
          nome: input.nome,
          email: input.email,
          cpf: input.cpf,
          telefone: input.telefone,
          perfil: input.perfil,
          accessConfig: input.accessConfig,
        },
      });
      const response = data as { ok?: boolean; error?: string; usuario?: UsuarioRow } | null;
      if (error || !response?.ok || !response.usuario) {
        throw new Error(response?.error || error?.message || 'Não foi possível enviar o convite.');
      }
      return fromRow(response.usuario);
    }

    return saveExistingUsuario(input);
  },

  async inativarUsuario(id: string): Promise<void> {
    await inactivateExistingUsuario(id);
  },

  async excluirUsuario(usuario: Usuario): Promise<void> {
    const empresaId = await getCurrentEmpresaId();
    const current = await getUsuarioRow(empresaId, usuario.id);
    await assertNotCurrentUser(current, 'excluir');

    if (current.auth_user_id) {
      throw new Error(
        'Esta conta já está vinculada ao login. Use Inativar para preservar o acesso e o histórico com segurança.',
      );
    }

    const { error } = await supabase
      .from('configuracoes_usuarios')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', usuario.id);

    if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);
  },

  async vincularAuthUserPorEmail(email: string, authUserId: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('configuracoes_usuarios')
      .select(USER_COLUMNS)
      .eq('auth_user_id', authUserId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw new Error(`Erro ao vincular usuário: ${error.message}`);
    return data ? fromRow(data as UsuarioRow) : null;
  },
};
