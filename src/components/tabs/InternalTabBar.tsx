import React, { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { useInternalTabs } from '../../hooks/useInternalTabs';
import { TAB_DRAG_MIME, TAB_REORDER_MIME, parseTabDragPayload } from './tabDragData';
import './Tabs.css';

export const InternalTabBar: React.FC = () => {
  const { tabs, activeTabId, activateTab, closeTab, openTab, reorderTab, notice, clearNotice } = useInternalTabs();
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => clearNotice(), 2800);
    return () => window.clearTimeout(timer);
  }, [clearNotice, notice]);

  // Função para obter o ícone dinamicamente do Lucide
  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    if (IconComponent) {
      return <IconComponent size={14} className="tab-icon" />;
    }
    return <LucideIcons.FileText size={14} className="tab-icon" />;
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes(TAB_DRAG_MIME)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const payload = parseTabDragPayload(event.dataTransfer.getData(TAB_DRAG_MIME));
    setIsDragOver(false);

    if (!payload) return;

    event.preventDefault();
    openTab(payload.id, payload.title, payload.iconName);
  };

  const handleTabDragStart = (event: React.DragEvent<HTMLDivElement>, tabId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(TAB_REORDER_MIME, tabId);
    setDraggedTabId(tabId);
  };

  const handleTabDragOver = (event: React.DragEvent<HTMLDivElement>, targetTabId: string) => {
    if (!Array.from(event.dataTransfer.types).includes(TAB_REORDER_MIME)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTabId(targetTabId);
  };

  const handleTabDrop = (event: React.DragEvent<HTMLDivElement>, targetTabId: string) => {
    const sourceTabId = event.dataTransfer.getData(TAB_REORDER_MIME);
    if (!sourceTabId) return;

    event.preventDefault();
    event.stopPropagation();
    reorderTab(sourceTabId, targetTabId);
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const clearTabDragState = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return (
    <div
      className={`internal-tab-bar ${isDragOver ? 'is-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Aba Início - Fixa e sempre visível */}
      <button
        type="button"
        className={`internal-tab-item fixed-tab ${activeTabId === 'inicio' ? 'active' : ''}`}
        onClick={() => activateTab('inicio')}
      >
        <LucideIcons.LayoutDashboard size={14} className="tab-icon" />
        <span className="tab-title">Início</span>
      </button>

      {/* Outras abas abertas */}
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;

        return (
          <div
            key={tab.id}
            className={`internal-tab-item ${isActive ? 'active' : ''} ${draggedTabId === tab.id ? 'is-dragging' : ''} ${dragOverTabId === tab.id ? 'is-reorder-over' : ''}`}
            draggable
            onClick={() => activateTab(tab.id)}
            onDragStart={(event) => handleTabDragStart(event, tab.id)}
            onDragOver={(event) => handleTabDragOver(event, tab.id)}
            onDragLeave={() => setDragOverTabId(null)}
            onDrop={(event) => handleTabDrop(event, tab.id)}
            onDragEnd={clearTabDragState}
          >
            {renderIcon(tab.iconName)}
            <span className="tab-title" title={tab.title}>
              {tab.title}
            </span>

            <div className="tab-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="tab-action-btn close-btn"
                title="Fechar aba"
                onClick={() => closeTab(tab.id)}
              >
                <LucideIcons.X size={12} />
              </button>
            </div>
          </div>
        );
      })}

      {notice && (
        <div className="tab-bar-notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
};
