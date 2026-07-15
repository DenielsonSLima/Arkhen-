import React, { useMemo } from 'react';
import { Bell, Calendar, Headphones, Search } from 'lucide-react';
import type { GlobalSearchResult } from './hooks/useGestorGlobalSearch';

type GestorHeaderProps = {
  searchTerm: string;
  searchFocused: boolean;
  searchLoading: boolean;
  modulesReady: boolean;
  results: GlobalSearchResult[];
  openSolicitacoesCount: number;
  onSearchTermChange: (value: string) => void;
  onSearchFocusChange: (focused: boolean) => void;
  onSearchSelect: (result: GlobalSearchResult) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenHelp: () => void;
};

export const GestorHeader: React.FC<GestorHeaderProps> = ({
  searchTerm, searchFocused, searchLoading, modulesReady, results,
  openSolicitacoesCount, onSearchTermChange, onSearchFocusChange,
  onSearchSelect, onSearchKeyDown, onOpenHelp,
}) => {
  const headerDate = useMemo(() => {
    const now = new Date();
    return {
      full: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      weekday: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
    };
  }, []);

  const showResults = searchFocused && searchTerm.trim().length >= 2;
  return (
    <header className="gestor-header">
      <div className="header-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Buscar clientes, empresas, documentos..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          onFocus={() => onSearchFocusChange(true)}
          onBlur={() => window.setTimeout(() => onSearchFocusChange(false), 120)}
          onKeyDown={onSearchKeyDown}
          disabled={!modulesReady}
        />
        {showResults && (
          <div className="global-search-results">
            {!modulesReady || searchLoading ? (
              <div className="global-search-empty">Buscando...</div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="global-search-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSearchSelect(result)}
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
        <button type="button" onClick={onOpenHelp} className="support-btn" title="Ajuda e funcionamento do sistema" aria-label="Abrir guia de ajuda">
          <Headphones size={20} />
        </button>
        <button className="notification-btn" aria-label="Notificações">
          <Bell size={20} />
          {openSolicitacoesCount > 0 && <span className="notification-badge">{openSolicitacoesCount}</span>}
        </button>
        <div className="header-date-widget">
          <Calendar size={18} className="date-icon" />
          <div className="date-text"><strong>{headerDate.full}</strong><span>{headerDate.weekday}</span></div>
        </div>
      </div>
    </header>
  );
};
