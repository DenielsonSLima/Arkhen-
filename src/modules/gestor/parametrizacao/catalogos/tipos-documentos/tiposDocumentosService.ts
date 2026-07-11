import { supabase } from '../../../../../lib/supabase';

export interface TipoDocumento {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}

interface TipoDocumentoRow {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  sistema: boolean | null;
  ativo: boolean | null;
  ordem: number | null;
}

export interface SaveTipoDocumentoInput {
  id?: string | null;
  nome: string;
  descricao: string;
  ativo: boolean;
}

const TABLE = 'parametrizacao_tipos_documentos';

const DEFAULT_TIPOS = [
  {
    codigo: 'cnh',
    nome: 'CNH',
    descricao: 'Carteira Nacional de Habilitacao para cadastros, validacoes e documentos pessoais.',
    ordem: 10,
  },
  {
    codigo: 'contrato',
    nome: 'Contrato',
    descricao: 'Contratos sociais, contratos de prestacao de servicos e instrumentos contratuais vinculados ao cliente.',
    ordem: 20,
  },
  {
    codigo: 'financiamento',
    nome: 'Financiamento',
    descricao: 'Documentos de financiamento, credito, parcelas, comprovantes e contratos bancarios relacionados.',
    ordem: 30,
  },
  {
    codigo: 'procuracao',
    nome: 'Procuração',
    descricao: 'Procurações eletronicas, fisicas e autorizacoes de representacao do cliente.',
    ordem: 40,
  },
];

const fromRow = (row: TipoDocumentoRow): TipoDocumento => ({
  id: row.id,
  codigo: row.codigo,
  nome: row.nome,
  descricao: row.descricao || '',
  sistema: Boolean(row.sistema),
  ativo: row.ativo !== false,
  ordem: Number(row.ordem || 100),
});

const sortTipos = (items: TipoDocumento[]) => (
  [...items].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
);

const slugify = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
);

const getEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada.');
  return data as string;
};

const ensureDefaultTipos = async () => {
  const empresaId = await getEmpresaId();
  const codigos = DEFAULT_TIPOS.map((item) => item.codigo);
  const { data, error } = await supabase
    .from(TABLE)
    .select('codigo')
    .eq('empresa_id', empresaId)
    .in('codigo', codigos);

  if (error) throw error;

  const existing = new Set((data || []).map((item) => item.codigo));
  const missing = DEFAULT_TIPOS.filter((item) => !existing.has(item.codigo));
  if (!missing.length) return;

  const { error: insertError } = await supabase.from(TABLE).upsert(
    missing.map((item) => ({
      empresa_id: empresaId,
      ...item,
      sistema: true,
      ativo: true,
    })),
    { onConflict: 'empresa_id,codigo' }
  );

  if (insertError) throw insertError;
};

export const tiposDocumentosService = {
  async list(): Promise<TipoDocumento[]> {
    await ensureDefaultTipos();

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,codigo,nome,descricao,sistema,ativo,ordem')
      .order('nome', { ascending: true });

    if (error) throw error;
    return sortTipos(((data || []) as TipoDocumentoRow[]).map(fromRow));
  },

  async save(input: SaveTipoDocumentoInput): Promise<void> {
    const nome = input.nome.trim();
    if (!nome) throw new Error('Informe o nome do tipo de documento.');

    if (input.id) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          nome,
          descricao: input.descricao.trim(),
          ativo: input.ativo,
        })
        .eq('id', input.id);

      if (error) throw error;
      return;
    }

    const empresaId = await getEmpresaId();
    const codigo = slugify(nome) || `tipo-${Date.now()}`;
    const { error } = await supabase.from(TABLE).insert({
      empresa_id: empresaId,
      codigo,
      nome,
      descricao: input.descricao.trim(),
      sistema: false,
      ativo: input.ativo,
      ordem: 100,
    });

    if (error) throw error;
  },

  async setAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  },
};
