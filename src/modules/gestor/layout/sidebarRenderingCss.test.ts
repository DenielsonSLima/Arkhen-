import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./GestorSidebarCompact.css', import.meta.url), 'utf8');

describe('Safari rendering safeguards', () => {
  it('releases the page transform after the entrance animation', () => {
    const animationRule = indexCss.match(/\.animate-page-fade\s*\{[^}]*\}/)?.[0] ?? '';

    expect(animationRule).not.toContain('forwards');
    expect(indexCss).toMatch(/to\s*\{\s*opacity:\s*1;\s*transform:\s*none;\s*\}/);
  });

  it('keeps desktop sidebar typography on whole-pixel metrics', () => {
    expect(sidebarCss).not.toMatch(/font-smoothing|text-rendering/);
    expect(sidebarCss).not.toContain('letter-spacing: 0.005em');
    expect(sidebarCss).toMatch(/\.menu-btn\s*\{[^}]*font-size:\s*15px;[^}]*line-height:\s*20px;/s);
    expect(sidebarCss).toMatch(/\.submenu-btn\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*18px;/s);
  });
});
