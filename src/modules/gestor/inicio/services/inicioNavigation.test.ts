/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateToInicioTarget } from './inicioNavigation';

describe('navigateToInicioTarget', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('abre a marca d’água na guia montada e preserva o destino para uma nova montagem', () => {
    const activateModule = vi.fn();
    const onOpenSubTab = vi.fn();
    window.addEventListener('open_config_subtab', onOpenSubTab);

    navigateToInicioTarget(
      { moduleId: 'configuracoes', configSubTab: 'marca-dagua' },
      activateModule,
    );

    expect(sessionStorage.getItem('contabil_config_initial_subtab')).toBe('marca-dagua');
    expect(onOpenSubTab).toHaveBeenCalledTimes(1);
    expect((onOpenSubTab.mock.calls[0][0] as CustomEvent).detail).toEqual({
      subTab: 'marca-dagua',
    });
    expect(activateModule).toHaveBeenCalledWith('configuracoes');
    window.removeEventListener('open_config_subtab', onOpenSubTab);
  });

  it('navega para módulos comuns sem deixar subaba residual', () => {
    const activateModule = vi.fn();

    navigateToInicioTarget({ moduleId: 'clientes' }, activateModule);

    expect(sessionStorage.getItem('contabil_config_initial_subtab')).toBeNull();
    expect(activateModule).toHaveBeenCalledWith('clientes');
  });

  it('mantém a navegação quando o navegador bloqueia o sessionStorage', () => {
    const activateModule = vi.fn();
    const blockedStorage = {
      setItem: vi.fn(() => {
        throw new DOMException('Storage bloqueado');
      }),
    };

    expect(() =>
      navigateToInicioTarget(
        { moduleId: 'configuracoes', configSubTab: 'empresa' },
        activateModule,
        blockedStorage,
      ),
    ).not.toThrow();
    expect(activateModule).toHaveBeenCalledWith('configuracoes');
  });
});
