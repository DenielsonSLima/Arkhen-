import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRouteEnabled } from './moduleAccess';
import { modulosSistemaService, type SystemModuleId } from './modulosSistemaService';
import { TAB_INFOS } from '../../../layout/gestorTabMetadata';
import { HELP_DATA, searchGuide } from '../../../guia-ajuda/constants/helpData';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../../lib/supabase', () => ({ supabase: { rpc } }));
beforeEach(() => rpc.mockReset());

describe('Remoção do módulo tributário sem afetar Simulações', () => {
  it('rejeita abas antigas mesmo com um catálogo legado', () => {
    const enabled = new Set(['inicio', 'simulacoes-calculos', 'reforma-tributaria'] as SystemModuleId[]);
    expect(isRouteEnabled('reforma-tributaria', enabled)).toBe(false);
    expect(isRouteEnabled('reforma-tributaria__old-tab', enabled)).toBe(false);
    expect(isRouteEnabled('simulacoes-calculos', enabled)).toBe(true);
    expect(isRouteEnabled('guia-ajuda', enabled)).toBe(true);
  });

  it('filtra o módulo removido enquanto o banco ainda tem o catálogo anterior', async () => {
    rpc.mockResolvedValue({ data: { canManage: true, modulos: [
      { id: 'reforma-tributaria', habilitado: true },
      { id: 'simulacoes-calculos', habilitado: true },
    ] }, error: null });
    const response = await modulosSistemaService.list();
    expect(response.modulos.map((module) => module.id)).toEqual(['simulacoes-calculos']);
    expect(response.modulos[0].descricao).toBe('Calculadora de Rescisão.');
  });

  it('não reintroduz o módulo pelo fallback', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    const response = await modulosSistemaService.list();
    expect(response.modulos.map((module) => module.id)).not.toContain('reforma-tributaria');
    expect(response.modulos.map((module) => module.id)).toContain('simulacoes-calculos');
  });

  it('remove atalhos e manuais somente do módulo aposentado', () => {
    expect(TAB_INFOS['reforma-tributaria']).toBeUndefined();
    expect(TAB_INFOS['simulacoes-calculos']).toBeDefined();
    expect(HELP_DATA.some((module) => module.id === 'reforma-tributaria')).toBe(false);
    expect(searchGuide('reforma tributária')).toEqual([]);
    expect(searchGuide('rescisão').length).toBeGreaterThan(0);
  });
});
