import { supabase } from '../../../../../lib/supabase';
import { persistedStorage } from '../../../../../lib/persistedStorage';

export type PlanoContratacaoId = 'teste' | 'standard' | 'growth' | 'maximo';

export interface PlanoContratacao {
  id: PlanoContratacaoId;
  nome: string;
  selo: string;
  empresas: number;
  armazenamentoGb: number;
  precoMensal: number;
  descricao: string;
  destaque?: boolean;
  teste?: boolean;
}

export interface StorageUsageRow {
  nome: string;
  tamanhoBytes: number;
  mimeType?: string;
}

export interface PlanoEmpresaResumo {
  empresaId: string;
  planoAtual: PlanoContratacao;
  totalBytes: number;
  fileCount: number;
  companyCount: number;
  files: StorageUsageRow[];
}

const STORAGE_KEY_PREFIX = 'contabil_plano_contratacao_empresa';

export const PLANOS_CONTRATACAO: PlanoContratacao[] = [
  {
    id: 'teste',
    nome: 'Teste',
    selo: 'Ambiente de avaliação',
    empresas: 10,
    armazenamentoGb: 5,
    precoMensal: 0,
    descricao: 'Plano de teste para validar o sistema com limite reduzido de empresas e documentos.',
    teste: true,
  },
  {
    id: 'standard',
    nome: 'Standard',
    selo: 'Operação inicial',
    empresas: 20,
    armazenamentoGb: 10,
    precoMensal: 249.90,
    descricao: 'Para escritórios que precisam centralizar clientes, documentos e rotinas essenciais.',
  },
  {
    id: 'growth',
    nome: 'Growth',
    selo: 'Mais escolhido',
    empresas: 40,
    armazenamentoGb: 25,
    precoMensal: 379.90,
    descricao: 'Para carteiras em crescimento com mais volume documental e organização por equipe.',
    destaque: true,
  },
  {
    id: 'maximo',
    nome: 'Máximo',
    selo: 'Maior capacidade',
    empresas: 100,
    armazenamentoGb: 50,
    precoMensal: 459.90,
    descricao: 'Para escritórios com alta carteira de clientes e grande fluxo de arquivos.',
  },
];

const DEFAULT_PLANO_ID: PlanoContratacaoId = 'maximo';

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error || !data) {
    throw new Error('Usuário sem empresa vinculada no Supabase.');
  }
  return String(data);
};

const getStorageKey = (empresaId: string) => `${STORAGE_KEY_PREFIX}:${empresaId}`;

export const getPlanoById = (id?: string | null) => (
  PLANOS_CONTRATACAO.find((plano) => plano.id === id) || PLANOS_CONTRATACAO.find((plano) => plano.id === DEFAULT_PLANO_ID)!
);

export const bytesToGb = (bytes: number) => bytes / 1024 / 1024 / 1024;

export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : index === 1 ? 1 : 2)} ${units[index]}`;
};

export const planosContratacaoService = {
  async getEmpresaId() {
    return getCurrentEmpresaId();
  },

  getPlanoEmpresa(empresaId: string) {
    const stored = persistedStorage.getItem(getStorageKey(empresaId));
    return getPlanoById(stored);
  },

  setPlanoEmpresa(empresaId: string, planoId: PlanoContratacaoId) {
    persistedStorage.setItem(getStorageKey(empresaId), planoId);
    return getPlanoById(planoId);
  },

  async getResumo(): Promise<PlanoEmpresaResumo> {
    const empresaId = await getCurrentEmpresaId();
    const planoAtual = this.getPlanoEmpresa(empresaId);

    const [docsResult, clientsResult] = await Promise.all([
      supabase
        .from('documentos')
        .select('nome,tamanho_bytes,mime_type'),
      supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true }),
    ]);

    if (docsResult.error) {
      throw new Error(`Erro ao buscar armazenamento da empresa: ${docsResult.error.message}`);
    }

    if (clientsResult.error) {
      throw new Error(`Erro ao buscar empresas cadastradas: ${clientsResult.error.message}`);
    }

    const files = (docsResult.data || []).map((row) => ({
      nome: String(row.nome || 'arquivo'),
      tamanhoBytes: Number(row.tamanho_bytes || 0),
      mimeType: row.mime_type || undefined,
    }));

    return {
      empresaId,
      planoAtual,
      files,
      totalBytes: files.reduce((acc, file) => acc + file.tamanhoBytes, 0),
      fileCount: files.length,
      companyCount: clientsResult.count || 0,
    };
  },

  async assertCanUpload(fileSizeBytes: number): Promise<void> {
    const resumo = await this.getResumo();
    const limitBytes = resumo.planoAtual.armazenamentoGb * 1024 * 1024 * 1024;
    if (resumo.totalBytes + fileSizeBytes > limitBytes) {
      throw new Error(
        `Limite de armazenamento do plano ${resumo.planoAtual.nome} atingido. ` +
        `Disponível: ${formatBytes(Math.max(limitBytes - resumo.totalBytes, 0))}.`
      );
    }
  },

  async assertCanCreateCompany(): Promise<void> {
    const resumo = await this.getResumo();
    if (resumo.companyCount >= resumo.planoAtual.empresas) {
      throw new Error(
        `Limite de empresas do plano ${resumo.planoAtual.nome} atingido. ` +
        `Este plano permite até ${resumo.planoAtual.empresas} empresas.`
      );
    }
  },
};
