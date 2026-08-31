import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { inicioSetupService, type InicioSetupStatus } from './inicioSetupService';

const status: InicioSetupStatus = {
  empresaCompleta: true,
  logoConfigurado: true,
  marcasDaguaConfiguradas: true,
  identidadeCompleta: true,
  clientesAtivos: 1,
  clientesComModelos: 1,
  modelosAtivos: 3,
  modelosVinculados: true,
  rotinasAtivas: 2,
  tarefasAtivas: 1,
  operacaoPlanejada: true,
  usuariosAtivos: 1,
  essenciaisConcluidos: 4,
  essenciaisTotal: 4,
  configuracaoEssencialCompleta: true,
  configuracaoRecomendadaCompleta: true,
};

describe('inicioSetupService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('obtém o status preparado no banco, sem leituras diretas no cliente', async () => {
    rpcMock.mockResolvedValue({ data: status, error: null });

    await expect(inicioSetupService.getStatus()).resolves.toEqual(status);

    expect(rpcMock).toHaveBeenCalledWith('obter_status_configuracao_inicio');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('não mascara uma falha da RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'acesso negado' } });

    await expect(inicioSetupService.getStatus()).rejects.toThrow('acesso negado');
  });

  it('rejeita uma resposta inválida para não exibir progresso incorreto', async () => {
    rpcMock.mockResolvedValue({ data: { clientesAtivos: '1' }, error: null });

    await expect(inicioSetupService.getStatus()).rejects.toThrow('formato inválido');
  });
});
