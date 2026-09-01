/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/persistedStorage', () => ({
  persistedStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    subscribe: vi.fn(),
  },
}));

import { internalTabsStore } from './internalTabsStore';

describe('internalTabsStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    internalTabsStore.resetToInicio();
    vi.clearAllMocks();
  });

  it('does not notify or persist when a tab context update is unchanged', () => {
    internalTabsStore.openTab('documentos', 'Documentos', 'Folder', {
      data: { activeTab: 'meus' },
    });
    const tabId = internalTabsStore.getState().tabs[0]?.id;
    expect(tabId).toBeTruthy();

    const listener = vi.fn();
    const unsubscribe = internalTabsStore.subscribe(listener);

    internalTabsStore.updateTabContext(tabId!, { data: { activeTab: 'empresas' } });
    expect(listener).toHaveBeenCalledTimes(1);

    internalTabsStore.updateTabContext(tabId!, { data: { activeTab: 'empresas' } });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('notifies subscribers once for one local mutation', () => {
    const listener = vi.fn();
    const unsubscribe = internalTabsStore.subscribe(listener);

    internalTabsStore.openTab('agenda', 'Agenda', 'CalendarDays');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(internalTabsStore.getState().activeTabId).toBeDefined();
    unsubscribe();
  });

  it('isolates tab navigation per browser tab using sessionStorage', () => {
    internalTabsStore.openTab('documentos', 'Documentos', 'Folder');
    const storedState = sessionStorage.getItem('contabil_internal_tabs_state');
    expect(storedState).toBeTruthy();
    expect(JSON.parse(storedState!).activeTabId).toContain('documentos');
  });

  it('migrates legacy Rotinas, Acompanhamento and Obrigações tabs', async () => {
    sessionStorage.setItem('contabil_internal_tabs_state', JSON.stringify({
      persistEnabled: true,
      activeTabId: 'protocolos__legacy',
      tabs: [
        {
          id: 'protocolos__legacy',
          moduleId: 'protocolos',
          baseTitle: 'Protocolos e Documentos',
          title: 'Protocolos e Documentos / Empresa Alfa',
          iconName: 'FileCheck',
        },
        {
          id: 'atividades-modelos__legacy',
          moduleId: 'atividades-modelos',
          baseTitle: 'Rotinas e Modelos',
          title: 'Rotinas e Modelos / Empresa Alfa',
          iconName: 'Repeat',
        },
        {
          id: 'parametrizacao-checklists__legacy',
          moduleId: 'parametrizacao-checklists',
          baseTitle: 'Modelos de Checklists',
          title: 'Modelos de Checklists',
          iconName: 'ClipboardList',
        },
      ],
    }));
    vi.resetModules();

    const { internalTabsStore: hydratedStore } = await import('./internalTabsStore');

    expect(hydratedStore.getState().tabs).toEqual([
      expect.objectContaining({
        baseTitle: 'Acompanhamento',
        title: 'Acompanhamento / Empresa Alfa',
      }),
      expect.objectContaining({
        baseTitle: 'Rotinas',
        title: 'Rotinas / Empresa Alfa',
      }),
      expect.objectContaining({
        moduleId: 'parametrizacao-prazos-entrega',
        baseTitle: 'Obrigações',
        title: 'Obrigações',
      }),
    ]);
  });
});
