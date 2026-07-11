import { supabase } from '../../../../../lib/supabase';

export interface PastaPadraoDocumento {
  id: string;
  codigo: string;
  caminho: string;
  descricao: string;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}

export interface SavePastaPadraoInput {
  id?: string | null;
  caminho: string;
  descricao: string;
  ativo: boolean;
}

interface PastaPadraoRow {
  id: string;
  codigo: string;
  caminho: string;
  descricao: string | null;
  sistema: boolean | null;
  ativo: boolean | null;
  ordem: number | null;
}

const TABLE = 'parametrizacao_pastas_documentos';

export const DEFAULT_PASTAS_DOCUMENTOS = [
  {
    codigo: 'societario',
    caminho: 'Societario',
    descricao: 'Atos constitutivos, alteracoes contratuais, atas e registros societarios.',
    ordem: 10,
  },
  {
    codigo: 'societario-documentos-socios',
    caminho: 'Societario/Documentos dos Socios',
    descricao: 'RG, CPF, comprovantes, documentos pessoais e informacoes dos socios.',
    ordem: 20,
  },
  {
    codigo: 'societario-contrato-social',
    caminho: 'Societario/Contrato Social e Alteracoes',
    descricao: 'Contrato social, requerimento de empresario, alteracoes e consolidacoes.',
    ordem: 30,
  },
  {
    codigo: 'fiscal',
    caminho: 'Fiscal',
    descricao: 'Documentos fiscais, notas, apuracoes, guias e comprovantes tributarios.',
    ordem: 40,
  },
  {
    codigo: 'fiscal-notas-fiscais',
    caminho: 'Fiscal/Notas Fiscais',
    descricao: 'XML, DANFE, notas de servico e demais documentos fiscais emitidos ou recebidos.',
    ordem: 50,
  },
  {
    codigo: 'fiscal-guias-comprovantes',
    caminho: 'Fiscal/Guias e Comprovantes',
    descricao: 'DAS, DARF, DAE, GPS, DCTFWeb e comprovantes de pagamento.',
    ordem: 60,
  },
  {
    codigo: 'contabil',
    caminho: 'Contabil',
    descricao: 'Balancetes, demonstracoes, livros contabeis, ECD, ECF e documentos de fechamento.',
    ordem: 70,
  },
  {
    codigo: 'financeiro',
    caminho: 'Financeiro',
    descricao: 'Extratos, contas bancarias, comprovantes e documentos financeiros do cliente.',
    ordem: 75,
  },
  {
    codigo: 'financeiro-contas-bancarias',
    caminho: 'Financeiro/Contas Bancarias',
    descricao: 'Dados bancarios, comprovantes de abertura de conta, extratos e conciliacoes.',
    ordem: 80,
  },
  {
    codigo: 'trabalhista',
    caminho: 'Trabalhista',
    descricao: 'Folha, admissao, rescisao, ferias, encargos e documentos de colaboradores.',
    ordem: 90,
  },
  {
    codigo: 'certidoes-licencas',
    caminho: 'Certidoes e Licencas',
    descricao: 'CNDs, alvaras, licencas, certificados digitais e regularidades.',
    ordem: 100,
  },
  {
    codigo: 'contratos-procuracoes',
    caminho: 'Contratos e Procuracoes',
    descricao: 'Contratos de prestacao, procuracoes, autorizacoes e instrumentos comerciais.',
    ordem: 110,
  },
  {
    codigo: 'bancario-financiamentos',
    caminho: 'Bancario e Financiamentos',
    descricao: 'Financiamentos, emprestimos, garantias, parcelas e contratos bancarios.',
    ordem: 120,
  },
];

export const pastasPadraoKeys = {
  all: ['parametrizacao', 'pastas-padrao'] as const,
};

const fromRow = (row: PastaPadraoRow): PastaPadraoDocumento => ({
  id: row.id,
  codigo: row.codigo,
  caminho: row.caminho,
  descricao: row.descricao || '',
  sistema: Boolean(row.sistema),
  ativo: row.ativo !== false,
  ordem: Number(row.ordem || 100),
});

const sortPastas = (items: PastaPadraoDocumento[]) => (
  [...items].sort((a, b) => a.ordem - b.ordem || a.caminho.localeCompare(b.caminho, 'pt-BR', { sensitivity: 'base' }))
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

const normalizeFolderPath = (value: string) => (
  value
    .split('/')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('/')
);

export const expandFolderPaths = (paths: string[]) => {
  const expanded = new Set<string>();
  paths.forEach((path) => {
    const normalized = normalizeFolderPath(path);
    if (!normalized) return;
    const parts = normalized.split('/');
    parts.forEach((_, index) => {
      expanded.add(parts.slice(0, index + 1).join('/'));
    });
  });
  return Array.from(expanded);
};

const getEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada.');
  return data as string;
};

const ensureDefaults = async () => {
  const empresaId = await getEmpresaId();
  const codigos = DEFAULT_PASTAS_DOCUMENTOS.map((item) => item.codigo);
  const { data, error } = await supabase
    .from(TABLE)
    .select('codigo')
    .eq('empresa_id', empresaId)
    .in('codigo', codigos);

  if (error) throw error;

  const existing = new Set((data || []).map((item) => item.codigo));
  const missing = DEFAULT_PASTAS_DOCUMENTOS.filter((item) => !existing.has(item.codigo));
  if (!missing.length) return;

  const { error: insertError } = await supabase.from(TABLE).upsert(
    missing.map((item) => ({
      empresa_id: empresaId,
      ...item,
      sistema: true,
      ativo: true,
    })),
    { onConflict: 'empresa_id,codigo' },
  );

  if (insertError) throw insertError;
};

export const pastasPadraoService = {
  async list(): Promise<PastaPadraoDocumento[]> {
    await ensureDefaults();

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,codigo,caminho,descricao,sistema,ativo,ordem')
      .order('ordem', { ascending: true });

    if (error) throw error;
    return sortPastas(((data || []) as PastaPadraoRow[]).map(fromRow));
  },

  async listActivePaths(): Promise<string[]> {
    const items = await this.list();
    return expandFolderPaths(items.filter((item) => item.ativo).map((item) => item.caminho));
  },

  async save(input: SavePastaPadraoInput): Promise<void> {
    const caminho = normalizeFolderPath(input.caminho);
    if (!caminho) throw new Error('Informe o caminho da pasta.');

    if (input.id) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          caminho,
          descricao: input.descricao.trim(),
          ativo: input.ativo,
        })
        .eq('id', input.id);

      if (error) throw error;
      return;
    }

    const empresaId = await getEmpresaId();
    const codigo = slugify(caminho) || `pasta-${Date.now()}`;
    const { error } = await supabase.from(TABLE).insert({
      empresa_id: empresaId,
      codigo,
      caminho,
      descricao: input.descricao.trim(),
      sistema: false,
      ativo: input.ativo,
      ordem: 100,
    });

    if (error) throw error;
  },

  async setAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ ativo }).eq('id', id);
    if (error) throw error;
  },

  async applyActiveToAllCompanies(): Promise<number> {
    const empresaId = await getEmpresaId();
    const activePaths = await this.listActivePaths();
    if (!activePaths.length) return 0;

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('id,pastas_documentos')
      .eq('empresa_id', empresaId);

    if (error) throw error;

    const updates = (clientes || []).map((cliente) => {
      const atuais = Array.isArray(cliente.pastas_documentos) ? cliente.pastas_documentos : [];
      return {
        id: cliente.id as string,
        pastas_documentos: Array.from(new Set([...atuais, ...activePaths])),
      };
    });

    await Promise.all(updates.map((item) => (
      supabase
        .from('clientes')
        .update({ pastas_documentos: item.pastas_documentos })
        .eq('id', item.id)
        .throwOnError()
    )));

    return updates.length;
  },
};
