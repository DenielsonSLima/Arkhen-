import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistedStorageMock = vi.hoisted(() => ({
  values: new Map<string, string>(),
  listeners: new Set<(key: string) => void>(),
  getItem: vi.fn((key: string) => persistedStorageMock.values.get(key) || null),
  setItem: vi.fn((key: string, value: string) => {
    persistedStorageMock.values.set(key, value);
    persistedStorageMock.listeners.forEach((listener) => listener(key));
  }),
  subscribe: vi.fn((listener: (key: string) => void) => {
    persistedStorageMock.listeners.add(listener);
    return () => persistedStorageMock.listeners.delete(listener);
  }),
  emitExternal: (key: string, value: string) => {
    persistedStorageMock.values.set(key, value);
    persistedStorageMock.listeners.forEach((listener) => listener(key));
  },
}));

vi.mock('../lib/persistedStorage', () => ({
  persistedStorage: persistedStorageMock,
}));

import { internalTabsStore } from './internalTabsStore';

describe('internalTabsStore', () => {
  beforeEach(() => {
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
    vi.clearAllMocks();

    internalTabsStore.updateTabContext(tabId!, { data: { activeTab: 'empresas' } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persistedStorageMock.setItem).toHaveBeenCalledTimes(1);

    internalTabsStore.updateTabContext(tabId!, { data: { activeTab: 'empresas' } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persistedStorageMock.setItem).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('notifies subscribers once for one local mutation despite the synchronous storage echo', () => {
    const listener = vi.fn();
    const unsubscribe = internalTabsStore.subscribe(listener);

    internalTabsStore.openTab('agenda', 'Agenda', 'CalendarDays');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(persistedStorageMock.setItem).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('hydrates and notifies once when a genuinely different external snapshot arrives', () => {
    const listener = vi.fn();
    const unsubscribe = internalTabsStore.subscribe(listener);
    const externalState = {
      tabs: [{
        id: 'documentos__externo',
        moduleId: 'documentos',
        baseTitle: 'Documentos',
        title: 'Documentos',
        iconName: 'FolderOpen',
      }],
      activeTabId: 'documentos__externo',
      persistEnabled: true,
    };

    persistedStorageMock.emitExternal('contabil_internal_tabs_state', JSON.stringify(externalState));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(internalTabsStore.getState().activeTabId).toBe('documentos__externo');
    unsubscribe();
  });
});
