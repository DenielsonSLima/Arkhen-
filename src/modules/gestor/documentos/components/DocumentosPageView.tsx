import React, { Suspense } from 'react';
import {
  AlignJustify,
  Archive,
  ArchiveX,
  Building,
  CheckCircle2,
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
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentosTab } from '../hooks/useDocumentos';
import type { MeusDocumentosData } from '../services/documentosService';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';

const MeusDocumentosTab = React.lazy(() => import('./MeusDocumentosTab').then((module) => ({ default: module.MeusDocumentosTab })));
const DocumentosEmpresasTab = React.lazy(() => import('./DocumentosEmpresasTab').then((module) => ({ default: module.DocumentosEmpresasTab })));
const TodosDocumentosTab = React.lazy(() => import('./TodosDocumentosTab').then((module) => ({ default: module.TodosDocumentosTab })));
const SharedDocumentsTab = React.lazy(() => import('./SharedDocumentsTab').then((module) => ({ default: module.SharedDocumentsTab })));

type ViewMode = 'list' | 'grid' | 'compact';

interface DocumentosPageViewProps {
  activeTab: DocumentosTab;
  setActiveTab: (tab: DocumentosTab) => void;
  lastAccess: string | null;
  showActions: boolean;
  showMoreMenu: boolean;
  setShowMoreMenu: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDocIds: string[];
  clearSelection: () => void;
  onOpenUpload: () => void;
  onOpenCreateFolder: () => void;
  onOpenCategories: () => void;
  onOpenShare: () => void;
  onBulkDownloadSelected: () => void;
  onBulkDeleteSelected: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  fileTypeFilter: string;
  setFileTypeFilter: (value: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (value: string) => void;
  categoriesList: string[];
  groupBy: DocumentGroupBy;
  setGroupBy: (value: DocumentGroupBy) => void;
  sortBy: DocumentSortBy;
  setSortBy: (value: DocumentSortBy) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  isLoading: boolean;
  meusDocs: MeusDocumentosData;
  saveMeusDocs: (data: MeusDocumentosData) => Promise<void> | void;
  activeCompanies: Company[];
  inactiveCompanies: Company[];
  companies: Company[];
  saveCompanyDocs: (company: Company) => Promise<void> | void;
  toggleSelectDoc: (docId: string) => void;
  selectAllDocs: (docIds: string[]) => void;
  handleBulkDownload: (documents: CompanyDocument[]) => Promise<void> | void;
  initialPersonalFolder?: string | null;
  setPersonalFolder: (folder: string | null) => void;
  initialCompanyId?: string | null;
  onCompanyChange: (id: string | null, name?: string) => void;
  companyFolder: string | null;
  setCompanyFolder: (folder: string | null) => void;
  onDownloadFolder: (scope: 'meus' | 'empresas', folderPath: string | null) => void;
  onDownloadDocument: (document: CompanyDocument) => void;
  onNotify: (message: string) => void;
  shareRefreshKey: number;
}

const DocumentosLoadingState = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
    <div className="loading-spinner" style={{ margin: '0 auto 12px auto' }}></div>
    <p style={{ fontSize: '0.85rem' }}>Carregando documentos...</p>
  </div>
);

export const DocumentosPageView: React.FC<DocumentosPageViewProps> = ({
  activeTab, setActiveTab, lastAccess, showActions, showMoreMenu, setShowMoreMenu,
  selectedDocIds, clearSelection, onOpenUpload, onOpenCreateFolder, onOpenCategories,
  onOpenShare, onBulkDownloadSelected, onBulkDeleteSelected, searchTerm, setSearchTerm,
  fileTypeFilter, setFileTypeFilter, selectedCategoryFilter, setSelectedCategoryFilter,
  categoriesList, groupBy, setGroupBy, sortBy, setSortBy, viewMode, setViewMode,
  isLoading, meusDocs, saveMeusDocs, activeCompanies, inactiveCompanies, companies,
  saveCompanyDocs, toggleSelectDoc, selectAllDocs, handleBulkDownload,
  initialPersonalFolder, setPersonalFolder, initialCompanyId, onCompanyChange,
  companyFolder, setCompanyFolder, onDownloadFolder, onDownloadDocument, onNotify,
  shareRefreshKey,
}) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Documentos</h1>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
          Biblioteca de documentos por empresa, pastas, contratos, procurações e certidões.
        </p>
        {lastAccess && (
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0 0' }}>Último acesso em: {lastAccess}</p>
        )}
      </div>

      {showActions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', alignItems: 'flex-end', minWidth: 'min(100%, 420px)' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-add-user" onClick={onOpenUpload} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}>
              <Upload size={12} /> Enviar / Pasta
            </button>
            <button className="btn-add-user" onClick={onOpenCreateFolder} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
              <FolderPlus size={12} /> Nova Pasta
            </button>
            <button className="btn-add-user" onClick={onOpenCategories} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
              <Plus size={12} /> Categorias
            </button>
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn-add-user" onClick={() => setShowMoreMenu((current) => !current)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', padding: '6px 8px', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }} title="Mais opções">
                <MoreHorizontal size={15} />
              </button>
              {showMoreMenu && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: '210px', background: '#ffffff', border: '1px solid #d8e0ea', borderRadius: '8px', boxShadow: '0 18px 42px rgba(15, 23, 42, 0.16)', padding: '6px' }}>
                  <button type="button" onClick={() => { setActiveTab('compartilhados'); setShowMoreMenu(false); }} style={{ width: '100%', border: 'none', background: 'transparent', color: '#334155', padding: '8px 9px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                    <Link2 size={14} /> Arquivos compartilhados
                  </button>
                  {selectedDocIds.length > 0 && (
                    <button type="button" onClick={() => { clearSelection(); setShowMoreMenu(false); }} style={{ width: '100%', border: 'none', background: 'transparent', color: '#64748b', padding: '8px 9px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Limpar seleção
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedDocIds.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn-add-user" onClick={onOpenShare} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#0f172a', color: '#ffffff', border: 'none' }}>
                <Share2 size={12} /> Compartilhar ({selectedDocIds.length})
              </button>
              <button className="btn-add-user" onClick={onBulkDownloadSelected} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}>
                <Download size={12} /> Baixar ({selectedDocIds.length})
              </button>
              {selectedDocIds.length > 1 && (
                <button className="btn-add-user" onClick={onBulkDeleteSelected} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                  <Trash2 size={12} /> Apagar ({selectedDocIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none', flexShrink: 0 }} />
        <input type="text" placeholder="Buscar por nome, tipo, conteúdo simulado..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
      </div>
      <select value={fileTypeFilter} onChange={(event) => setFileTypeFilter(event.target.value)} style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '100px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}>
        <option value="Todos">Formatos</option><option value="pdf">PDF</option><option value="docx">DOCX / DOC</option>
        <option value="xlsx">XLSX / XLS</option><option value="image">Imagens</option><option value="xml">XML Fiscal</option>
        <option value="text">TXT / SPED</option><option value="csv">CSV</option><option value="bank">Bancário / CNAB</option>
        <option value="certificate">Certificados</option><option value="archive">Compactados</option><option value="email">E-mails</option>
      </select>
      <select value={selectedCategoryFilter} onChange={(event) => setSelectedCategoryFilter(event.target.value)} style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '130px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}>
        <option value="Todos">Todas Categorias</option>
        {categoriesList.map((category, index) => <option key={index} value={category}>{category}</option>)}
      </select>
      {activeTab !== 'compartilhados' && (
        <>
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as DocumentGroupBy)} style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '120px', flexShrink: 0, cursor: 'pointer', color: '#475569' }} title="Agrupar documentos">
            <option value="none">Sem Grupos</option><option value="type">Agrupar: Tipo</option><option value="category">Agrupar: Categoria</option><option value="folder">Agrupar: Pasta</option><option value="company">Agrupar: Empresa</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as DocumentSortBy)} style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '132px', flexShrink: 0, cursor: 'pointer', color: '#475569' }} title="Ordenar documentos">
            <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name-asc">A-Z</option><option value="name-desc">Z-A</option><option value="last-opened">Último acesso</option>
          </select>
        </>
      )}
      <div style={{ display: 'inline-flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px', flexShrink: 0 }}>
        {([['list', List, 'Visualizar em Lista'], ['grid', Grid, 'Visualizar em Cards'], ['compact', AlignJustify, 'Visualização Compacta']] as const).map(([mode, Icon, title]) => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{ border: 'none', background: viewMode === mode ? '#fff' : 'none', color: viewMode === mode ? '#0f172a' : '#64748b', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }} title={title}>
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>

    <div className="detail-tab-nav" style={{ marginBottom: '12px', marginTop: '2px' }}>
      {([
        ['meus', Archive, 'Biblioteca'], ['empresas', Building, 'Por Empresa'], ['inativas', ArchiveX, 'Inativas'],
        ['todos', Files, 'Todos os Documentos'], ['compartilhados', Link2, 'Compartilhados'],
      ] as const).map(([tab, Icon, label]) => (
        <button key={tab} className={`detail-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>

    <div className="detail-tab-content">
      {isLoading ? <DocumentosLoadingState /> : (
        <Suspense fallback={<DocumentosLoadingState />}>
          {activeTab === 'meus' ? (
            <MeusDocumentosTab meusDocs={meusDocs} onSaveMeusDocs={saveMeusDocs} selectedDocIds={selectedDocIds} toggleSelectDoc={toggleSelectDoc} searchTerm={searchTerm} selectedCategoryFilter={selectedCategoryFilter} fileTypeFilter={fileTypeFilter} initialSelectedFolder={initialPersonalFolder} onFolderChange={setPersonalFolder} viewMode={viewMode} groupBy={groupBy} sortBy={sortBy} onDownloadFolder={(folderPath) => onDownloadFolder('meus', folderPath)} onDownload={onDownloadDocument} onNotify={onNotify} />
          ) : activeTab === 'empresas' || activeTab === 'inativas' ? (
            <DocumentosEmpresasTab key={activeTab} companies={activeTab === 'inativas' ? inactiveCompanies : activeCompanies} selectedDocIds={selectedDocIds} toggleSelectDoc={toggleSelectDoc} searchTerm={searchTerm} selectedCategoryFilter={selectedCategoryFilter} fileTypeFilter={fileTypeFilter} initialSelectedCompanyId={initialCompanyId} onCompanyChange={onCompanyChange} viewMode={viewMode} onSaveCompanyDocs={saveCompanyDocs} selectedFolder={companyFolder} onFolderChange={setCompanyFolder} groupBy={groupBy} sortBy={sortBy} onDownloadFolder={(folderPath) => onDownloadFolder('empresas', folderPath)} onDownload={onDownloadDocument} onNotify={onNotify} />
          ) : activeTab === 'todos' ? (
            <TodosDocumentosTab meusDocs={meusDocs} companies={companies} selectedDocIds={selectedDocIds} toggleSelectDoc={toggleSelectDoc} selectAllDocs={selectAllDocs} onBulkDownload={handleBulkDownload} onDownload={onDownloadDocument} searchTerm={searchTerm} selectedCategoryFilter={selectedCategoryFilter} fileTypeFilter={fileTypeFilter} viewMode={viewMode} groupBy={groupBy} sortBy={sortBy} />
          ) : (
            <SharedDocumentsTab refreshKey={shareRefreshKey} onNotify={onNotify} />
          )}
        </Suspense>
      )}
    </div>
  </>
);
