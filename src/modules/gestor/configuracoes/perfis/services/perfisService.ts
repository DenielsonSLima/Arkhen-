import { supabase } from '../../../../../lib/supabase';

export type PerfilAcessoTipo = 'Sistema' | 'Personalizado';

export interface PerfilAcesso {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string;
  tipo: PerfilAcessoTipo;
  sistema: boolean;
  permissoes: string[];
  usuariosCount: number;
  dataCriacao: string;
  ordem: number;
}

interface PerfilAcessoRow {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string;
  tipo: PerfilAcessoTipo;
  sistema: boolean;
  permissoes: string[] | null;
  usuarios_count: number;
  data_criacao: string;
  ordem: number;
}

export interface SavePerfilAcessoInput {
  id?: string | null;
  nome: string;
  descricao: string;
  permissoes: string[];
}

const fromRow = (row: PerfilAcessoRow): PerfilAcesso => ({
  id: row.id,
  codigo: row.codigo,
  nome: row.nome,
  descricao: row.descricao,
  tipo: row.tipo,
  sistema: row.sistema,
  permissoes: row.permissoes || [],
  usuariosCount: Number(row.usuarios_count || 0),
  dataCriacao: row.data_criacao,
  ordem: Number(row.ordem || 100),
});

export const perfisService = {
  async listPerfis(): Promise<PerfilAcesso[]> {
    const { data, error } = await supabase.rpc('listar_configuracoes_perfis_acesso');

    if (error) throw error;
    return ((data || []) as PerfilAcessoRow[]).map(fromRow);
  },

  async savePerfil(input: SavePerfilAcessoInput): Promise<void> {
    const { error } = await supabase.rpc('upsert_configuracoes_perfil_acesso', {
      p_id: input.id || null,
      p_nome: input.nome,
      p_descricao: input.descricao,
      p_permissoes: input.permissoes,
    });

    if (error) throw error;
  },

  async deletePerfil(id: string): Promise<void> {
    const { data, error } = await supabase.rpc('desativar_configuracoes_perfil_acesso', {
      p_id: id,
    });

    if (error) throw error;
    if (!data) throw new Error('Perfil nao encontrado para inativacao.');
  },
};
