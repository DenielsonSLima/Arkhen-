import { supabase } from '../../../../lib/supabase';
import { getCurrentEmpresaId } from './parametrizacaoSupabase';

export type CatalogoTipo =
  | 'tipos_empresa'
  | 'naturezas_juridicas'
  | 'tipos_parceiros'
  | 'categorias_clientes'
  | 'tipos_documentos';

export interface CatalogoItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}

export interface CatalogoDefaultItem {
  codigo: string;
  nome: string;
  descricao: string;
  sistema?: boolean;
  ativo?: boolean;
  ordem?: number;
}

export interface SaveCatalogoInput {
  id?: string | null;
  tipo: CatalogoTipo;
  nome: string;
  descricao: string;
  ativo: boolean;
  sistema?: boolean;
}

interface CatalogoRow {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  sistema: boolean | null;
  ativo: boolean | null;
  ordem: number | null;
}

const TABLE = 'parametrizacao_catalogos';

const slugify = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
);

const fromRow = (row: CatalogoRow): CatalogoItem => ({
  id: row.id,
  codigo: row.codigo,
  nome: row.nome,
  descricao: row.descricao || '',
  sistema: Boolean(row.sistema),
  ativo: row.ativo !== false,
  ordem: Number(row.ordem || 100),
});

const sortByName = (items: CatalogoItem[]) => (
  [...items].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
);

const ensureDefaults = async (tipo: CatalogoTipo, defaults: CatalogoDefaultItem[]) => {
  if (!defaults.length) return;

  const empresaId = await getCurrentEmpresaId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('codigo')
    .eq('empresa_id', empresaId)
    .eq('tipo', tipo);

  if (error) throw error;
  if ((data || []).length > 0) return;

  const { error: insertError } = await supabase.from(TABLE).upsert(
    defaults.map((item, index) => ({
      empresa_id: empresaId,
      tipo,
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao,
      sistema: item.sistema ?? true,
      ativo: item.ativo ?? true,
      ordem: item.ordem ?? (index + 1) * 10,
    })),
    { onConflict: 'empresa_id,tipo,codigo' }
  );

  if (insertError) throw insertError;
};

export const catalogosService = {
  async list(tipo: CatalogoTipo, defaults: CatalogoDefaultItem[] = []): Promise<CatalogoItem[]> {
    await ensureDefaults(tipo, defaults);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,codigo,nome,descricao,sistema,ativo,ordem')
      .eq('tipo', tipo)
      .order('nome', { ascending: true });

    if (error) throw error;
    return sortByName(((data || []) as CatalogoRow[]).map(fromRow));
  },

  async save(input: SaveCatalogoInput): Promise<void> {
    const nome = input.nome.trim();
    if (!nome) throw new Error('Informe o nome do parametro.');

    if (input.id) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          nome,
          descricao: input.descricao.trim(),
          ativo: input.ativo,
          sistema: input.sistema ?? false,
        })
        .eq('id', input.id);

      if (error) throw error;
      return;
    }

    const empresaId = await getCurrentEmpresaId();
    const codigo = slugify(nome) || `catalogo-${Date.now()}`;
    const { error } = await supabase.from(TABLE).insert({
      empresa_id: empresaId,
      tipo: input.tipo,
      codigo,
      nome,
      descricao: input.descricao.trim(),
      sistema: input.sistema ?? false,
      ativo: input.ativo,
      ordem: 100,
    });

    if (error) throw error;
  },

  async setAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ ativo }).eq('id', id);
    if (error) throw error;
  },
};
