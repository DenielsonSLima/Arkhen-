import React, { useEffect, useMemo, useState } from 'react';
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
import { TiposDocumentosPage } from '../parametrizacao/catalogos/tipos-documentos/TiposDocumentosPage';
import { GestaoEmpresarialPage } from '../gestao-empresarial/GestaoEmpresarialPage';
import type { EmpresaDetailTab } from '../gestao-empresarial/hooks/useGestaoEmpresarial';
import { AtividadesPage } from '../atividades/AtividadesPage';
import { ConfigFluxosPage } from '../atividades/config/ConfigFluxosPage';
import { PlanejamentoTributarioPage } from '../planejamento-tributario/PlanejamentoTributarioPage';
import { SimulacoesCalculosPage } from '../simulacoes-calculos/SimulacoesCalculosPage';
import { DocumentosPage } from '../documentos/DocumentosPage';
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
import { GuiaDeAjuda } from './GuiaDeAjuda';

import systemLogoImg from '../../../assets/camada-o.png';
import './GestorLayout.css';
import './GestorLayoutFixes.css';
import './GestorModuleTabs.css';

interface GestorLayoutProps {
  onLogout: () => void;
}

interface ModuleRenderErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ModuleRenderErrorBoundary extends React.Component<
  { onReset: () => void; moduleName?: string; children: React.ReactNode },
  ModuleRenderErrorBoundaryState
> {
  constructor(props: { onReset: () => void; moduleName?: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Erro ao renderizar este módulo.' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Erro no módulo ${this.props.moduleName || 'desconhecido'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="submodule-content-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Não foi possível abrir este módulo</h3>
          <p style={{ margin: '0 0 14px 0', color: '#64748b', fontSize: '0.9rem' }}>{this.state.message}</p>
          <button
            type="button"
            onClick={this.props.onReset}
            className="btn-save-settings"
          >
            Voltar para Início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const GestorLayout: React.FC<GestorLayoutProps> = ({ onLogout }) => {
  const { tabs, activeTabId, openTab, activateModule, updateTabContext } = useInternalTabs();
  const [isCadastrosExpanded, setIsCadastrosExpanded] = useState(false);
  const [isAtividadesExpanded, setIsAtividadesExpanded] = useState(false);
  const [moduleContexts, setModuleContexts] = useState<Record<string, InternalTabContext>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
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
    if (!showHelpModal) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowHelpModal(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [showHelpModal]);

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

  const activeOpenedTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs],
  );
  const activeModuleId = activeOpenedTab?.moduleId || activeTabId;

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

  const defaultOrder = [
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
    'configuracoes'
  ];

  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('arkhen_sidebar_menu_order');
        if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allItems = ['inicio', 'clientes', 'parametrizacao', 'atividades', 'conformidade', 'simulacoes-calculos', 'documentos', 'protocolos', 'faturamento', 'financeiro', 'agenda', 'configuracoes'];
          const filtered = parsed.filter(id => allItems.includes(id));
          const missing = allItems.filter(id => !filtered.includes(id));
          return [...filtered, ...missing];
        }
      } catch (e) {
        console.error(e);
      }
    }
    return defaultOrder;
  });

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

      setMenuOrder(newOrder);
      localStorage.setItem('arkhen_sidebar_menu_order', JSON.stringify(newOrder));
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
    protocolos: { id: 'protocolos', label: 'Protocolos', icon: <FileCheck size={20} /> },
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
    { id: 'parametrizacao-regras', label: 'Impostos' },
    { id: 'parametrizacao-prazos-entrega', label: 'Obrigações' },
    { id: 'parametrizacao-documentos', label: 'Tipos de Documentos' },
    { id: 'parametrizacao-checklists', label: 'Modelos de Checklists' },
  ];
  const atividadesItems = [
    { id: 'atividades-diarias', label: 'Atividades diárias' },
    { id: 'atividades-semanais', label: 'Atividades semanais' },
    { id: 'atividades-mensais', label: 'Atividades mensais' },
    { id: 'atividades-empresa', label: 'Atividades por empresa' },
    { id: 'atividades-funcionario', label: 'Atividades por funcionário' },
    { id: 'atividades-internas', label: 'Atividades internas' },
    { id: 'atividades-rotinas', label: 'Checklists' },
    { id: 'atividades-controle', label: 'Controle de andamento' },
  ];


  const handleNavigate = (id: string) => {
    activateModule(id);
  };

  const handleOpenMyProfile = () => {
    sessionStorage.setItem('contabil_config_initial_subtab', 'meu-perfil');
    window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: 'meu-perfil' } }));
    activateModule('configuracoes');
  };

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
      case 'parametrizacao-cnae':
        return <CnaePage />;
      case 'parametrizacao-regras':
        return <RegrasApuracaoPage />;
      case 'parametrizacao-documentos':
        return <TiposDocumentosPage />;
      case 'parametrizacao-parametros-calculo':
        return <ParametrosCalculoPage />;
      case 'parametrizacao-prazos-entrega':
        return <PrazosEntregaPage />;
      case 'parametrizacao-protocolos':
        return <ProtocolosTiposPage />;
      case 'parametrizacao-checklists':
        return <ConfigFluxosPage />;
      case 'atividades':
      case 'atividades-diarias':
      case 'atividades-painel':
      case 'atividades-resumo':
        return <AtividadesPage view="diarias" />;
      case 'atividades-semanais':
      case 'atividades-agenda':
        return <AtividadesPage view="semanais" />;
      case 'atividades-mensais':
        return <AtividadesPage view="mensais" />;
      case 'atividades-empresa':
        return (
          <AtividadesPage
            view="empresa"
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
            initialCompetencia={initialContext?.data?.selectedCompetencia as string | undefined}
          />
        );
      case 'atividades-funcionario':
      case 'atividades-equipe':
        return <AtividadesPage view="funcionario" />;
      case 'atividades-internas':
        return <AtividadesPage view="internas" />;
      case 'atividades-rotinas':
        return <AtividadesPage view="rotinas" />;
      case 'atividades-controle':
      case 'atividades-controle-andamento':
        return <AtividadesPage view="controle" />;
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
          <DocumentosPage
            initialActiveTab={initialContext?.data?.activeTab as DocumentosTab | undefined}
            initialPersonalFolder={initialContext?.data?.personalFolder as string | null | undefined}
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | null | undefined}
            onViewContextChange={onContextChange}
          />
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
        return <FinanceiroPage />;
      case 'relatorios':
        return <RelatoriosPage />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
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
            <input type="text" placeholder="Buscar clientes, empresas, documentos..." />
          </div>

          <div className="header-actions">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
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
        <main className="gestor-content-viewport" style={{ position: 'relative' }}>
          <div style={{ display: activeOpenedTab ? 'none' : 'block', height: '100%' }}>
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

      {showHelpModal && <GuiaDeAjuda onClose={() => setShowHelpModal(false)} />}

      <FloatingCalculator userId={currentUser.id} openInternalChatsCount={openInternalChatsCount} />
    </div>
  );
};
