/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuiaAjudaPage } from './GuiaAjudaPage';
import { GUIDE_ARTICLES, HELP_DATA, searchGuide } from './constants/helpData';

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });

describe('Manual por módulos', () => {
  it('abre um módulo, lê os passos e continua para o tutorial seguinte com foco no conteúdo', () => {
    render(<GuiaAjudaPage />);
    fireEvent.click(screen.getByRole('button', { name: /Parceiros.*Explorar módulo/ }));
    const navigation = screen.getByRole('navigation', { name: 'Tutoriais de Parceiros' });
    const module = HELP_DATA.find((item) => item.id === 'parceiros')!;
    fireEvent.click(within(navigation).getByRole('button', { name: new RegExp(module.articles[0].title) }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: module.articles[0].title }));
    expect(screen.getByRole('region', { name: 'Antes de começar' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Passo a passo' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Como conferir' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Próximo ${module.articles[1].title}`) }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: module.articles[1].title }));
  });

  it('busca em todo o manual sem acentos, abre o resultado e atravessa um assunto relacionado', () => {
    render(<GuiaAjudaPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pessoa fisica' } });
    expect(screen.getByRole('status').textContent).toMatch(/tutorial encontrado|tutoriais encontrados/);
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar uma pessoa física/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Cadastrar uma pessoa física' })).toBeTruthy();
    const related = screen.getByRole('region', { name: 'Tutoriais relacionados' });
    fireEvent.click(within(related).getByRole('button', { name: /Parametrização/ }));
    expect(screen.getByRole('navigation', { name: 'Tutoriais de Parametrização' })).toBeTruthy();
  });

  it('recupera uma busca vazia e devolve o foco ao limpar pelo botão', () => {
    render(<GuiaAjudaPage />);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'zzzinexistente' } });
    expect(screen.getByRole('heading', { name: 'Nenhum tutorial com esses termos' })).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Limpar busca' });
    clear.focus();
    fireEvent.click(clear);
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole('heading', { name: 'Um manual para cada módulo' })).toBeTruthy();
    fireEvent.change(search, { target: { value: '   ' } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('troca de módulo e retorna ao catálogo sem carregar um artigo do módulo anterior', () => {
    render(<GuiaAjudaPage />);
    fireEvent.click(screen.getByRole('button', { name: /Cadastre os parceiros/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Consultar outro módulo' }), { target: { value: 'documentos' } });
    expect(screen.getByRole('heading', { level: 2, name: 'Documentos' })).toBeTruthy();
    const breadcrumb = screen.getByRole('navigation', { name: 'Localização no manual' });
    fireEvent.click(within(breadcrumb).getByRole('button', { name: 'Todos os módulos' }));
    expect(screen.getByRole('heading', { name: 'Um manual para cada módulo' })).toBeTruthy();
  });

  it('mantém todos os roteiros completos e relacionados resolvidos no catálogo', () => {
    const ids = GUIDE_ARTICLES.map(({ article }) => article.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(HELP_DATA.map((module) => module.id)).size).toBe(13);
    for (const { article } of GUIDE_ARTICLES) {
      expect(article.prerequisites.length, article.id).toBeGreaterThan(0);
      expect(article.steps.length, article.id).toBeGreaterThanOrEqual(4);
      expect(article.verification.length, article.id).toBeGreaterThan(0);
      for (const related of article.related || []) expect(ids, article.id).toContain(related);
    }
    expect(searchGuide('OBRIGACOES')).toEqual(searchGuide('obrigações'));
    expect(searchGuide('   ')).toEqual([]);
  });
});
