import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn(),
    },
  },
}));

import { supabase } from '../../../../lib/supabase';
import { inicioService } from './inicioService';
import { buildInicioSetupStatus } from './inicioSetupService';

describe('inicioService.getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'empresa-ativa', error: null } as never);
  });

  it('usa a contagem real de clientes ativos visível pelas políticas RLS', async () => {
    const statusEq = vi.fn().mockResolvedValue({ count: 3, error: null });
    const empresaEq = vi.fn().mockReturnValue({ eq: statusEq });
    const select = vi.fn().mockReturnValue({ eq: empresaEq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(inicioService.getDashboardData()).resolves.toEqual({
      stats: { clientesAtivos: 3 },
    });
    expect(supabase.from).toHaveBeenCalledWith('clientes');
    expect(supabase.rpc).toHaveBeenCalledWith('current_empresa_id');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(empresaEq).toHaveBeenCalledWith('empresa_id', 'empresa-ativa');
    expect(statusEq).toHaveBeenCalledWith('status', 'Ativa');
  });

  it('não mascara falhas de leitura como zero clientes', async () => {
    const statusEq = vi.fn().mockResolvedValue({ count: null, error: { message: 'acesso negado' } });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: statusEq }),
      }),
    } as never);

    await expect(inicioService.getDashboardData()).rejects.toThrow('acesso negado');
  });
});

describe('buildInicioSetupStatus', () => {
  it('conclui a preparação quando os dados essenciais estão realmente presentes', () => {
    const status = buildInicioSetupStatus({
      empresa: {
        razao_social: 'Escritório Contábil Exemplo Ltda',
        nome_fantasia: 'Escritório Exemplo',
        cnpj: '11.222.333/0001-81',
        email: 'contato@example.com',
        telefone: '',
        cep: '49055-123',
        endereco: 'Rua do Escritório',
        numero: '100',
        cidade: 'Aracaju',
        estado: 'SE',
        logo_url: 'https://cdn.example/logo.png',
      },
      marcaDagua: {
        file_url_paisagem: 'https://cdn.example/paisagem.png',
        file_url_retrato: 'https://cdn.example/retrato.png',
      },
      clientes: [{ id: 'cliente-1', modelos_ativos: ['modelo-1'] }],
      modelosAtivos: 6,
      rotinasAtivas: 2,
      tarefasAtivas: 0,
      usuariosAtivos: 1,
    });

    expect(status.configuracaoEssencialCompleta).toBe(true);
    expect(status.configuracaoRecomendadaCompleta).toBe(true);
    expect(status.essenciaisConcluidos).toBe(4);
  });

  it('mantém modelos pendentes quando o cliente ainda não possui vínculo', () => {
    const status = buildInicioSetupStatus({
      empresa: null,
      marcaDagua: null,
      clientes: [{ id: 'cliente-1', modelos_ativos: [] }],
      modelosAtivos: 6,
      rotinasAtivas: 0,
      tarefasAtivas: 1,
      usuariosAtivos: 1,
    });

    expect(status.modelosVinculados).toBe(false);
    expect(status.operacaoPlanejada).toBe(true);
    expect(status.configuracaoEssencialCompleta).toBe(false);
  });

  it('não considera dados de demonstração como cadastro completo', () => {
    const status = buildInicioSetupStatus({
      empresa: {
        razao_social: 'Escritório Contábil Exemplo Ltda',
        nome_fantasia: 'Escritório Exemplo',
        cnpj: '11.222.333/0001-81',
        email: 'contato@example.com',
        telefone: '79999999999',
        cep: '49000-000',
        endereco: 'Rua da Empresa Fictícia',
        numero: '100',
        cidade: 'Aracaju',
        estado: 'SE',
        logo_url: null,
      },
      marcaDagua: null,
      clientes: [],
      modelosAtivos: 0,
      rotinasAtivas: 0,
      tarefasAtivas: 0,
      usuariosAtivos: 0,
    });

    expect(status.empresaCompleta).toBe(false);
  });
});
