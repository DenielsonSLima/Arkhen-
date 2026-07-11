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

export const usuariosService = {
  async getUsuarios(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('configuracoes_usuarios')
      .select('id,auth_user_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at')
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao carregar usuários: ${error.message}`);
    return ((data || []) as UsuarioRow[]).map(fromRow);
  },

  async saveUsuario(input: SaveUsuarioInput): Promise<Usuario> {
    const { data: empresaId, error: empresaError } = await supabase.rpc('current_empresa_id');
    if (empresaError || !empresaId) throw new Error('Empresa atual não encontrada para salvar usuário.');

    const payload = {
      empresa_id: String(empresaId),
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      cpf: input.cpf.trim() || null,
      telefone: input.telefone.trim() || null,
      perfil: input.perfil,
      status: input.status,
      access_config: normalizeAccessConfig(input.accessConfig),
    };

    const request = input.id
      ? supabase
          .from('configuracoes_usuarios')
          .update(payload)
          .eq('id', input.id)
          .select('id,auth_user_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at')
          .single()
      : supabase
          .from('configuracoes_usuarios')
          .insert(payload)
          .select('id,auth_user_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at')
          .single();

    const { data, error } = await request;
    if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);
    return fromRow(data as UsuarioRow);
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
      const { count, error: logsError } = await supabase
        .from('configuracoes_eventos_logs')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuario.authUserId);

      if (logsError) throw new Error(`Erro ao validar histórico do usuário: ${logsError.message}`);
      if ((count || 0) > 0) {
        throw new Error('Este usuário já possui histórico no sistema. Use Inativar em vez de excluir.');
      }
    }

    const { error } = await supabase
      .from('configuracoes_usuarios')
      .delete()
      .eq('id', usuario.id);

    if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);
  },

  async vincularAuthUserPorEmail(email: string, authUserId: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('configuracoes_usuarios')
      .update({ auth_user_id: authUserId, ultimo_acesso_em: new Date().toISOString() })
      .eq('email', email.trim().toLowerCase())
      .select('id,auth_user_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at')
      .maybeSingle();

    if (error) throw new Error(`Erro ao vincular usuário: ${error.message}`);
    return data ? fromRow(data as UsuarioRow) : null;
  },
};
