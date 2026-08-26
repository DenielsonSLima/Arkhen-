import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./GestorSidebarCompact.css', import.meta.url), 'utf8');

const relativeLuminance = (hex: string) => {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) || [];
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

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
    expect(sidebarCss).toContain('color: #d5d8de;');
    expect(sidebarCss).toContain('color: #c8ccd3;');
    expect(sidebarCss).toMatch(/\.sidebar-profile:hover,[^}]*transform:\s*none;/s);
  });

  it('keeps keyboard focus, active state and reduced motion visibly distinct', () => {
    expect(sidebarCss).toMatch(/\.menu-btn:focus-visible,[^}]*box-shadow:\s*0 0 0 2px #f0c66f;/s);
    expect(sidebarCss).toMatch(/\.menu-btn\.active,[^}]*background-color:\s*rgba\(197, 146, 53, 0\.16\);/s);
    expect(sidebarCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*0\.01ms;/);
  });

  it('keeps primary and secondary labels above enhanced contrast', () => {
    expect(contrastRatio('#d5d8de', '#161616')).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#c8ccd3', '#161616')).toBeGreaterThanOrEqual(7);
  });

  it('uses an explicit collapsible menu below the mobile breakpoint', () => {
    expect(sidebarCss).toMatch(/@media \(max-width: 768px\)[\s\S]*\.sidebar-menu\s*\{[^}]*display:\s*none;/);
    expect(sidebarCss).toMatch(/\.sidebar-menu\.is-mobile-open\s*\{[^}]*display:\s*flex;/);
    expect(sidebarCss).toMatch(/\.sidebar-mobile-toggle\s*\{[^}]*display:\s*inline-flex;/s);
  });
});
