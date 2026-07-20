import { persistedStorage } from '../lib/persistedStorage';

export interface InternalTabContext {
  titleSuffix?: string;
  data?: Record<string, unknown>;
}

export interface InternalTab {
  id: string;
  moduleId: string;
  baseTitle: string;
  title: string;
  iconName: string;
  context?: InternalTabContext;
}

export interface InternalTabsState {
  tabs: InternalTab[];
  activeTabId: string;
  persistEnabled: boolean;
  notice: string | null;
}

const STORAGE_KEY = 'contabil_internal_tabs_state';
let tabSequence = 0;

// Estado inicial
let state: InternalTabsState = {
  tabs: [],
  activeTabId: 'inicio',
  persistEnabled: true,
  notice: null,
};

const getStoredTabsState = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessionData = window.sessionStorage.getItem(STORAGE_KEY);
      if (sessionData) return sessionData;
    }
    return persistedStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveStoredTabsState = (value: string): void => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch (e) {
    console.error('Erro ao salvar estado das abas:', e);
  }
};

const hydrateFromStorage = (raw: string | null) => {
  if (!raw) {
    if (state.tabs.length === 0 && state.activeTabId === 'inicio') return false;
    state = {
      tabs: [],
      activeTabId: 'inicio',
      persistEnabled: state.persistEnabled,
      notice: null,
    };
    return true;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;

    const nextState = { ...state };
    nextState.persistEnabled = parsed.persistEnabled !== false;
    if (nextState.persistEnabled) {
      const legacyIdMap = new Map<string, string>();
      nextState.tabs = Array.isArray(parsed.tabs)
        ? parsed.tabs.filter((tab: Partial<InternalTab>) => (
            typeof tab.id === 'string'
            && typeof tab.title === 'string'
            && typeof tab.iconName === 'string'
            && tab.id !== 'inicio'
          )).map((tab: InternalTab, index: number) => {
            const isLegacyTab = typeof tab.moduleId !== 'string';
            const moduleId = isLegacyTab ? tab.id : tab.moduleId;
            const id = isLegacyTab ? `${tab.id}__migrated_${index}` : tab.id;
            if (isLegacyTab) legacyIdMap.set(tab.id, id);
            return {
              id,
              moduleId,
              baseTitle: typeof tab.baseTitle === 'string' ? tab.baseTitle : tab.title,
              title: tab.title,
              iconName: tab.iconName,
              context: tab.context,
            };
          })
        : [];
      nextState.activeTabId = typeof parsed.activeTabId === 'string' ? parsed.activeTabId : 'inicio';
      nextState.activeTabId = legacyIdMap.get(nextState.activeTabId) || nextState.activeTabId;

      // Validação de segurança: se a aba ativa não estiver aberta (e não for especial), reseta para o início
      if (nextState.activeTabId !== 'inicio' && nextState.activeTabId.includes('__')) {
        const exists = nextState.tabs.some(tab => tab.id === nextState.activeTabId);
        if (!exists) {
          nextState.activeTabId = 'inicio';
        }
      }
    } else {
      nextState.tabs = [];
      nextState.activeTabId = 'inicio';
    }

    const currentSnapshot = JSON.stringify({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      persistEnabled: state.persistEnabled,
    });
    const nextSnapshot = JSON.stringify({
      tabs: nextState.tabs,
      activeTabId: nextState.activeTabId,
      persistEnabled: nextState.persistEnabled,
    });
    if (currentSnapshot === nextSnapshot) return false;

    state = nextState;
    return true;
  } catch (e) {
    console.error('Erro ao ler estado das abas persistidas:', e);
    return false;
  }
};

const listeners = new Set<() => void>();

const loadFromStorage = () => {
  const changed = hydrateFromStorage(getStoredTabsState());
  if (!changed) return;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
};

loadFromStorage();

function notify() {
  saveState();
  listeners.forEach((listener) => listener());
}

function setState(updater: (current: InternalTabsState) => InternalTabsState) {
  const nextState = updater(state);
  if (Object.is(nextState, state)) return;
  state = nextState;
  notify();
}

function saveState() {
  saveStoredTabsState(JSON.stringify({
    tabs: state.persistEnabled ? state.tabs : [],
    activeTabId: state.activeTabId,
    persistEnabled: state.persistEnabled,
  }));
}

function isSameContext(a?: InternalTabContext, b?: InternalTabContext) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

export const internalTabsStore = {
  getState(): InternalTabsState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setPersistEnabled(enabled: boolean) {
    setState(current => ({
      ...current,
      persistEnabled: enabled,
      tabs: enabled ? current.tabs : [],
      activeTabId: enabled ? current.activeTabId : 'inicio',
      notice: null,
    }));
  },

  clearNotice() {
    if (!state.notice) return;
    setState(current => ({ ...current, notice: null }));
  },

  resetToInicio() {
    setState(current => ({
      ...current,
      tabs: [],
      activeTabId: 'inicio',
      notice: null,
    }));
  },

  activateModule(moduleId: string) {
    setState(current => ({
      ...current,
      activeTabId: moduleId,
      notice: null,
    }));
  },

  openTab(moduleId: string, title: string, iconName: string, context?: InternalTabContext) {
    if (moduleId === 'inicio') {
      setState(current => ({ ...current, activeTabId: 'inicio', notice: null }));
      return;
    }

    // Verificar limite de 5 abas
    if (state.tabs.length >= 5) {
      setState(current => ({
        ...current,
        notice: 'Limite de 5 abas abertas. Feche uma para continuar.',
      }));
      return;
    }

    const duplicateCount = state.tabs.filter((tab) => tab.moduleId === moduleId).length;
    const id = `${moduleId}__${Date.now()}_${tabSequence++}`;

    // Adiciona nova aba
    setState(current => ({
      ...current,
      tabs: [
        ...current.tabs,
        {
          id,
          moduleId,
          baseTitle: title,
          title: context?.titleSuffix ? `${title} / ${context.titleSuffix}` : duplicateCount > 0 ? `${title} ${duplicateCount + 1}` : title,
          iconName,
          context,
        },
      ],
      activeTabId: id,
      notice: null,
    }));
  },

  updateTabContext(id: string, context: InternalTabContext) {
    setState(current => {
      const tab = current.tabs.find(item => item.id === id);
      if (!tab || isSameContext(tab.context, context)) return current;
      return {
        ...current,
        tabs: current.tabs.map(item => (
          item.id === id
            ? {
                ...item,
                context,
                title: context.titleSuffix ? `${item.baseTitle} / ${context.titleSuffix}` : item.baseTitle,
              }
            : item
        )),
      };
    });
  },

  closeTab(id: string) {
    setState(current => {
      const tabIndex = current.tabs.findIndex(tab => tab.id === id);
      if (tabIndex === -1) return current;

      const nextTabs = current.tabs.filter(tab => tab.id !== id);
      let nextActiveTabId = current.activeTabId;

      // Se a aba fechada era a ativa, ativa outra
      if (current.activeTabId === id) {
        if (nextTabs.length > 0) {
          // Ativa a aba mais próxima (ou a anterior, ou a primeira)
          const nextActiveIndex = Math.max(0, tabIndex - 1);
          nextActiveTabId = nextTabs[nextActiveIndex]?.id || 'inicio';
        } else {
          nextActiveTabId = 'inicio';
        }
      }

      return {
        ...current,
        tabs: nextTabs,
        activeTabId: nextActiveTabId,
        notice: null,
      };
    });
  },

  activateTab(id: string) {
    if (id === 'inicio') {
      setState(current => ({ ...current, activeTabId: id, notice: null }));
      return;
    }

    if (!state.tabs.some(tab => tab.id === id)) return;

    setState(current => ({
      ...current,
      activeTabId: id,
      notice: null,
    }));
  },

  reorderTab(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    setState(current => {
      const sourceIndex = current.tabs.findIndex(tab => tab.id === sourceId);
      const targetIndex = current.tabs.findIndex(tab => tab.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return current;

      const nextTabs = [...current.tabs];
      const [movedTab] = nextTabs.splice(sourceIndex, 1);
      nextTabs.splice(targetIndex, 0, movedTab);

      return {
        ...current,
        tabs: nextTabs,
        activeTabId: sourceId,
        notice: null,
      };
    });
  }
};
