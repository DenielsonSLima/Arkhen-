import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./ConfigFluxosPage.tsx', import.meta.url), 'utf8');
const pageStyles = readFileSync(new URL('./ConfigFluxosPage.css', import.meta.url), 'utf8');

describe('ConfigFluxosPage lazy styles', () => {
  it('carrega os estilos da própria rota lazy', () => {
    expect(pageSource).toContain("import './ConfigFluxosPage.css'");
    expect(pageStyles).toContain('.config-fluxos-page.submodule-content-card');
    expect(pageStyles).toContain('.config-fluxos-page .model-preset-card');
    expect(pageStyles).toContain('.config-fluxos-page .config-table');
  });

  it('mantém contraste e destaque da seleção sem depender de outro módulo', () => {
    expect(pageStyles).toContain('color: var(--color-text-dark, #0f172a)');
    expect(pageStyles).toContain('.model-preset-card.gold-border');
    expect(pageStyles).toContain('.gold-text');
  });
});
