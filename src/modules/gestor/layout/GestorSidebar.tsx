import React, { useEffect, useState } from 'react';
import {
  Building2, Calculator, CalendarDays, ChevronDown, ChevronRight,
  ClipboardList, Database, FileCheck, FolderOpen, GripVertical,
  Landmark, LayoutDashboard, LogOut, Plus, Receipt, Scale, Settings,
  ShieldCheck,
} from 'lucide-react';
import { persistedStorage } from '../../../lib/persistedStorage';
import { TAB_DRAG_MIME, type TabDragPayload } from '../../../components/tabs/tabDragData';
import type { SystemModuleId } from '../configuracoes/modulos-sistema/services/modulosSistemaService';
import { TAB_INFOS } from './gestorTabMetadata';
import { sidebarPreferencesService } from './services/sidebarPreferencesService';
import systemLogoImg from '../../../assets/camada-o.png';

const DEFAULT_MENU_ORDER = [
  'inicio', 'clientes', 'atividades', 'conformidade', 'protocolos',
  'simulacoes-calculos', 'reforma-tributaria', 'faturamento', 'financeiro',
  'documentos', 'agenda', 'parametrizacao', 'configuracoes',
];

const ALL_MENU_IDS = [...DEFAULT_MENU_ORDER];

const PARAMETRIZACAO_ITEMS = [
  { id: 'parametrizacao-regimes', label: 'Regimes Tributários' },
  { id: 'parametrizacao-protocolos', label: 'Catálogo de Obrigações' },
  { id: 'parametrizacao-tipos-empresa', label: 'Tipos de Empresa' },
  { id: 'parametrizacao-natureza-juridica', label: 'Natureza Jurídica' },
  { id: 'parametrizacao-tipos-parceiros', label: 'Tipos de Parceiros' },
  { id: 'parametrizacao-categorias-clientes', label: 'Categorias de Clientes' },
  { id: 'parametrizacao-cnae', label: 'CNAE' },
  { id: 'parametrizacao-regras', label: 'Impostos' },
  { id: 'parametrizacao-parametros-calculo', label: 'Parâmetros de Cálculo' },
  { id: 'parametrizacao-tabelas-tributarias', label: 'Tabelas Tributárias' },
  { id: 'parametrizacao-prazos-entrega', label: 'Obrigações' },
  { id: 'parametrizacao-documentos', label: 'Tipos de Documentos' },
  { id: 'parametrizacao-pastas-padrao', label: 'Pastas Padrão' },
  { id: 'parametrizacao-checklists', label: 'Modelos de Checklists' },
  { id: 'parametrizacao-categoria-financeira', label: 'Categorias Financeiras' },
];

const ATIVIDADES_ITEMS = [
  { id: 'atividades', label: 'Minha Fila' },
  { id: 'atividades-equipe', label: 'Equipe' },
  { id: 'atividades-fechamentos', label: 'Fechamentos de Clientes' },
  { id: 'atividades-modelos', label: 'Rotinas e Modelos' },
  { id: 'atividades-painel-operacional', label: 'Painel Operacional' },
];

const MENU_ITEMS = {
  inicio: { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  clientes: { id: 'clientes', label: 'Clientes', icon: Building2 },
  parametrizacao: { id: 'parametrizacao', label: 'Parametrização', icon: Database },
  atividades: { id: 'atividades', label: 'Atividades', icon: ClipboardList },
  conformidade: { id: 'conformidade', label: 'Conformidade', icon: ShieldCheck },
  'simulacoes-calculos': { id: 'simulacoes-calculos', label: 'Simulações', icon: Calculator },
  'reforma-tributaria': { id: 'reforma-tributaria', label: 'Reforma Tributária', icon: Scale },
  documentos: { id: 'documentos', label: 'Documentos', icon: FolderOpen },
  protocolos: { id: 'protocolos', label: 'Protocolos', icon: FileCheck },
  faturamento: { id: 'faturamento', label: 'Faturamento', icon: Receipt },
  financeiro: { id: 'financeiro', label: 'Financeiro', icon: Landmark },
  agenda: { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  configuracoes: { id: 'configuracoes', label: 'Configurações', icon: Settings },
} as const;

type UserProfile = { nome: string; perfil: string; avatar: string };

type GestorSidebarProps = {
  activeModuleId: string;
  enabledModuleIds: Set<SystemModuleId>;
  userProfile: UserProfile;
  onNavigate: (id: string) => void;
  onOpenTab: (event: React.MouseEvent | React.KeyboardEvent, id: string) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
};

export const GestorSidebar: React.FC<GestorSidebarProps> = ({
  activeModuleId, enabledModuleIds, userProfile, onNavigate, onOpenTab,
  onOpenProfile, onLogout,
}) => {
  const [expanded, setExpanded] = useState({ parametrizacao: false, atividades: false });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [readyToDrag, setReadyToDrag] = useState(false);
  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    const saved = persistedStorage.getItem('arkhen_sidebar_menu_order');
    if (!saved) return DEFAULT_MENU_ORDER;
    try {
      return sidebarPreferencesService.normalizeMenuOrder(JSON.parse(saved), ALL_MENU_IDS, DEFAULT_MENU_ORDER);
    } catch {
      return DEFAULT_MENU_ORDER;
    }
  });

  useEffect(() => {
    if (activeModuleId.startsWith('parametrizacao-')) {
      setExpanded((value) => ({ ...value, parametrizacao: true }));
    }
    if (activeModuleId === 'atividades' || activeModuleId.startsWith('atividades-')) {
      setExpanded((value) => ({ ...value, atividades: true }));
    }
  }, [activeModuleId]);

  useEffect(() => {
    let mounted = true;
    sidebarPreferencesService.getMenuOrder(ALL_MENU_IDS, DEFAULT_MENU_ORDER)
      .then((remoteOrder) => {
        if (!mounted || !remoteOrder) return;
        setMenuOrder(remoteOrder);
        persistedStorage.setItem('arkhen_sidebar_menu_order', JSON.stringify(remoteOrder));
      })
      .catch((error) => console.error('Erro ao carregar ordem da sidebar:', error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const reset = () => { setDraggedItemId(null); setReadyToDrag(false); };
    window.addEventListener('mouseup', reset);
    window.addEventListener('touchend', reset);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('mouseup', reset);
      window.removeEventListener('touchend', reset);
      window.removeEventListener('dragend', reset);
    };
  }, []);

  const startDrag = (event: React.DragEvent, itemId: string) => {
    if (!readyToDrag) return;
    setDraggedItemId(itemId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
  };

  const drop = (event: React.DragEvent, targetItemId: string) => {
    if (draggedItemId === null) return;
    event.preventDefault();
    if (draggedItemId !== targetItemId) {
      const next = [...menuOrder];
      const sourceIndex = next.indexOf(draggedItemId);
      const targetIndex = next.indexOf(targetItemId);
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const [dragged] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, dragged);
        const normalized = sidebarPreferencesService.normalizeMenuOrder(next, ALL_MENU_IDS, DEFAULT_MENU_ORDER);
        setMenuOrder(normalized);
        persistedStorage.setItem('arkhen_sidebar_menu_order', JSON.stringify(normalized));
        void sidebarPreferencesService.saveMenuOrder(normalized, ALL_MENU_IDS, DEFAULT_MENU_ORDER)
          .catch((error) => console.error('Erro ao salvar ordem da sidebar:', error));
      }
    }
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const dragModule = (event: React.DragEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    const info = TAB_INFOS[id];
    if (!info) return;
    const payload: TabDragPayload = { id, title: info.title, iconName: info.iconName };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', info.title);
  };

  const itemStyle = (itemId: string) => ({
    opacity: draggedItemId === itemId ? 0.4 : 1,
    borderTop: dragOverItemId === itemId && draggedItemId !== itemId
      ? '2px solid var(--color-gold-primary)'
      : '2px solid transparent',
    transition: 'all 0.15s ease',
    cursor: draggedItemId !== null ? 'grabbing' : 'grab',
  });

  const renderSubmenu = (items: typeof ATIVIDADES_ITEMS) => (
    <div className="sidebar-submenu-list animate-slide-down">
      {items.map((subItem) => (
        <div key={subItem.id} className="submenu-action-row">
          <button
            type="button"
            onClick={() => onNavigate(subItem.id)}
            draggable
            onDragStart={(event) => dragModule(event, subItem.id)}
            className={`submenu-btn ${activeModuleId === subItem.id ? 'active' : ''}`}
          >
            <span className="submenu-dot" />
            <span>{subItem.label}</span>
          </button>
          <button type="button" className="sidebar-open-tab-btn submenu-open-tab-btn" title="Abrir em nova aba" onClick={(event) => onOpenTab(event, subItem.id)}>
            <Plus size={13} />
          </button>
        </div>
      ))}
    </div>
  );

  const items = menuOrder
    .map((id) => MENU_ITEMS[id as keyof typeof MENU_ITEMS])
    .filter((item) => item && enabledModuleIds.has(item.id as SystemModuleId));

  return (
    <aside className="gestor-sidebar">
      <div className="sidebar-brand">
        <img src={systemLogoImg} alt="Brand logo" className="sidebar-logo" />
        <div className="sidebar-brand-text"><h3>Arkhen</h3><span>Gestão Contábil</span></div>
      </div>
      <nav className={`sidebar-menu ${draggedItemId !== null ? 'dragging-active' : ''}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const collapsible = item.id === 'parametrizacao' || item.id === 'atividades';
          const isExpanded = collapsible && expanded[item.id];
          const isActive = item.id === 'parametrizacao'
            ? activeModuleId.startsWith('parametrizacao-')
            : item.id === 'atividades'
              ? activeModuleId === 'atividades' || activeModuleId.startsWith('atividades-')
              : activeModuleId === item.id;
          const menuRow = (
            <>
              <div className="sidebar-drag-handle" onMouseDown={() => setReadyToDrag(true)} onMouseUp={() => setReadyToDrag(false)} onMouseLeave={() => setReadyToDrag(false)}>
                <GripVertical size={14} />
              </div>
              <button
                type="button"
                onClick={() => collapsible
                  ? setExpanded((value) => ({ ...value, [item.id]: !value[item.id] }))
                  : onNavigate(item.id)}
                draggable={!collapsible}
                onDragStart={collapsible ? undefined : (event) => dragModule(event, item.id)}
                className={`menu-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} /><span>{item.label}</span>
                {collapsible && (
                  <span className="expand-chevron">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="sidebar-open-tab-btn menu-open-tab-btn"
                title="Abrir em nova aba"
                onClick={(event) => onOpenTab(
                  event,
                  item.id === 'parametrizacao' ? 'parametrizacao-regimes' : item.id,
                )}
              >
                <Plus size={14} />
              </button>
            </>
          );
          return (
            <div
              key={item.id}
              className={collapsible ? 'menu-collapsible-container' : 'menu-action-row'}
              draggable={readyToDrag}
              onDragStart={(event) => { startDrag(event, item.id); setReadyToDrag(false); }}
              onDragOver={(event) => { if (draggedItemId !== null) { event.preventDefault(); setDragOverItemId(item.id); } }}
              onDrop={(event) => { drop(event, item.id); setReadyToDrag(false); }}
              onDragEnd={() => { setDraggedItemId(null); setDragOverItemId(null); setReadyToDrag(false); }}
              style={itemStyle(item.id)}
            >
              {collapsible ? <div className="menu-action-row">{menuRow}</div> : menuRow}
              {item.id === 'parametrizacao' && isExpanded && renderSubmenu(PARAMETRIZACAO_ITEMS)}
              {item.id === 'atividades' && isExpanded && renderSubmenu(ATIVIDADES_ITEMS)}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div role="button" tabIndex={0} className="sidebar-profile" onClick={onOpenProfile} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenProfile(); }
        }} title="Abrir meu perfil">
          <img src={userProfile.avatar} alt="Profile Avatar" className="profile-avatar" referrerPolicy="no-referrer" />
          <div className="profile-info"><h4>{userProfile.nome}</h4><div className="profile-role-status"><span className="profile-role">{userProfile.perfil}</span><span className="profile-status-dot" /><span className="profile-status-text">Online</span></div></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onLogout(); }} className="sidebar-logout-btn" title="Sair do Sistema"><LogOut size={18} /></button>
        </div>
      </div>
    </aside>
  );
};
