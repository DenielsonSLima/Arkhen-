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
});
