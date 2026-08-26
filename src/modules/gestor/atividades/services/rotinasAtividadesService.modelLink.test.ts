import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RotinaAtividade } from './rotinasAtividadesService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    auth: { getUser: vi.fn() },
  },
}));

import { rotinasAtividadesService } from './rotinasAtividadesService';

const rotina: RotinaAtividade = {
  id: 'nova-rotina',
  modeloId: '10000000-0000-4000-8000-000000000001',
  nome: 'Fechamento fiscal',
  categoria: 'Fiscal',
  frequencia: 'Mensal',
  intervaloDias: 30,
  responsavel: 'Ana',
  responsavelConfigUsuarioId: '30000000-0000-4000-8000-000000000001',
  clienteId: '20000000-0000-4000-8000-000000000001',
  cliente: 'Cliente A',
  proximaExecucao: '2099-09-01',
  prioridade: 'Alta',
  ativa: true,
  checklist: ['Apurar impostos'],
  observacoes: '',
};

describe('rotinasAtividadesService — vínculo cliente/modelo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: '40000000-0000-4000-8000-000000000001',
      error: null,
    });
    const query = {
      select: mocks.select,
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
  });

  it('bloqueia a gravação quando o modelo não está em modelos_ativos do cliente', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: rotina.clienteId, modelos_ativos: [] },
      error: null,
    });

    await expect(rotinasAtividadesService.saveRotina(rotina))
      .rejects.toThrow(/não está vinculado ao cliente escolhido/i);

    expect(mocks.from).toHaveBeenCalledWith('clientes');
    expect(mocks.select).toHaveBeenCalledWith('id,modelos_ativos');
  });
});
