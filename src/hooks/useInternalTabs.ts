import { useCallback, useSyncExternalStore } from 'react';
import { internalTabsStore, type InternalTabContext } from '../stores/internalTabsStore';

export const useInternalTabs = () => {
  const state = useSyncExternalStore(
    internalTabsStore.subscribe,
    internalTabsStore.getState
  );
  const openTab = useCallback((id: string, title: string, iconName: string, context?: InternalTabContext) => {
    internalTabsStore.openTab(id, title, iconName, context);
  }, []);
  const activateModule = useCallback((id: string) => internalTabsStore.activateModule(id), []);
  const closeTab = useCallback((id: string) => internalTabsStore.closeTab(id), []);
  const activateTab = useCallback((id: string) => internalTabsStore.activateTab(id), []);
  const reorderTab = useCallback((sourceId: string, targetId: string) => {
    internalTabsStore.reorderTab(sourceId, targetId);
  }, []);
  const setPersistEnabled = useCallback((enabled: boolean) => {
    internalTabsStore.setPersistEnabled(enabled);
  }, []);
  const clearNotice = useCallback(() => internalTabsStore.clearNotice(), []);
  const updateTabContext = useCallback((id: string, context: InternalTabContext) => {
    internalTabsStore.updateTabContext(id, context);
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    persistEnabled: state.persistEnabled,
    notice: state.notice,
    openTab,
    activateModule,
    closeTab,
    activateTab,
    reorderTab,
    setPersistEnabled,
    clearNotice,
    updateTabContext,
  };
};
