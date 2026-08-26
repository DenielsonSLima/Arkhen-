import React, { useState } from 'react';
import {
  AlignJustify,
  Archive,
  ArchiveX,
  Building,
  CheckCircle2,
  ClipboardList,
  Download,
  Files,
  FolderPlus,
  Grid,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DocumentosTab } from '../hooks/useDocumentos';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';
import '../styles/DocumentosToolbar.css';

interface DocumentosToolbarProps {
  activeTab: DocumentosTab;
  onTabChange: (tab: DocumentosTab) => void;
  lastAccess: string | null;
  showActions: boolean;
  selectedCount: number;
  onOpenUpload: () => void;
  onOpenFolder: () => void;
  onOpenCategories: () => void;
  onOpenShare: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  fileTypeFilter: string;
  onFileTypeChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  groupBy: DocumentGroupBy;
  onGroupChange: (value: DocumentGroupBy) => void;
  sortBy: DocumentSortBy;
  onSortChange: (value: DocumentSortBy) => void;
  viewMode: 'list' | 'grid' | 'compact';
  onViewModeChange: (value: 'list' | 'grid' | 'compact') => void;
}

const TABS: Array<{ id: DocumentosTab; label: string; icon: React.ElementType }> = [
  { id: 'meus', label: 'Biblioteca', icon: Archive },
  { id: 'empresas', label: 'Por Empresa', icon: Building },
  { id: 'inativas', label: 'Inativas', icon: ArchiveX },
  { id: 'solicitacoes', label: 'Solicitações', icon: ClipboardList },
  { id: 'todos', label: 'Todos os Documentos', icon: Files },
  { id: 'compartilhados', label: 'Compartilhados', icon: Link2 },
];

const FILE_TYPES = [
  ['Todos', 'Formatos'], ['pdf', 'PDF'], ['docx', 'DOCX / DOC'], ['xlsx', 'XLSX / XLS'],
  ['image', 'Imagens'], ['xml', 'XML Fiscal'], ['text', 'TXT / SPED'], ['csv', 'CSV'],
  ['bank', 'Bancário / CNAB'], ['certificate', 'Certificados'], ['archive', 'Compactados'], ['email', 'E-mails'],
];

const actionButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '0.74rem',
  gap: '4px',
  padding: '6px 10px',
};

export const DocumentosToolbar: React.FC<DocumentosToolbarProps> = ({
  activeTab,
  onTabChange,
  lastAccess,
  showActions,
  selectedCount,
  onOpenUpload,
  onOpenFolder,
  onOpenCategories,
  onOpenShare,
  onBulkDownload,
  onBulkDelete,
  onClearSelection,
  searchTerm,
  onSearchChange,
  fileTypeFilter,
  onFileTypeChange,
  categoryFilter,
  onCategoryChange,
  categories,
  groupBy,
  onGroupChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const showLibraryFilters = activeTab !== 'compartilhados' && activeTab !== 'solicitacoes';

  return (
    <>
      <header className="documents-page-header">
        <div>
          <h1>Documentos</h1>
          <p>Biblioteca, solicitações por competência e arquivos organizados por empresa.</p>
          {lastAccess && <small>Último acesso em: {lastAccess}</small>}
        </div>

        {showActions && (
          <div className="documents-page-actions">
            <div className="documents-page-actions-row">
              <button className="btn-add-user" type="button" onClick={onOpenUpload} style={{ ...actionButtonStyle, background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}>
                <Upload size={12} /> Enviar / Pasta
              </button>
              <button className="btn-add-user" type="button" onClick={onOpenFolder} style={{ ...actionButtonStyle, background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                <FolderPlus size={12} /> Nova Pasta
              </button>
              <button className="btn-add-user" type="button" onClick={onOpenCategories} style={{ ...actionButtonStyle, background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                <Plus size={12} /> Categorias
              </button>
              <div className="documents-more-menu-anchor">
                <button type="button" className="btn-add-user" onClick={() => setShowMoreMenu((current) => !current)} style={{ ...actionButtonStyle, background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 8px' }} title="Mais opções">
                  <MoreHorizontal size={15} />
                </button>
                {showMoreMenu && (
                  <div className="documents-more-menu">
                    <button type="button" onClick={() => { onTabChange('compartilhados'); setShowMoreMenu(false); }}>
                      <Link2 size={14} /> Arquivos compartilhados
                    </button>
                    {selectedCount > 0 && (
                      <button type="button" onClick={() => { onClearSelection(); setShowMoreMenu(false); }}>
                        <CheckCircle2 size={14} /> Limpar seleção
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="documents-page-actions-row">
                <button className="btn-add-user" type="button" onClick={onOpenShare} style={{ ...actionButtonStyle, background: '#0f172a', color: '#ffffff', border: 'none' }}>
                  <Share2 size={12} /> Compartilhar ({selectedCount})
                </button>
                <button className="btn-add-user" type="button" onClick={onBulkDownload} style={{ ...actionButtonStyle, background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}>
                  <Download size={12} /> Baixar ({selectedCount})
                </button>
                {selectedCount > 1 && (
                  <button className="btn-add-user" type="button" onClick={onBulkDelete} style={{ ...actionButtonStyle, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <Trash2 size={12} /> Apagar ({selectedCount})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {showLibraryFilters && (
        <div className="documents-toolbar-filters">
          <div className="documents-search-field">
            <Search size={13} aria-hidden />
            <input type="search" placeholder="Buscar por nome, tipo, empresa ou descrição" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />
          </div>
          <select value={fileTypeFilter} onChange={(event) => onFileTypeChange(event.target.value)} aria-label="Filtrar por formato">
            {FILE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Filtrar por categoria">
            <option value="Todos">Todas as categorias</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={groupBy} onChange={(event) => onGroupChange(event.target.value as DocumentGroupBy)} aria-label="Agrupar documentos">
            <option value="none">Sem grupos</option>
            <option value="type">Agrupar: Tipo</option>
            <option value="category">Agrupar: Categoria</option>
            <option value="folder">Agrupar: Pasta</option>
            <option value="company">Agrupar: Empresa</option>
          </select>
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as DocumentSortBy)} aria-label="Ordenar documentos">
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="last-opened">Último acesso</option>
          </select>
          <div className="documents-view-switch" aria-label="Modo de visualização">
            <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewModeChange('list')} title="Visualizar em lista"><List size={13} /></button>
            <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewModeChange('grid')} title="Visualizar em cartões"><Grid size={13} /></button>
            <button type="button" className={viewMode === 'compact' ? 'active' : ''} onClick={() => onViewModeChange('compact')} title="Visualização compacta"><AlignJustify size={13} /></button>
          </div>
        </div>
      )}

      <nav className="detail-tab-nav documents-tabs" aria-label="Seções de documentos">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`detail-tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => onTabChange(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>
    </>
  );
};
