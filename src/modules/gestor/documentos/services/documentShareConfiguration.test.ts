import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ maybeSingle: mocks.maybeSingle }),
      upsert: mocks.upsert,
    }),
  },
}));

import {
  getConfiguracaoCompartilhamento,
  getShareExpirationMinutes,
  isSharePasswordRequired,
  saveConfiguracaoCompartilhamento,
  type ShareConfiguration,
} from './documentShareConfiguration';

const input: ShareConfiguration = {
  tempoPadrao: '3 horas',
  tempoPadraoMinutos: 180,
  limitarTipos: ['dre'],
  exigirSenhaPadrao: true,
  prazosExigemSenha: ['12 horas'],
};

describe('documentShareConfiguration — defaults seguros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: 'empresa-real', error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it('limita qualquer duração arbitrária ao máximo de três dias', () => {
    expect(getShareExpirationMinutes('999999 dias')).toBe(4320);
    expect(getShareExpirationMinutes('0 minutos')).toBe(10);
  });

  it('mantém senha obrigatória quando a configuração persistida é nula', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        tempo_padrao_minutos: 180,
        exigir_senha: null,
        limitar_tipos: null,
        prazos_exigem_senha: null,
      },
      error: null,
    });

    await expect(getConfiguracaoCompartilhamento()).resolves.toMatchObject({
      tempoPadraoMinutos: 180,
      exigirSenhaPadrao: true,
    });
  });

  it('mantém senha obrigatória quando uma entrada incompleta omite a decisão', async () => {
    await saveConfiguracaoCompartilhamento({
      ...input,
      exigirSenhaPadrao: undefined as unknown as boolean,
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ exigir_senha: true }),
      { onConflict: 'empresa_id' },
    );
  });

  it('propaga falha de leitura em vez de exibir políticas padrão como se estivessem salvas', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(getConfiguracaoCompartilhamento()).rejects.toThrow(
      'Não foi possível carregar a configuração de compartilhamento',
    );
  });

  it('impõe senha global ou por prazo mesmo quando a tela tenta desativá-la', () => {
    expect(isSharePasswordRequired(input, '30 minutos', false)).toBe(true);
    expect(isSharePasswordRequired({ ...input, exigirSenhaPadrao: false }, '12 HORAS', false)).toBe(true);
    expect(isSharePasswordRequired({ ...input, exigirSenhaPadrao: false }, '30 minutos', false)).toBe(false);
    expect(isSharePasswordRequired({ ...input, exigirSenhaPadrao: false }, '30 minutos', true)).toBe(true);
  });

  it('não informa sucesso quando a configuração não foi persistida', async () => {
    mocks.upsert.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });

    await expect(saveConfiguracaoCompartilhamento(input)).rejects.toThrow(
      'Não foi possível salvar a configuração',
    );
  });

  it('não tenta salvar sem uma empresa ativa validada', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'sem vínculo' } });

    await expect(saveConfiguracaoCompartilhamento(input)).rejects.toThrow('empresa ativa');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
