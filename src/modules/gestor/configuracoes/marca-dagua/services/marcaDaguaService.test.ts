import { describe, expect, it, vi } from 'vitest';
import migrationSql from '../../../../../../supabase/migrations/20260830153552_corrigir_persistencia_marca_dagua_orientacoes.sql?raw';

vi.mock('../../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  resolveMarcaDaguaParaRelatorio,
  type MarcaDaguaDados,
} from './marcaDaguaService';

const marcaDagua: MarcaDaguaDados = {
  habilitado: true,
  fileUrl: 'https://assets.example.com/legado.png',
  fileUrlPaisagem: 'https://assets.example.com/paisagem.png',
  fileUrlRetrato: 'https://assets.example.com/retrato.png',
  posicao: 'centro',
  opacidade: 15,
  tamanho: 35,
  posicaoPaisagem: 'topo-direita',
  posicaoRetrato: 'rodape-direita',
  opacidadePaisagem: 25,
  opacidadeRetrato: 100,
  tamanhoPaisagem: 40,
  tamanhoRetrato: 90,
};

describe('resolveMarcaDaguaParaRelatorio', () => {
  it('seleciona exclusivamente os valores persistidos para a orientação do relatório', () => {
    expect(resolveMarcaDaguaParaRelatorio(marcaDagua, 'paisagem')).toEqual({
      habilitado: true,
      fileUrl: 'https://assets.example.com/paisagem.png',
      posicao: 'topo-direita',
      opacidade: 25,
      tamanho: 40,
    });
    expect(resolveMarcaDaguaParaRelatorio(marcaDagua, 'retrato')).toEqual({
      habilitado: true,
      fileUrl: 'https://assets.example.com/retrato.png',
      posicao: 'rodape-direita',
      opacidade: 100,
      tamanho: 90,
    });
  });

  it('preserva opacidade zero e usa o legado apenas quando o campo orientado está ausente', () => {
    const withoutPortraitValues = {
      ...marcaDagua,
      fileUrlRetrato: null,
      opacidadeRetrato: undefined,
      tamanhoRetrato: undefined,
      posicaoRetrato: undefined,
    } as unknown as MarcaDaguaDados;
    const disabledPortrait = {
      ...marcaDagua,
      opacidadeRetrato: 0,
    };

    expect(resolveMarcaDaguaParaRelatorio(withoutPortraitValues, 'retrato')).toMatchObject({
      fileUrl: marcaDagua.fileUrl,
      posicao: marcaDagua.posicao,
      opacidade: marcaDagua.opacidade,
      tamanho: marcaDagua.tamanho,
    });
    expect(resolveMarcaDaguaParaRelatorio(disabledPortrait, 'retrato').opacidade).toBe(0);
  });
});

describe('migration de marca d’água orientada', () => {
  it('versiona as colunas, a RPC compatível e a publicação do Realtime', () => {
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS posicao_paisagem text');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS tamanho_retrato integer');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.upsert_configuracoes_marca_dagua(p_payload jsonb)');
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain('posicao_retrato = EXCLUDED.posicao_retrato');
    expect(migrationSql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_marca_dagua');
  });
});
