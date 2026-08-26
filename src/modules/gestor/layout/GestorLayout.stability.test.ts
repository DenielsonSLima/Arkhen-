import { describe, expect, it } from 'vitest';
import layoutSource from './GestorLayout.tsx?raw';

describe('GestorLayout stability contract', () => {
  it('renderiza somente o painel ativo sem React Activity', () => {
    expect(layoutSource).not.toContain('React.Activity');
    expect(layoutSource).not.toMatch(/<Activity\b/);
    expect(layoutSource).toContain('data-active-module-panel="true"');
    expect(layoutSource).toContain('activePanel.moduleId');
  });

  it('não mantém overlay temporizado sobre o painel pronto', () => {
    expect(layoutSource).not.toContain('initialContentReady');
    expect(layoutSource).not.toContain('Preparando o painel inicial');
    expect(layoutSource).not.toContain('15_000');
  });
});
