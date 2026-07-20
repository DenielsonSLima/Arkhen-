import React, { Activity, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { persistedStorage } from '../../../lib/persistedStorage';
import { FloatingCalculator } from '../../../components/calculators/FloatingCalculator';
import { InternalTabBar } from '../../../components/tabs/InternalTabBar';
import { ModuleRenderErrorBoundary } from '../components/ModuleRenderErrorBoundary';
import { useModulosSistemaQuery } from '../configuracoes/modulos-sistema/hooks/useModulosSistema';
import { getEnabledModuleIds, isRouteEnabled } from '../configuracoes/modulos-sistema/services/moduleAccess';
import type { SystemModuleId } from '../configuracoes/modulos-sistema/services/modulosSistemaService';
import { TAB_INFOS } from './gestorTabMetadata';
import { GestorHeader } from './GestorHeader';
import { GestorModuleContent } from './GestorModuleContent';
import { GestorSidebar } from './GestorSidebar';
import { GestorShellLoading } from './GestorShellLoading';
import { useGestorGlobalSearch, type GlobalSearchResult } from './hooks/useGestorGlobalSearch';
import './GestorLayout.css';
import './GestorLayoutFixes.css';
import './GestorModuleTabs.css';
import './GestorSidebarCompact.css';

interface GestorLayoutProps {
  onLogout: () => void;
}

const INITIAL_MODULE_IDS = new Set<SystemModuleId>(['inicio']);

const DEFAULT_PROFILE = {
  nome: 'João Silva',
  email: 'joao.silva@arkhen.com.br',
  perfil: 'Administrador',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  googleLinked: false,
};

const readUserProfile = () => {
  try {
    const saved = persistedStorage.getItem('gestor_user_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  } catch (error) {
    console.error('Erro ao ler perfil do usuário:', error);
    return DEFAULT_PROFILE;
  }
};

export const GestorLayout: React.FC<GestorLayoutProps> = ({ onLogout }) => {
  const { tabs, activeTabId, openTab, activateModule, closeTab, updateTabContext } = useInternalTabs();
  const modulesQuery = useModulosSistemaQuery();
  const modulesReady = modulesQuery.isSuccess;
  const [moduleContexts, setModuleContexts] = useState<Record<string, InternalTabContext>>({});
  const [moduleContextVersions, setModuleContextVersions] = useState<Record<string, number>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [initialContentReady, setInitialContentReady] = useState(false);
  const [userProfile, setUserProfile] = useState(readUserProfile);
  const contentViewportRef = useRef<HTMLDivElement>(null);

  const enabledModuleIds = useMemo<Set<SystemModuleId>>(() => {
    if (!modulesReady || !modulesQuery.data) return INITIAL_MODULE_IDS;
    return getEnabledModuleIds(modulesQuery.data.modulos);
  }, [modulesQuery.data, modulesReady]);

  const globalSearch = useGestorGlobalSearch(enabledModuleIds, modulesReady);
  const activeOpenedTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs],
  );
  const requestedModuleId = activeOpenedTab?.moduleId || activeTabId;
  const activeModuleId = modulesReady && isRouteEnabled(requestedModuleId, enabledModuleIds)
    ? requestedModuleId
    : 'inicio';
  const activeWorkspaceId = activeOpenedTab?.id || activeTabId;
  const visibleTabs = useMemo(
    () => modulesReady
      ? tabs.filter((tab) => isRouteEnabled(tab.moduleId, enabledModuleIds))
      : [],
    [enabledModuleIds, modulesReady, tabs],
  );
  const activeVisibleTab = useMemo(
    () => visibleTabs.find((tab) => tab.id === activeTabId),
    [activeTabId, visibleTabs],
  );
  // A navegação comum não precisa preservar cópias ocultas de todos os módulos.
  // Somente abas internas permanecem montadas; isso evita duplicar Financeiro ou
  // Faturamento no exato momento em que o usuário os promove pelo botão "+".
  const mountedBaseModuleIds = activeVisibleTab ? [] : [activeModuleId];

  const resetContentScroll = useCallback(() => {
    const viewport = contentViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    // Não percorra todos os descendentes: módulos financeiros/documentais têm
    // árvores grandes, e getComputedStyle + métricas de layout em cada nó trava
    // a thread principal justamente ao promover o módulo para uma aba interna.
    const activePanel = viewport.querySelector<HTMLElement>('[data-active-module-panel="true"]');
    activePanel?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => setUserProfile(readUserProfile());
    window.addEventListener('profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('profile_updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    if (!modulesReady) return;
    tabs
      .filter((tab) => !isRouteEnabled(tab.moduleId, enabledModuleIds))
      .forEach((tab) => closeTab(tab.id));
    if (!isRouteEnabled(requestedModuleId, enabledModuleIds)) activateModule('inicio');
  }, [activateModule, closeTab, enabledModuleIds, modulesReady, requestedModuleId, tabs]);

  useEffect(() => {
    const baseTitle = 'Arkhen Gestão Contábil';
    if (activeOpenedTab && isRouteEnabled(activeOpenedTab.moduleId, enabledModuleIds)) {
      document.title = `${activeOpenedTab.title} | ${baseTitle}`;
      return;
    }
    const info = TAB_INFOS[activeModuleId];
    const context = moduleContexts[activeModuleId];
    let title = info?.title || activeModuleId;
    if (context?.titleSuffix) title = `${title} - ${context.titleSuffix}`;
    document.title = `${title.charAt(0).toUpperCase() + title.slice(1)} | ${baseTitle}`;
  }, [activeModuleId, activeOpenedTab, enabledModuleIds, moduleContexts]);

  useLayoutEffect(() => {
    resetContentScroll();
    const frame = window.requestAnimationFrame(resetContentScroll);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeModuleId, activeWorkspaceId, resetContentScroll]);

  useEffect(() => {
    window.addEventListener('gestor:reset-scroll', resetContentScroll);
    return () => window.removeEventListener('gestor:reset-scroll', resetContentScroll);
  }, [resetContentScroll]);

  useEffect(() => {
    if (!modulesReady || initialContentReady) return undefined;
    const timer = window.setTimeout(() => setInitialContentReady(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [initialContentReady, modulesReady]);

  const navigate = (id: string) => {
    if (!modulesReady || !isRouteEnabled(id, enabledModuleIds)) return;
    activateModule(id);
  };

  const openModuleTab = (event: React.MouseEvent | React.KeyboardEvent, id: string) => {
    event.stopPropagation();
    if (!modulesReady || !isRouteEnabled(id, enabledModuleIds)) return;
    const info = TAB_INFOS[id];
    const context = activeOpenedTab?.moduleId === id
      ? activeOpenedTab.context
      : activeModuleId === id ? moduleContexts[id] : undefined;
    openTab(id, info?.title || id, info?.iconName || 'Layers', context);
  };

  const handleModuleContextChange = useCallback((moduleId: string, context: InternalTabContext) => {
    setModuleContexts((current) => {
      if (JSON.stringify(current[moduleId] || {}) === JSON.stringify(context || {})) return current;
      return { ...current, [moduleId]: context };
    });
  }, []);

  const openMyProfile = () => {
    if (!modulesReady || !isRouteEnabled('configuracoes', enabledModuleIds)) return;
    sessionStorage.setItem('contabil_config_initial_subtab', 'meu-perfil');
    window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: 'meu-perfil' } }));
    navigate('configuracoes');
  };

  const selectGlobalSearch = (result: GlobalSearchResult) => {
    if (!modulesReady || !isRouteEnabled(result.moduleId, enabledModuleIds)) return;
    if (result.configSubTab) {
      sessionStorage.setItem('contabil_config_initial_subtab', result.configSubTab);
      window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: result.configSubTab } }));
    }
    if (result.context) {
      handleModuleContextChange(result.moduleId, result.context);
      setModuleContextVersions((current) => ({
        ...current,
        [result.moduleId]: (current[result.moduleId] || 0) + 1,
      }));
    }
    navigate(result.moduleId);
    globalSearch.setTerm('');
    globalSearch.setFocused(false);
  };

  const handleGlobalSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && globalSearch.results[0]) {
      event.preventDefault();
      selectGlobalSearch(globalSearch.results[0]);
    } else if (event.key === 'Escape') {
      globalSearch.setFocused(false);
    }
  };

  const currentUser = useMemo(() => ({
    id: 'u-gestor',
    nome: userProfile.nome,
    perfil: userProfile.perfil,
    setor: 'Gestão' as const,
    gestor: true,
    avatar: userProfile.avatar,
  }), [userProfile]);

  const handleInitialContentReady = useCallback(() => {
    setInitialContentReady(true);
  }, []);

  const renderContent = (
    id: string,
    workspaceId = id,
    context?: InternalTabContext,
    contextVersion = 0,
  ) => (
    <GestorModuleContent
      key={`${workspaceId}:${contextVersion}`}
      id={id}
      workspaceId={workspaceId}
      initialContext={context}
      updateTabContext={updateTabContext}
      onModuleContextChange={handleModuleContextChange}
      onInitialReady={id === 'inicio' && workspaceId === 'inicio' ? handleInitialContentReady : undefined}
    />
  );

  if (modulesQuery.isPending || (modulesQuery.isError && modulesQuery.isFetching)) {
    return <GestorShellLoading message="Identificando os módulos disponíveis..." />;
  }

  if (modulesQuery.isError) {
    return (
      <GestorShellLoading
        error
        message="Não foi possível identificar os módulos do sistema."
        onExit={onLogout}
        onRetry={() => { void modulesQuery.refetch(); }}
      />
    );
  }

  return (
    <div className="gestor-panel-container">
      <GestorSidebar
        activeModuleId={activeModuleId}
        enabledModuleIds={enabledModuleIds}
        userProfile={userProfile}
        onNavigate={navigate}
        onOpenTab={openModuleTab}
        onOpenProfile={openMyProfile}
        onLogout={() => setShowLogoutConfirm(true)}
      />
      <div className="gestor-main">
        <GestorHeader
          searchTerm={globalSearch.term}
          searchFocused={globalSearch.focused}
          searchLoading={globalSearch.query.isLoading}
          modulesReady={modulesReady}
          results={globalSearch.results}
          openSolicitacoesCount={0}
          onSearchTermChange={globalSearch.setTerm}
          onSearchFocusChange={globalSearch.setFocused}
          onSearchSelect={selectGlobalSearch}
          onSearchKeyDown={handleGlobalSearchKeyDown}
          onOpenHelp={() => {
            if (modulesReady) openTab('guia-ajuda', 'Guia de Navegação', 'Headphones');
          }}
        />
        {modulesReady && <InternalTabBar />}
        <main ref={contentViewportRef} className="gestor-content-viewport" style={{ position: 'relative' }}>
          {mountedBaseModuleIds.map((moduleId) => {
            const isActive = !activeVisibleTab && activeModuleId === moduleId;
            return (
              <Activity key={moduleId} mode={isActive ? 'visible' : 'hidden'}>
                <div data-active-module-panel={isActive ? 'true' : undefined} style={{ height: '100%' }}>
                  <ModuleRenderErrorBoundary moduleName={moduleId} onReset={() => activateModule('inicio')}>
                    {renderContent(
                      moduleId,
                      moduleId,
                      moduleContexts[moduleId],
                      moduleContextVersions[moduleId],
                    )}
                  </ModuleRenderErrorBoundary>
                </div>
              </Activity>
            );
          })}
          {visibleTabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <Activity key={tab.id} mode={isActive ? 'visible' : 'hidden'}>
                <div data-active-module-panel={isActive ? 'true' : undefined} style={{ height: '100%' }}>
                  <ModuleRenderErrorBoundary moduleName={tab.moduleId} onReset={() => activateModule('inicio')}>
                    {renderContent(tab.moduleId, tab.id, tab.context)}
                  </ModuleRenderErrorBoundary>
                </div>
              </Activity>
            );
          })}
        </main>
      </div>
      {showLogoutConfirm && (
        <div className="confirm-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-modal-container" onClick={(event) => event.stopPropagation()}>
            <h3 className="confirm-modal-title">Sair do Sistema</h3>
            <p className="confirm-modal-message">Deseja realmente registrar saída?</p>
            <div className="confirm-modal-buttons">
              <button className="confirm-btn confirm-btn-no" onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
              <button className="confirm-btn confirm-btn-yes" onClick={onLogout}>Confirmar e Sair</button>
            </div>
          </div>
        </div>
      )}
      <FloatingCalculator userId={currentUser.id} openInternalChatsCount={0} />
      {!initialContentReady ? (
        <GestorShellLoading overlay message="Preparando o painel inicial..." />
      ) : null}
    </div>
  );
};
