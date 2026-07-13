import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  Database,
  ClipboardList,
  Calculator,
  FolderOpen,
  FileCheck,
  Receipt,
  Landmark,
  CalendarDays,
  Settings,
  LogOut,
  Bell,
  Search,
  Calendar,
  Headphones,
  Plus,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ShieldCheck
} from 'lucide-react';

import { InicioPage } from '../inicio/InicioPage';
import { RegimesTributariosPage } from '../parametrizacao/regimes/RegimesTributariosPage';
import { CnaePage } from '../parametrizacao/cnae/CnaePage';
import { RegrasApuracaoPage } from '../parametrizacao/regras/RegrasApuracaoPage';
import { ParametrosCalculoPage } from '../parametrizacao/parametros-calculo/ParametrosCalculoPage';
import { PrazosEntregaPage } from '../parametrizacao/prazos-entrega/PrazosEntregaPage';
import { ProtocolosTiposPage } from '../parametrizacao/protocolos/ProtocolosTiposPage';
import { ParametrizacaoPlaceholderPage } from '../parametrizacao/catalogos/ParametrizacaoPlaceholderPage';
import { CategoriaClientePage } from '../parametrizacao/catalogos/CategoriaClientePage';
import { CategoriaFinanceiraPage } from '../parametrizacao/catalogos/CategoriaFinanceiraPage';
import { TiposDocumentosPage } from '../parametrizacao/catalogos/tipos-documentos/TiposDocumentosPage';
import { PastasPadraoPage } from '../parametrizacao/pastas-padrao/PastasPadraoPage';
import { GestaoEmpresarialPage } from '../gestao-empresarial/GestaoEmpresarialPage';
import type { EmpresaDetailTab } from '../gestao-empresarial/hooks/useGestaoEmpresarial';
import { AtividadesPage } from '../atividades/AtividadesPage';
import { ConfigFluxosPage } from '../atividades/config/ConfigFluxosPage';
import { PlanejamentoTributarioPage } from '../planejamento-tributario/PlanejamentoTributarioPage';
import { SimulacoesCalculosPage } from '../simulacoes-calculos/SimulacoesCalculosPage';
import type { DocumentosTab } from '../documentos/hooks/useDocumentos';
import { ConformidadePage } from '../conformidade/ConformidadePage';
import { ProtocolosPage } from '../protocolos/ProtocolosPage';
import { FinanceiroPage } from '../financeiro/FinanceiroPage';
import { FaturamentoPage, type FaturamentoTab, type FaturamentoViewMode } from '../faturamento/FaturamentoPage';
import { AgendaPage } from '../agenda/AgendaPage';
import { RelatoriosPage } from '../relatorios/RelatoriosPage';
import { ConfiguracoesPage } from '../configuracoes/ConfiguracoesPage';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { FloatingCalculator } from '../../../components/calculators/FloatingCalculator';
import { InternalTabBar } from '../../../components/tabs/InternalTabBar';
import { TAB_DRAG_MIME, type TabDragPayload } from '../../../components/tabs/tabDragData';
import { TAB_INFOS } from './gestorTabMetadata';
import { GuiaAjudaPage } from '../guia-ajuda/GuiaAjudaPage';
import { ModuleRenderErrorBoundary } from '../components/ModuleRenderErrorBoundary';
import { sidebarPreferencesService } from './services/sidebarPreferencesService';
import { documentosService } from '../documentos/services/documentosService';
import type { Company, CompanyDocument } from '../gestao-empresarial/services/gestaoEmpresarialService';

import systemLogoImg from '../../../assets/camada-o.png';
import './GestorLayout.css';
import './GestorLayoutFixes.css';
import './GestorModuleTabs.css';

const DocumentosPage = React.lazy(() => import('../documentos/DocumentosPage').then((module) => ({ default: module.DocumentosPage })));
const DEFAULT_MENU_ORDER = [
  'inicio',
  'clientes',
  'atividades',
  'conformidade',
  'protocolos',
  'simulacoes-calculos',
  'faturamento',
  'financeiro',
  'documentos',
  'agenda',
  'parametrizacao',
  'configuracoes',
];
const ALL_MENU_IDS = [...DEFAULT_MENU_ORDER];

type GlobalSearchResult = {
  id: string;
  label: string;
  description: string;
  type: 'Módulo' | 'Cliente' | 'Documento' | 'Configuração';
  moduleId: string;
  context?: InternalTabContext;
  configSubTab?: string;
};

interface GestorLayoutProps {
  onLogout: () => void;
}

export const GestorLayout: React.FC<GestorLayoutProps> = ({ onLogout }) => {
  const { tabs, activeTabId, openTab, activateModule, updateTabContext } = useInternalTabs();
  const [isCadastrosExpanded, setIsCadastrosExpanded] = useState(false);
  const [isAtividadesExpanded, setIsAtividadesExpanded] = useState(false);
  const [moduleContexts, setModuleContexts] = useState<Record<string, InternalTabContext>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isGlobalSearchFocused, setIsGlobalSearchFocused] = useState(false);
  const [draggedSidebarIndex, setDraggedSidebarIndex] = useState<number | null>(null);
  const [isReadyToDragSidebar, setIsReadyToDragSidebar] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('gestor_user_profile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (error) {
          console.error('Erro ao parsear perfil do usuário:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao ler perfil do usuário:', error);
    }

    return {
      nome: 'João Silva',
      email: 'joao.silva@arkhen.com.br',
      perfil: 'Administrador',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      googleLinked: false,
    };
  });

  useEffect(() => {
    const resetSidebarDragState = () => {
      if (draggedSidebarIndex !== null) {
        setDraggedSidebarIndex(null);
      }
      if (isReadyToDragSidebar) {
        setIsReadyToDragSidebar(false);
      }
    };

    window.addEventListener('mouseup', resetSidebarDragState);
    window.addEventListener('touchend', resetSidebarDragState);
    window.addEventListener('dragend', resetSidebarDragState);

    return () => {
      window.removeEventListener('mouseup', resetSidebarDragState);
      window.removeEventListener('touchend', resetSidebarDragState);
      window.removeEventListener('dragend', resetSidebarDragState);
    };
  }, [draggedSidebarIndex, isReadyToDragSidebar]);



  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const saved = localStorage.getItem('gestor_user_profile');
        if (saved) {
          try {
            setUserProfile(JSON.parse(saved));
          } catch (error) {
            console.error('Erro ao atualizar perfil do usuário:', error);
          }
        }
      } catch (error) {
        console.error('Erro ao ler evento de atualização de perfil:', error);
      }
    };

    window.addEventListener('profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile_updated', handleProfileUpdate);
    };
  }, []);

  const currentUser = useMemo(
    () => ({
      id: 'u-gestor',
      nome: userProfile.nome,
      perfil: userProfile.perfil,
      setor: 'Gestão' as const,
      gestor: true,
      avatar: userProfile.avatar,
    }),
    [userProfile],
  );
  const openSolicitacoesCount = 0;
  const openInternalChatsCount = 0;
  const normalizedGlobalSearch = globalSearchTerm.trim().toLowerCase();

  const globalSearchQuery = useQuery({
    queryKey: ['gestor-global-search-index'],
    queryFn: async () => {
      const [companies, personalDocs, companyDocs] = await Promise.all([
        documentosService.listCompanies(),
        documentosService.listPersonalDocumentos(),
        documentosService.listCompanyDocumentos(),
      ]);
      return { companies, personalDocs, companyDocs };
    },
    staleTime: 2 * 60 * 1000,
    enabled: normalizedGlobalSearch.length >= 2,
  });

  const activeOpenedTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs],
  );
  const activeModuleId = activeOpenedTab?.moduleId || activeTabId;
  const activeWorkspaceId = activeOpenedTab?.id || activeTabId;
  const contentViewportRef = useRef<HTMLDivElement>(null);
  const resetContentScroll = useCallback(() => {
    const viewport = contentViewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    viewport.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const activePanel = viewport.querySelector<HTMLElement>('[data-active-module-panel="true"]');
    const scrollRoot = activePanel || viewport;
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;

    scrollRoot.querySelectorAll<HTMLElement>('*').forEach((element) => {
      const style = window.getComputedStyle(element);
      const canScrollY = element.scrollHeight > element.clientHeight && ['auto', 'scroll'].includes(style.overflowY);
      const canScrollX = element.scrollWidth > element.clientWidth && ['auto', 'scroll'].includes(style.overflowX);

      if (canScrollY) element.scrollTop = 0;
      if (canScrollX) element.scrollLeft = 0;
    });
  }, []);

  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    if (normalizedGlobalSearch.length < 2) return [];
    const source = globalSearchQuery.data;
    const includes = (value?: string | null) => (
      String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
        normalizedGlobalSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      )
    );
    const documentResult = (doc: CompanyDocument, description: string): GlobalSearchResult => ({
      id: `doc-${doc.id}`,
      label: doc.nome,
      description,
      type: 'Documento',
      moduleId: 'documentos',
      context: {
        titleSuffix: 'Todos os Documentos',
        data: { activeTab: 'todos' },
      },
    });
    const moduleResults: GlobalSearchResult[] = Object.values(TAB_INFOS)
      .filter((item) => includes(item.title))
      .slice(0, 4)
      .map((item) => ({
        id: `module-${item.title}`,
        label: item.title,
        description: 'Abrir módulo do sistema',
        type: 'Módulo',
        moduleId: Object.entries(TAB_INFOS).find(([, info]) => info.title === item.title)?.[0] || 'inicio',
      }));
    const configResults: GlobalSearchResult[] = [
      ['integracao-bancaria', 'Integrações Bancárias', 'Asaas, Pix, boleto, checkout e webhooks'],
      ['contas-bancarias', 'Contas Bancárias', 'Bancos, agências, contas e saldos'],
      ['empresa', 'Dados da Empresa', 'CNPJ, endereço, logo e contato'],
      ['usuarios', 'Gestão de Usuários', 'Usuários, convites e perfis'],
      ['compartilhamento', 'Compartilhamento de Docs', 'Links, senhas e expiração'],
    ]
      .filter(([, label, description]) => includes(label) || includes(description))
      .map(([subTab, label, description]) => ({
        id: `config-${subTab}`,
        label,
        description,
        type: 'Configuração',
        moduleId: 'configuracoes',
        configSubTab: subTab,
      }));
    const companyResults = (source?.companies || [])
      .filter((company: Company) => includes(company.nome) || includes(company.razaoSocial) || includes(company.cnpj))
      .slice(0, 5)
      .map((company: Company) => ({
        id: `company-${company.id}`,
        label: company.nome,
        description: `${company.cnpj} • ${company.status}`,
        type: 'Cliente' as const,
        moduleId: 'clientes',
        context: {
          titleSuffix: company.nome,
          data: { selectedCompanyId: company.id },
        },
      }));
    const personalDocs = (source?.personalDocs || [])
      .filter((doc: CompanyDocument) => includes(doc.nome) || includes(doc.tipo) || includes(doc.pasta))
      .slice(0, 4)
      .map((doc: CompanyDocument) => documentResult(doc, `${doc.tipo || 'Documento'} • Biblioteca`));
    const companyDocs = (source?.companyDocs || [])
      .filter((doc: CompanyDocument) => includes(doc.nome) || includes(doc.tipo) || includes(doc.pasta))
      .slice(0, 4)
      .map((doc: CompanyDocument) => documentResult(doc, `${doc.tipo || 'Documento'} • Empresa`));

    return [...moduleResults, ...configResults, ...companyResults, ...personalDocs, ...companyDocs].slice(0, 10);
  }, [globalSearchQuery.data, normalizedGlobalSearch]);

  useEffect(() => {
    const baseTitle = 'Arkhen Gestão Contábil';
    if (activeOpenedTab) {
      document.title = `${activeOpenedTab.title} | ${baseTitle}`;
    } else {
      const info = TAB_INFOS[activeModuleId];
      const context = moduleContexts[activeModuleId];
      let title = info ? info.title : activeModuleId;
      if (context?.titleSuffix) {
        title = `${title} - ${context.titleSuffix}`;
      }
      const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);
      document.title = `${capitalizedTitle} | ${baseTitle}`;
    }
  }, [activeOpenedTab, activeModuleId, moduleContexts]);

  useEffect(() => {
    if (activeModuleId === 'atividades' || activeModuleId.startsWith('atividades-')) {
      setIsAtividadesExpanded(true);
    }
  }, [activeModuleId]);



  const headerDate = useMemo(() => {
    const now = new Date();
    return {
      full: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      weekday: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
    };
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('arkhen_sidebar_menu_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return sidebarPreferencesService.normalizeMenuOrder(parsed, ALL_MENU_IDS, DEFAULT_MENU_ORDER);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_MENU_ORDER;
  });

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    sidebarPreferencesService.getMenuOrder(ALL_MENU_IDS, DEFAULT_MENU_ORDER)
      .then((remoteOrder) => {
        if (!mounted || !remoteOrder) return;
        setMenuOrder(remoteOrder);
        localStorage.setItem('arkhen_sidebar_menu_order', JSON.stringify(remoteOrder));
      })
      .catch((error) => {
        console.error('Erro ao carregar ordem da sidebar:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSidebarDragStart = (e: React.DragEvent, index: number) => {
    if (!isReadyToDragSidebar) {
      return;
    }

    setDraggedSidebarIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleSidebarDragOver = (e: React.DragEvent, index: number) => {
    if (draggedSidebarIndex === null) return;
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleSidebarDrop = (e: React.DragEvent, index: number) => {
    if (draggedSidebarIndex === null) return;
    e.preventDefault();
    
    if (draggedSidebarIndex !== index) {
      const newOrder = [...menuOrder];
      const [draggedItem] = newOrder.splice(draggedSidebarIndex, 1);
      newOrder.splice(index, 0, draggedItem);
      const normalizedOrder = sidebarPreferencesService.normalizeMenuOrder(newOrder, ALL_MENU_IDS, DEFAULT_MENU_ORDER);

      setMenuOrder(normalizedOrder);
      localStorage.setItem('arkhen_sidebar_menu_order', JSON.stringify(normalizedOrder));
      void sidebarPreferencesService.saveMenuOrder(normalizedOrder, ALL_MENU_IDS, DEFAULT_MENU_ORDER).catch((error) => {
        console.error('Erro ao salvar ordem da sidebar:', error);
      });
    }
    setDraggedSidebarIndex(null);
    setDragOverIndex(null);
  };

  const handleSidebarDragEnd = () => {
    setDraggedSidebarIndex(null);
    setDragOverIndex(null);
  };

  const menuItemsMap: Record<string, { id: string; label: string; icon: React.ReactNode }> = {
    inicio: { id: 'inicio', label: 'Início', icon: <LayoutDashboard size={20} /> },
    clientes: { id: 'clientes', label: 'Clientes', icon: <Building2 size={20} /> },
    parametrizacao: { id: 'parametrizacao', label: 'Parametrização', icon: <Database size={20} /> },
    atividades: { id: 'atividades', label: 'Atividades', icon: <ClipboardList size={20} /> },
    conformidade: { id: 'conformidade', label: 'Conformidade', icon: <ShieldCheck size={20} /> },
    'simulacoes-calculos': { id: 'simulacoes-calculos', label: 'Simulações e Cálculos', icon: <Calculator size={20} /> },
    documentos: { id: 'documentos', label: 'Documentos', icon: <FolderOpen size={20} /> },
    protocolos: { id: 'protocolos', label: 'Protocolos e Documentos', icon: <FileCheck size={20} /> },
    faturamento: { id: 'faturamento', label: 'Faturamento', icon: <Receipt size={20} /> },
    financeiro: { id: 'financeiro', label: 'Financeiro', icon: <Landmark size={20} /> },
    agenda: { id: 'agenda', label: 'Agenda', icon: <CalendarDays size={20} /> },
    configuracoes: { id: 'configuracoes', label: 'Configurações', icon: <Settings size={20} /> },
  };

  const menuItems = menuOrder.map(id => menuItemsMap[id]).filter(Boolean);

  const getSidebarItemStyle = (index: number) => {
    const isDragged = draggedSidebarIndex === index;
    const isDragOver = dragOverIndex === index && draggedSidebarIndex !== index;
    return {
      opacity: isDragged ? 0.4 : 1,
      borderTop: isDragOver ? '2px solid var(--color-gold-primary)' : '2px solid transparent',
      transition: 'all 0.15s ease',
      cursor: draggedSidebarIndex !== null ? 'grabbing' : 'grab',
    };
  };

  const parametrizacaoItems = [
    { id: 'parametrizacao-regimes', label: 'Regimes Tributários' },
    { id: 'parametrizacao-protocolos', label: 'Catálogo de Obrigações' },
    { id: 'parametrizacao-tipos-empresa', label: 'Tipos de Empresa' },
    { id: 'parametrizacao-natureza-juridica', label: 'Natureza Jurídica' },
    { id: 'parametrizacao-tipos-parceiros', label: 'Tipos de Parceiros' },
    { id: 'parametrizacao-categorias-clientes', label: 'Categorias de Clientes' },
    { id: 'parametrizacao-cnae', label: 'CNAE' },
    { id: 'parametrizacao-regras', label: 'Impostos' },
    { id: 'parametrizacao-parametros-calculo', label: 'Parâmetros de Cálculo' },
    { id: 'parametrizacao-prazos-entrega', label: 'Obrigações' },
    { id: 'parametrizacao-documentos', label: 'Tipos de Documentos' },
    { id: 'parametrizacao-pastas-padrao', label: 'Pastas Padrão' },
    { id: 'parametrizacao-checklists', label: 'Modelos de Checklists' },
    { id: 'parametrizacao-categoria-financeira', label: 'Categorias Financeiras' },
  ];
  const atividadesItems = [
    { id: 'atividades', label: 'Minha Fila' },
    { id: 'atividades-equipe', label: 'Equipe' },
    { id: 'atividades-fechamentos', label: 'Fechamentos de Clientes' },
    { id: 'atividades-modelos', label: 'Rotinas e Modelos' },
    { id: 'atividades-painel-operacional', label: 'Painel Operacional' },
  ];



  const handleNavigate = (id: string) => {
    activateModule(id);
    resetContentScroll();
    window.setTimeout(resetContentScroll, 0);
  };

  const handleOpenMyProfile = () => {
    sessionStorage.setItem('contabil_config_initial_subtab', 'meu-perfil');
    window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: 'meu-perfil' } }));
    activateModule('configuracoes');
    resetContentScroll();
    window.setTimeout(resetContentScroll, 0);
  };

  const handleGlobalSearchSelect = (result: GlobalSearchResult) => {
    if (result.configSubTab) {
      sessionStorage.setItem('contabil_config_initial_subtab', result.configSubTab);
      window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: result.configSubTab } }));
    }

    if (result.context) {
      handleModuleContextChange(result.moduleId, result.context);
    }

    activateModule(result.moduleId);
    resetContentScroll();
    window.setTimeout(resetContentScroll, 0);
    setGlobalSearchTerm('');
    setIsGlobalSearchFocused(false);
  };

  const handleGlobalSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && globalSearchResults[0]) {
      event.preventDefault();
      handleGlobalSearchSelect(globalSearchResults[0]);
    }

    if (event.key === 'Escape') {
      setIsGlobalSearchFocused(false);
    }
  };

  useLayoutEffect(() => {
    resetContentScroll();
    const frame = window.requestAnimationFrame(resetContentScroll);
    const timer = window.setTimeout(resetContentScroll, 60);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [activeModuleId, activeWorkspaceId, resetContentScroll]);

  useEffect(() => {
    window.addEventListener('gestor:reset-scroll', resetContentScroll);
    return () => {
      window.removeEventListener('gestor:reset-scroll', resetContentScroll);
    };
  }, [resetContentScroll]);

  const handleOpenModuleTab = (event: React.MouseEvent | React.KeyboardEvent, id: string) => {
    event.stopPropagation();
    const info = TAB_INFOS[id];
    const context = activeOpenedTab?.moduleId === id
      ? activeOpenedTab.context
      : activeModuleId === id ? moduleContexts[id] : undefined;
    if (info) {
      openTab(id, info.title, info.iconName, context);
    } else {
      openTab(id, id, 'Layers');
    }
    resetContentScroll();
    window.setTimeout(resetContentScroll, 0);
  };

  const handleModuleDragStart = (event: React.DragEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    const info = TAB_INFOS[id];
    if (!info) return;

    const payload: TabDragPayload = {
      id,
      title: info.title,
      iconName: info.iconName,
    };

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', info.title);
  };

  const handleModuleContextChange = (moduleId: string, context: InternalTabContext) => {
    setModuleContexts((current) => {
      if (JSON.stringify(current[moduleId] || {}) === JSON.stringify(context || {})) return current;
      return { ...current, [moduleId]: context };
    });
  };

  const renderTabContent = (id: string, workspaceId = id, initialContext?: InternalTabContext) => {
    const onContextChange = (context: InternalTabContext) => {
      if (workspaceId.includes('__')) {
        updateTabContext(workspaceId, context);
      } else {
        handleModuleContextChange(id, context);
      }
    };

    switch (id) {
      case 'inicio':
        return <InicioPage />;
      case 'clientes':
        return (
          <GestaoEmpresarialPage
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
            initialDetailTab={initialContext?.data?.activeDetailTab as EmpresaDetailTab | undefined}
            onViewContextChange={onContextChange}
          />
        );
      case 'parametrizacao-regimes':
        return <RegimesTributariosPage />;
      case 'parametrizacao-tipos-empresa':
        return <ParametrizacaoPlaceholderPage kind="tipos-empresa" />;
      case 'parametrizacao-natureza-juridica':
        return <ParametrizacaoPlaceholderPage kind="natureza-juridica" />;
      case 'parametrizacao-tipos-parceiros':
        return <ParametrizacaoPlaceholderPage kind="tipos-parceiros" />;
      case 'parametrizacao-categorias-clientes':
        return <CategoriaClientePage />;
      case 'parametrizacao-categoria-financeira':
        return <CategoriaFinanceiraPage />;
      case 'parametrizacao-cnae':
        return <CnaePage />;
      case 'parametrizacao-regras':
        return <RegrasApuracaoPage />;
      case 'parametrizacao-documentos':
        return <TiposDocumentosPage />;
      case 'parametrizacao-pastas-padrao':
        return <PastasPadraoPage />;
      case 'parametrizacao-parametros-calculo':
        return <ParametrosCalculoPage />;
      case 'parametrizacao-prazos-entrega':
        return <PrazosEntregaPage />;
      case 'parametrizacao-protocolos':
        return <ProtocolosTiposPage />;
      case 'parametrizacao-checklists':
        return <ConfigFluxosPage />;
      case 'atividades':
        return (
          <AtividadesPage
            view={(initialContext?.data?.activeView as string | undefined) || 'minha-fila'}
            initialQueueFilter={initialContext?.data?.queueFilter as any}
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
            initialCompetencia={initialContext?.data?.selectedCompetencia as string | undefined}
          />
        );
      case 'atividades-diarias':
      case 'atividades-painel':
      case 'atividades-resumo':
        return <AtividadesPage view="minha-fila" initialQueueFilter="hoje" />;
      case 'atividades-semanais':
      case 'atividades-agenda':
        return <AtividadesPage view="minha-fila" initialQueueFilter="semana" />;
      case 'atividades-mensais':
        return <AtividadesPage view="minha-fila" initialQueueFilter="mes" />;
      case 'atividades-internas':
        return <AtividadesPage view="minha-fila" initialQueueFilter="internas" />;
      case 'atividades-fechamentos':
      case 'atividades-empresa':
        return (
          <AtividadesPage
            view="fechamentos"
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
            initialCompetencia={initialContext?.data?.selectedCompetencia as string | undefined}
          />
        );
      case 'atividades-equipe':
      case 'atividades-funcionario':
        return <AtividadesPage view="equipe" />;
      case 'atividades-modelos':
      case 'atividades-rotinas':
        return <AtividadesPage view="modelos" />;
      case 'atividades-painel-operacional':
      case 'atividades-controle':
      case 'atividades-controle-andamento':
        return <AtividadesPage view="painel" />;
      case 'gestao-empresarial':
        return <GestaoEmpresarialPage />;
      case 'planejamento-tributario':
        return <PlanejamentoTributarioPage />;
      case 'simulacoes-calculos':
        return <SimulacoesCalculosPage />;
      case 'agenda':
        return <AgendaPage />;
      case 'protocolos':
        return <ProtocolosPage />;
      case 'conformidade':
        return (
          <ConformidadePage
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
          />
        );
      case 'documentos':
        return (
          <React.Suspense
            fallback={(
              <div className="submodule-content-card" style={{ textAlign: 'center', color: '#64748b' }}>
                Carregando documentos...
              </div>
            )}
          >
            <DocumentosPage
              initialActiveTab={initialContext?.data?.activeTab as DocumentosTab | undefined}
              initialPersonalFolder={initialContext?.data?.personalFolder as string | null | undefined}
              initialCompanyId={initialContext?.data?.selectedCompanyId as string | null | undefined}
              onViewContextChange={onContextChange}
            />
          </React.Suspense>
        );
      case 'faturamento':
        return (
          <FaturamentoPage
            initialActiveTab={initialContext?.data?.activeTab as FaturamentoTab | undefined}
            initialViewMode={initialContext?.data?.viewMode as FaturamentoViewMode | undefined}
            onViewContextChange={onContextChange}
          />
        );
      case 'financeiro':
      case 'financeiro-caixa':
      case 'financeiro-receber':
      case 'financeiro-pagar':
      case 'financeiro-transferencias':
      case 'financeiro-creditos':
      case 'financeiro-debitos':
        const subTab = activeModuleId.startsWith('financeiro-')
          ? activeModuleId.replace('financeiro-', '')
          : undefined;
        return <FinanceiroPage initialTab={subTab} />;
      case 'relatorios':
        return <RelatoriosPage />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
      case 'guia-ajuda':
        return <GuiaAjudaPage />;
      default:
        return <InicioPage />;
    }
  };

  return (
    <div className="gestor-panel-container">
      <aside className="gestor-sidebar">
        <div className="sidebar-brand">
          <img src={systemLogoImg} alt="Brand logo" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <h3>Arkhen</h3>
            <span>Gestão Contábil</span>
          </div>
        </div>

        <nav className={`sidebar-menu ${draggedSidebarIndex !== null ? 'dragging-active' : ''}`}>
          {menuItems.map((item, index) => {
            if (item.id === 'parametrizacao') {
              const isActive = activeModuleId.startsWith('parametrizacao-');
              return (
                <div
                  key={item.id}
                  className="menu-collapsible-container"
                  draggable={isReadyToDragSidebar}
                  onDragStart={(e) => {
                    handleSidebarDragStart(e, index);
                    setIsReadyToDragSidebar(false);
                  }}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDrop={(e) => {
                    handleSidebarDrop(e, index);
                    setIsReadyToDragSidebar(false);
                  }}
                  onDragEnd={() => {
                    handleSidebarDragEnd();
                    setIsReadyToDragSidebar(false);
                  }}
                  style={getSidebarItemStyle(index)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div
                      className="sidebar-drag-handle"
                      onMouseDown={() => setIsReadyToDragSidebar(true)}
                      onMouseUp={() => setIsReadyToDragSidebar(false)}
                      onMouseLeave={() => setIsReadyToDragSidebar(false)}
                      style={{
                        cursor: 'grab',
                        padding: '8px 2px 8px 6px',
                        color: 'rgba(255, 255, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <GripVertical size={14} />
                    </div>
                    <button
                      onClick={() => {
                        setIsCadastrosExpanded(!isCadastrosExpanded);
                      }}
                      className={`menu-btn ${isActive ? 'active' : ''}`}
                      style={{ justifyContent: 'space-between', flex: 1 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <span className="expand-chevron" style={{ display: 'flex', alignItems: 'center' }}>
                        {isCadastrosExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>
                  </div>
                  {isCadastrosExpanded && (
                    <div className="sidebar-submenu-list animate-slide-down">
                      {parametrizacaoItems.map((subItem) => (
                        <div key={subItem.id} className="submenu-action-row">
                          <button
                            type="button"
                            onClick={() => handleNavigate(subItem.id)}
                            draggable
                            onDragStart={(event) => handleModuleDragStart(event, subItem.id)}
                            className={`submenu-btn ${activeModuleId === subItem.id ? 'active' : ''}`}
                          >
                            <span className="submenu-dot"></span>
                            <span>{subItem.label}</span>
                          </button>
                          <button
                            type="button"
                            className="sidebar-open-tab-btn submenu-open-tab-btn"
                            title="Abrir em nova aba"
                            onClick={(event) => handleOpenModuleTab(event, subItem.id)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (item.id === 'atividades') {
              const isActive = activeModuleId === 'atividades' || activeModuleId.startsWith('atividades-');
              return (
                <div
                  key={item.id}
                  className="menu-collapsible-container"
                  draggable={isReadyToDragSidebar}
                  onDragStart={(e) => {
                    handleSidebarDragStart(e, index);
                    setIsReadyToDragSidebar(false);
                  }}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDrop={(e) => {
                    handleSidebarDrop(e, index);
                    setIsReadyToDragSidebar(false);
                  }}
                  onDragEnd={() => {
                    handleSidebarDragEnd();
                    setIsReadyToDragSidebar(false);
                  }}
                  style={getSidebarItemStyle(index)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div
                      className="sidebar-drag-handle"
                      onMouseDown={() => setIsReadyToDragSidebar(true)}
                      onMouseUp={() => setIsReadyToDragSidebar(false)}
                      onMouseLeave={() => setIsReadyToDragSidebar(false)}
                      style={{
                        cursor: 'grab',
                        padding: '8px 2px 8px 6px',
                        color: 'rgba(255, 255, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <GripVertical size={14} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAtividadesExpanded(!isAtividadesExpanded)}
                      className={`menu-btn ${isActive ? 'active' : ''}`}
                      style={{ justifyContent: 'space-between', flex: 1 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <span className="expand-chevron" style={{ display: 'flex', alignItems: 'center' }}>
                        {isAtividadesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>
                  </div>
                  {isAtividadesExpanded && (
                    <div className="sidebar-submenu-list animate-slide-down">
                      {atividadesItems.map((subItem) => (
                        <div key={subItem.id} className="submenu-action-row">
                          <button
                            type="button"
                            onClick={() => handleNavigate(subItem.id)}
                            draggable
                            onDragStart={(event) => handleModuleDragStart(event, subItem.id)}
                            className={`submenu-btn ${activeModuleId === subItem.id ? 'active' : ''}`}
                          >
                            <span className="submenu-dot"></span>
                            <span>{subItem.label}</span>
                          </button>
                          <button
                            type="button"
                            className="sidebar-open-tab-btn submenu-open-tab-btn"
                            title="Abrir em nova aba"
                            onClick={(event) => handleOpenModuleTab(event, subItem.id)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }


            return (
              <div
                key={item.id}
                className="menu-action-row"
                draggable={isReadyToDragSidebar}
                onDragStart={(e) => {
                  handleSidebarDragStart(e, index);
                  setIsReadyToDragSidebar(false);
                }}
                onDragOver={(e) => handleSidebarDragOver(e, index)}
                onDrop={(e) => {
                  handleSidebarDrop(e, index);
                  setIsReadyToDragSidebar(false);
                }}
                onDragEnd={() => {
                  handleSidebarDragEnd();
                  setIsReadyToDragSidebar(false);
                }}
                style={getSidebarItemStyle(index)}
              >
                <div
                  className="sidebar-drag-handle"
                  onMouseDown={() => setIsReadyToDragSidebar(true)}
                  onMouseUp={() => setIsReadyToDragSidebar(false)}
                  onMouseLeave={() => setIsReadyToDragSidebar(false)}
                  style={{
                    cursor: 'grab',
                    padding: '8px 2px 8px 6px',
                    color: 'rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <GripVertical size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  draggable
                  onDragStart={(event) => handleModuleDragStart(event, item.id)}
                  className={`menu-btn ${activeModuleId === item.id ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {'badge' in item && Number(item.badge || 0) > 0 && (
                    <span className="menu-notification-dot" aria-label={`${Number(item.badge || 0)} solicitações abertas`}>
                      {Number(item.badge || 0)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="sidebar-open-tab-btn menu-open-tab-btn"
                  title="Abrir em nova aba"
                  onClick={(event) => handleOpenModuleTab(event, item.id)}
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div
            role="button"
            tabIndex={0}
            className="sidebar-profile"
            onClick={handleOpenMyProfile}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOpenMyProfile();
              }
            }}
            title="Abrir meu perfil"
          >
            <img
              src={userProfile.avatar}
              alt="Profile Avatar"
              className="profile-avatar"
              style={{ objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
            <div className="profile-info">
              <h4>{userProfile.nome}</h4>
              <div className="profile-role-status">
                <span className="profile-role">{userProfile.perfil}</span>
                <span className="profile-status-dot"></span>
                <span className="profile-status-text">Online</span>
              </div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleLogoutClick();
              }}
              className="sidebar-logout-btn"
              title="Sair do Sistema"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="gestor-main">
        <header className="gestor-header">
          <div className="header-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar clientes, empresas, documentos..."
              value={globalSearchTerm}
              onChange={(event) => setGlobalSearchTerm(event.target.value)}
              onFocus={() => setIsGlobalSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setIsGlobalSearchFocused(false), 120)}
              onKeyDown={handleGlobalSearchKeyDown}
            />
            {isGlobalSearchFocused && globalSearchTerm.trim().length >= 2 && (
              <div className="global-search-results">
                {globalSearchQuery.isLoading ? (
                  <div className="global-search-empty">Buscando...</div>
                ) : globalSearchResults.length > 0 ? (
                  globalSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="global-search-result"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleGlobalSearchSelect(result)}
                    >
                      <span className="global-search-result-type">{result.type}</span>
                      <strong>{result.label}</strong>
                      <small>{result.description}</small>
                    </button>
                  ))
                ) : (
                  <div className="global-search-empty">Nenhum resultado encontrado.</div>
                )}
              </div>
            )}
          </div>

          <div className="header-actions">
            <button
              type="button"
              onClick={() => openTab('guia-ajuda', 'Guia de Navegação', 'Headphones')}
              className="support-btn"
              title="Ajuda e funcionamento do sistema"
              aria-label="Abrir guia de ajuda"
            >
              <Headphones size={20} />
            </button>
            <button className="notification-btn" aria-label="Notificações">
              <Bell size={20} />
              {openSolicitacoesCount > 0 && <span className="notification-badge">{openSolicitacoesCount}</span>}
            </button>
            <div className="header-date-widget">
              <Calendar size={18} className="date-icon" />
              <div className="date-text">
                <strong>{headerDate.full}</strong>
                <span>{headerDate.weekday}</span>
              </div>
            </div>
          </div>
        </header>
        <InternalTabBar />
        <main ref={contentViewportRef} className="gestor-content-viewport" style={{ position: 'relative' }}>
          <div
            data-active-module-panel={!activeOpenedTab ? 'true' : undefined}
            style={{ display: activeOpenedTab ? 'none' : 'block', height: '100%' }}
          >
            <ModuleRenderErrorBoundary
              key={activeModuleId}
              moduleName={activeModuleId}
              onReset={() => activateModule('inicio')}
            >
              {renderTabContent(activeModuleId, activeModuleId, moduleContexts[activeModuleId])}
            </ModuleRenderErrorBoundary>
          </div>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-active-module-panel={activeTabId === tab.id ? 'true' : undefined}
              style={{ display: activeTabId === tab.id ? 'block' : 'none', height: '100%' }}
            >
              <ModuleRenderErrorBoundary
                key={tab.id}
                moduleName={tab.moduleId}
                onReset={() => activateModule('inicio')}
              >
                {renderTabContent(tab.moduleId, tab.id, tab.context)}
              </ModuleRenderErrorBoundary>
            </div>
          ))}
        </main>
      </div>

      {showLogoutConfirm && (
        <div className="confirm-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Sair do Sistema</h3>
            <p className="confirm-modal-message">Deseja realmente registrar saída?</p>
            <div className="confirm-modal-buttons">
              <button className="confirm-btn confirm-btn-no" onClick={() => setShowLogoutConfirm(false)}>
                Cancelar
              </button>
              <button className="confirm-btn confirm-btn-yes" onClick={onLogout}>
                Confirmar e Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingCalculator userId={currentUser.id} openInternalChatsCount={openInternalChatsCount} />
    </div>
  );
};
