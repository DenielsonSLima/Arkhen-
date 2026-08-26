/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SystemModuleId } from '../configuracoes/modulos-sistema/services/modulosSistemaService';
import { GestorSidebar } from './GestorSidebar';

vi.mock('../../../lib/persistedStorage', () => ({
  persistedStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

vi.mock('./services/sidebarPreferencesService', () => ({
  sidebarPreferencesService: {
    normalizeMenuOrder: (order: string[]) => order,
    getMenuOrder: vi.fn(() => Promise.resolve(null)),
    saveMenuOrder: vi.fn(() => Promise.resolve()),
  },
}));

const enabledModuleIds = new Set<SystemModuleId>([
  'inicio',
  'clientes',
  'atividades',
  'configuracoes',
]);

const renderSidebar = (activeModuleId = 'clientes') => {
  const callbacks = {
    onNavigate: vi.fn(),
    onOpenTab: vi.fn(),
    onOpenProfile: vi.fn(),
    onLogout: vi.fn(),
  };

  render(
    <GestorSidebar
      activeModuleId={activeModuleId}
      enabledModuleIds={enabledModuleIds}
      userProfile={{ nome: 'Ana Contadora', perfil: 'Administradora', avatar: '/avatar.png' }}
      {...callbacks}
    />,
  );

  return callbacks;
};

describe('GestorSidebar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('identifica a página ativa e expõe submenus por teclado', () => {
    const { onNavigate } = renderSidebar();
    const clientes = screen.getByRole('button', { name: 'Clientes' });
    const atividades = screen.getByRole('button', { name: 'Atividades' });

    expect(clientes.getAttribute('aria-current')).toBe('page');
    expect(atividades.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(atividades);
    expect(atividades.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Minha Fila' }));
    expect(onNavigate).toHaveBeenCalledWith('atividades');
  });

  it('abre o menu compacto e devolve o foco ao botão ao fechar com Escape', () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Abrir menu principal' });
    const navigation = screen.getByRole('navigation', { name: 'Módulos principais' });

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(navigation.classList.contains('is-mobile-open')).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Abrir menu principal' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('mantém perfil e saída como ações independentes', () => {
    const { onLogout, onOpenProfile } = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir meu perfil: Ana Contadora' }));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sair do sistema' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('dá nome acessível à ação de abrir módulo em outra aba', () => {
    const { onOpenTab } = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Clientes em nova aba' }));
    expect(onOpenTab).toHaveBeenCalledWith(expect.any(Object), 'clientes');
  });
});
