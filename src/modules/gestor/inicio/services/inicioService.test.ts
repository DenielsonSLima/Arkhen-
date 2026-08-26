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
import { EMPTY_INICIO_DASHBOARD_SUMMARY } from './inicioDashboardSummary';
import { buildInicioSetupStatus } from './inicioSetupService';

describe('inicioService.getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca o resumo pronto somente pela RPC tenant-safe', async () => {
    const dashboard = {
      stats: { clientesAtivos: 3 },
      summary: {
        ...EMPTY_INICIO_DASHBOARD_SUMMARY,
        alertas: {
          ...EMPTY_INICIO_DASHBOARD_SUMMARY.alertas,
          itens: [{
            id: 'doc-1',
            empresaNome: 'Cliente A',
            tipo: 'documento' as const,
            nome: 'Contrato',
            dataValidade: '30/08/2026',
            diasRestantes: 4,
          }],
        },
      },
    };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: dashboard, error: null } as never);

    await expect(inicioService.getDashboardData()).resolves.toEqual(dashboard);
    expect(supabase.rpc).toHaveBeenCalledWith('obter_resumo_inicio');
    expect(supabase.from).not.toHaveBeenCalled();
    await expect(inicioService.getVencimentosProximos()).resolves.toEqual(
      dashboard.summary.alertas.itens,
    );
  });

  it('não mascara falhas da RPC como um resumo vazio', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'acesso negado' },
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
