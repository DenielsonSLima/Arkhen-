import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({ supabase: supabaseMock }));

import {
  filiaisService,
  groupBranchesByMatrix,
  resolveVisibleBranches,
  selectVisibleOperationalRoots,
  supportsRelationalBranches,
} from './filiaisService';
import type { ClientBranch, FilialClienteRow } from './filiaisService';

const MATRIZ_ID = '11111111-1111-4111-8111-111111111111';
const FILIAL_ID = '22222222-2222-4222-8222-222222222222';
const UPDATED_AT = '2026-09-01T20:00:00.000Z';

const filialRow: FilialClienteRow = {
  id: FILIAL_ID,
  matriz_cliente_id: MATRIZ_ID,
  filial_ref: 'filial-aracaju',
  nome: 'Filial Aracaju',
  cnpj: '12.345.678/0002-00',
  email: 'filial@example.com',
  telefone: '(79) 99999-0000',
  contato: 'Maria',
  endereco: 'Rua A, 10',
  bairro: 'Centro',
  cep: '49000-000',
  cidade: 'Aracaju',
  uf: 'SE',
  status: 'Ativa',
  updated_at: UPDATED_AT,
};

const branch: ClientBranch = {
  id: FILIAL_ID,
  companyId: MATRIZ_ID,
  filialRef: 'filial-aracaju',
  nome: 'Filial Aracaju',
  cnpj: '12.345.678/0002-00',
  email: 'filial@example.com',
  telefone: '(79) 99999-0000',
  contato: 'Maria',
  endereco: 'Rua A, 10',
  bairro: 'Centro',
  cep: '49000-000',
  cidade: 'Aracaju',
  uf: 'SE',
  ativo: true,
  updatedAt: UPDATED_AT,
};

describe('filiaisService', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ data: filialRow, error: null });
  });

  it('agrupa somente linhas-filhas e preserva a raiz como hierarquia relacional', () => {
    const rows: FilialClienteRow[] = [
      { id: MATRIZ_ID, matriz_cliente_id: null },
      filialRow,
      {
        ...filialRow,
        id: '33333333-3333-4333-8333-333333333333',
        nome: 'Filial Maceió',
        status: 'Inativa',
      },
    ];

    expect(supportsRelationalBranches(rows)).toBe(true);
    expect(groupBranchesByMatrix(rows).get(MATRIZ_ID)).toEqual([
      expect.objectContaining({ id: FILIAL_ID, nome: 'Filial Aracaju', ativo: true }),
      expect.objectContaining({ nome: 'Filial Maceió', ativo: false }),
    ]);
  });

  it('mantém uma filial acessada diretamente sem revelar matriz ou filiais irmãs', () => {
    expect(selectVisibleOperationalRoots([filialRow])).toEqual([filialRow]);
    expect(selectVisibleOperationalRoots([
      { id: MATRIZ_ID, matriz_cliente_id: null },
      filialRow,
    ])).toEqual([{ id: MATRIZ_ID, matriz_cliente_id: null }]);
  });

  it('preserva filiais legadas enquanto a matriz ainda não possui filiais relacionais', () => {
    expect(resolveVisibleBranches({ id: MATRIZ_ID, polos: [branch] }, new Map())).toEqual([branch]);
    expect(resolveVisibleBranches(
      { id: MATRIZ_ID, polos: [branch] },
      new Map([[MATRIZ_ID, [{ ...branch, nome: 'Filial relacional' }]]]),
    )).toEqual([expect.objectContaining({ nome: 'Filial relacional' })]);
  });

  it('salva a filial pela RPC com payload permitido e CAS', async () => {
    const result = await filiaisService.saveBranch(MATRIZ_ID, branch);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('salvar_filial_cliente_v1', {
      p_matriz_id: MATRIZ_ID,
      p_filial_id: FILIAL_ID,
      p_payload: {
        filial_ref: 'filial-aracaju',
        nome: 'Filial Aracaju',
        cnpj: '12.345.678/0002-00',
        email: 'filial@example.com',
        telefone: '(79) 99999-0000',
        contato: 'Maria',
        endereco: 'Rua A, 10',
        bairro: 'Centro',
        cep: '49000-000',
        cidade: 'Aracaju',
        uf: 'SE',
      },
      p_expected_updated_at: UPDATED_AT,
    });
    expect(result).toMatchObject({ id: FILIAL_ID, companyId: MATRIZ_ID, updatedAt: UPDATED_AT });
  });

  it('deixa o banco gerar a identidade de uma nova filial', async () => {
    await filiaisService.saveBranch(MATRIZ_ID, {
      ...branch,
      id: '',
      filialRef: undefined,
      updatedAt: undefined,
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'salvar_filial_cliente_v1',
      expect.objectContaining({
        p_filial_id: null,
        p_expected_updated_at: null,
        p_payload: expect.not.objectContaining({ filial_ref: expect.anything() }),
      }),
    );
  });

  it('inativa sem excluir fisicamente e envia o CAS atual', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: { ...filialRow, status: 'Inativa', updated_at: '2026-09-01T20:01:00.000Z' },
      error: null,
    });

    const result = await filiaisService.defineBranchStatus(MATRIZ_ID, branch, 'Inativa');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('definir_status_filial_cliente_v1', {
      p_matriz_id: MATRIZ_ID,
      p_filial_id: FILIAL_ID,
      p_status: 'Inativa',
      p_expected_updated_at: UPDATED_AT,
    });
    expect(result.ativo).toBe(false);
  });
});
