import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDE_ARTICLES } from './helpData';
import { GUIDE_SCREENSHOTS } from './guideScreenshots';

describe('Capturas reais do manual', () => {
  it('vincula somente tutoriais existentes a capturas JPEG presentes no projeto', () => {
    const articleIds = new Set(GUIDE_ARTICLES.map(({ article }) => article.id));
    expect(Object.keys(GUIDE_SCREENSHOTS).length).toBeGreaterThan(0);
    for (const [articleId, images] of Object.entries(GUIDE_SCREENSHOTS)) {
      expect(articleIds.has(articleId), articleId).toBe(true);
      expect(images?.length, articleId).toBeGreaterThan(0);
      const sources = images!.map((image) => image.src);
      expect(new Set(sources).size, articleId).toBe(sources.length);
      for (const image of images!) {
        expect(image.src).toMatch(/^\/guia-ajuda\/screens\/[a-z0-9-]+\.jpg$/);
        const file = resolve('public', image.src.slice(1));
        expect(existsSync(file), file).toBe(true);
        expect([...readFileSync(file).subarray(0, 3)], file).toEqual([255, 216, 255]);
        expect(image.alt.trim().length).toBeGreaterThan(10);
        expect(image.caption.trim().length).toBeGreaterThan(10);
        expect(image.markers?.length).toBeGreaterThanOrEqual(2);
        for (const marker of image.markers || []) {
          expect(marker.x).toBeGreaterThanOrEqual(0);
          expect(marker.x).toBeLessThanOrEqual(100);
          expect(marker.y).toBeGreaterThanOrEqual(0);
          expect(marker.y).toBeLessThanOrEqual(100);
          expect(marker.label.trim()).not.toBe('');
          expect(marker.description.trim()).not.toBe('');
        }
      }
    }
  });
});
