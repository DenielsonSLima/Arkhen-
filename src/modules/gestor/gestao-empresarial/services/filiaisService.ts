import { supabase } from '../../../../lib/supabase';
import type { CompanyLookupDraft } from './cnpjLookupService';

export interface ClientBranch {
  id: string;
  companyId: string;
  filialRef?: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  bairro?: string;
  contato?: string;
  ativo: boolean;
  endereco?: string;
  cep?: string;
  updatedAt?: string;
  cnpjLookupSnapshot?: CompanyLookupDraft;
}

export interface FilialClienteRow {
  id: string;
  matriz_cliente_id?: string | null;
  polos?: ClientBranch[] | null;
  filial_ref?: string | null;
  nome?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bairro?: string | null;
  contato?: string | null;
  status?: 'Ativa' | 'Inativa' | null;
  endereco?: string | null;
  cep?: string | null;
  updated_at?: string | null;
  cnpj_lookup_snapshot?: CompanyLookupDraft | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseFilialRow = (value: unknown): FilialClienteRow => {
  if (!isObject(value) || typeof value.id !== 'string') {
    throw new Error('A operação da filial retornou uma resposta inválida.');
  }
  return value as unknown as FilialClienteRow;
};

export const mapFilialRowToBranch = (
  row: FilialClienteRow,
  matrizId = row.matriz_cliente_id || '',
): ClientBranch => ({
  id: row.id,
  companyId: matrizId,
  filialRef: row.filial_ref || undefined,
  nome: row.nome || '',
  cnpj: row.cnpj || '',
  email: row.email || '',
  telefone: row.telefone || '',
  cidade: row.cidade || '',
  uf: row.uf || '',
  bairro: row.bairro || '',
  contato: row.contato || '',
  ativo: row.status === 'Ativa',
  endereco: row.endereco || '',
  cep: row.cep || '',
  updatedAt: row.updated_at || undefined,
  cnpjLookupSnapshot: row.cnpj_lookup_snapshot || undefined,
});

export const supportsRelationalBranches = (rows: readonly FilialClienteRow[]) => (
  rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'matriz_cliente_id'))
);

export const groupBranchesByMatrix = (rows: readonly FilialClienteRow[]) => {
  const grouped = new Map<string, ClientBranch[]>();

  rows.forEach((row) => {
    if (!row.matriz_cliente_id) return;
    const branches = grouped.get(row.matriz_cliente_id) || [];
    branches.push(mapFilialRowToBranch(row));
    grouped.set(row.matriz_cliente_id, branches);
  });

  grouped.forEach((branches) => {
    branches.sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'));
  });

  return grouped;
};

export const selectVisibleOperationalRoots = <T extends FilialClienteRow>(rows: readonly T[]): T[] => {
  const visibleMatrices = new Set(rows.filter((row) => !row.matriz_cliente_id).map((row) => row.id));
  return rows.filter((row) => !row.matriz_cliente_id || !visibleMatrices.has(row.matriz_cliente_id));
};

export const resolveVisibleBranches = (
  row: FilialClienteRow,
  grouped: ReadonlyMap<string, ClientBranch[]>,
) => row.matriz_cliente_id ? [] : grouped.get(row.id) ?? row.polos ?? [];

const buildFilialPayload = (branch: ClientBranch) => ({
  ...(branch.filialRef ? { filial_ref: branch.filialRef } : {}),
  nome: branch.nome,
  cnpj: branch.cnpj,
  email: branch.email,
  telefone: branch.telefone,
  contato: branch.contato || '',
  endereco: branch.endereco || '',
  bairro: branch.bairro || '',
  cep: branch.cep || '',
  cidade: branch.cidade,
  uf: branch.uf,
  cnpj_lookup_snapshot: branch.cnpjLookupSnapshot || {},
});

export const filiaisService = {
  async saveBranch(matrizId: string, branch: ClientBranch): Promise<ClientBranch> {
    const { data, error } = await supabase.rpc('salvar_filial_cliente_v1', {
      p_matriz_id: matrizId,
      p_filial_id: branch.id || null,
      p_payload: buildFilialPayload(branch),
      p_expected_updated_at: branch.updatedAt || null,
    });

    if (error) throw new Error(`Erro ao salvar filial: ${error.message}`);
    return mapFilialRowToBranch(parseFilialRow(data), matrizId);
  },

  async defineBranchStatus(
    matrizId: string,
    branch: ClientBranch,
    status: 'Ativa' | 'Inativa',
  ): Promise<ClientBranch> {
    const { data, error } = await supabase.rpc('definir_status_filial_cliente_v1', {
      p_matriz_id: matrizId,
      p_filial_id: branch.id,
      p_status: status,
      p_expected_updated_at: branch.updatedAt || null,
    });

    if (error) throw new Error(`Erro ao alterar status da filial: ${error.message}`);
    return mapFilialRowToBranch(parseFilialRow(data), matrizId);
  },
};
