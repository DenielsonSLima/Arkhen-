import React from 'react';
import { AlertCircle, ArrowLeft, ChevronRight, Download, FolderOpen, Trash2 } from 'lucide-react';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';
import { DocumentMoveDrawer, type DocumentMoveTarget } from './DocumentMoveDrawer';
import { OrganizedDocumentList } from './OrganizedDocumentList';

type CompanyDocumentWithCompany = CompanyDocument & { empresaNome: string };

interface BreadcrumbItem {
  label: string;
  path: string | null;
}

interface DocumentosEmpresasTabViewProps {
  children?: React.ReactNode;
  companies: Company[];
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedFolder: string | null;
  onFolderChange: (folder: string | null) => void;
  breadcrumbs: BreadcrumbItem[];
  isGlobalSearchActive: boolean;
  isFolderNavigationVisible: boolean;
  currentSubFolders: string[];
  documents: CompanyDocument[];
  filteredDocs: CompanyDocumentWithCompany[];
  hasFolderContent: boolean;
  searchTerm: string;
  selectedCategoryFilter: string;
  fileTypeFilter: string;
  groupBy: DocumentGroupBy;
  sortBy: DocumentSortBy;
  viewMode: 'list' | 'grid' | 'compact';
  selectedDocIds: string[];
  toggleSelectDoc: (docId: string) => void;
  draggedFolder: string | null;
  setDraggedFolder: (folder: string | null) => void;
  dropTargetFolder: string | null;
  setDropTargetFolder: React.Dispatch<React.SetStateAction<string | null>>;
  moveTargets: DocumentMoveTarget[];
  handleBackClick: () => void;
  handleDeleteFolder: (shortName: string, event: React.MouseEvent) => void;
  handleDeleteFile: (docId: string) => void;
  handleDropItem: (event: React.DragEvent, targetFolder: string | null) => void;
  canDropOnFolder: (event: React.DragEvent, targetFolder: string | null) => boolean;
  onDownloadFolder?: (folderPath: string) => void;
  onDownload?: (document: CompanyDocument) => void;
  onPreview: (document: CompanyDocument) => void;
  onStartRename: (docId: string, currentName: string) => void;
}

export const DocumentosEmpresasTabView: React.FC<DocumentosEmpresasTabViewProps> = ({
  children, companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, selectedFolder,
  onFolderChange, breadcrumbs, isGlobalSearchActive, isFolderNavigationVisible,
  currentSubFolders, documents, filteredDocs, hasFolderContent, searchTerm,
  selectedCategoryFilter, fileTypeFilter, groupBy, sortBy, viewMode, selectedDocIds,
  toggleSelectDoc, draggedFolder, setDraggedFolder, dropTargetFolder,
  setDropTargetFolder, moveTargets, handleBackClick, handleDeleteFolder,
  handleDeleteFile, handleDropItem, canDropOnFolder, onDownloadFolder, onDownload,
  onPreview, onStartRename,
}) => (
  <div
    className="animate-fade-in"
    onDragOver={(event) => {
      if (selectedCompany && Array.from(event.dataTransfer.types).includes('application/x-documentos-item')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    }}
    onDrop={(event) => handleDropItem(event, selectedFolder)}
    style={{ padding: '4px 0' }}
  >
    <div className="documents-move-layout">
      <div className="documents-move-main">
        {(selectedCompanyId !== null || isGlobalSearchActive) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={handleBackClick} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', padding: '4px' }}>
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => onFolderChange(null)}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                  fontSize: '0.88rem', fontWeight: selectedFolder === null ? 800 : 600,
                  color: selectedFolder === null ? 'var(--color-gold-dark)' : '#64748b',
                }}
              >
                {selectedCompany?.nome || 'Documentos da Empresa'}
              </button>
              {selectedFolder && breadcrumbs.slice(1).map((crumb, index) => (
                <React.Fragment key={index}>
                  <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
                  <button
                    onClick={() => onFolderChange(crumb.path)}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                      fontSize: '0.88rem', fontWeight: index === breadcrumbs.length - 2 ? 800 : 600,
                      color: index === breadcrumbs.length - 2 ? 'var(--color-gold-dark)' : '#64748b',
                    }}
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
              {isGlobalSearchActive && (
                <>
                  <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-gold-dark)', padding: '2px 4px' }}>Pesquisa Global</span>
                </>
              )}
            </div>
          </div>
        )}

        {(selectedCompanyId !== null || isGlobalSearchActive) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isGlobalSearchActive ? 'Busca Global entre Clientes' : `Arquivos da Empresa (${filteredDocs.length})`}
            </div>
          </div>
        )}

        {selectedCompanyId === null && !isGlobalSearchActive ? (
          <div>
            {companies.length === 0 ? (
              <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
                <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Nenhuma empresa cliente cadastrada no Supabase.</p>
              </div>
            ) : (
              <div className="docs-folders-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {companies.map((company) => {
                  const filesCount = company.documentos.length;
                  return (
                    <div key={company.id} className="doc-folder-card" onClick={() => setSelectedCompanyId(company.id)} style={{ position: 'relative', alignItems: 'flex-start', paddingTop: '14px', paddingBottom: '14px' }}>
                      <FolderOpen className="doc-folder-icon" size={22} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
                      <div className="doc-folder-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{company.nome}</h4>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>CNPJ: {company.cnpj || 'Não cadastrado'}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: company.tipoEstabelecimento === 'Matriz' ? '#eff6ff' : '#f5f5f4', color: company.tipoEstabelecimento === 'Matriz' ? '#1e40af' : '#44403c', border: company.tipoEstabelecimento === 'Matriz' ? '1px solid #bfdbfe' : '1px solid #e7e5e4' }}>
                            {company.tipoEstabelecimento}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{company.tipo}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', marginLeft: 'auto' }}>
                            {filesCount} {filesCount === 1 ? 'arquivo' : 'arquivos'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {isFolderNavigationVisible && selectedCompanyId !== null && (selectedFolder || currentSubFolders.length > 0) && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                  {selectedFolder ? 'Subpastas' : 'Pastas da empresa'}
                </div>
                <div className="docs-folders-grid">
                  {currentSubFolders.map((shortName, index) => {
                    const fullPath = selectedFolder ? `${selectedFolder}/${shortName}` : shortName;
                    const filesInFolder = documents.filter((document) => document.pasta === fullPath || document.pasta?.startsWith(`${fullPath}/`)).length;
                    return (
                      <div
                        key={index}
                        className="doc-folder-card"
                        draggable
                        onClick={() => onFolderChange(fullPath)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('application/x-documentos-item', JSON.stringify({ kind: 'folder', path: fullPath }));
                          event.dataTransfer.setData('text/plain', fullPath);
                          setDraggedFolder(fullPath);
                        }}
                        onDragEnd={() => { setDraggedFolder(null); setDropTargetFolder(null); }}
                        onDragOver={(event) => {
                          if (!canDropOnFolder(event, fullPath)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDropTargetFolder(fullPath);
                        }}
                        onDragLeave={() => setDropTargetFolder((current) => current === fullPath ? null : current)}
                        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); handleDropItem(event, fullPath); }}
                        style={{ opacity: draggedFolder === fullPath ? 0.55 : 1, cursor: 'grab' }}
                        data-drop-active={dropTargetFolder === fullPath ? 'true' : undefined}
                        title="Arraste para mover esta pasta para dentro de outra"
                      >
                        <FolderOpen className="doc-folder-icon" size={24} />
                        <div className="doc-folder-info" style={{ flexGrow: 1 }}>
                          <h4>{shortName}</h4>
                          <span>{filesInFolder} {filesInFolder === 1 ? 'arquivo' : 'arquivos'}</span>
                        </div>
                        {filesInFolder === 0 && (
                          <button onClick={(event) => handleDeleteFolder(shortName, event)} style={{ border: 'none', background: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex' }} title="Excluir Pasta">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button onClick={(event) => { event.stopPropagation(); onDownloadFolder?.(fullPath); }} style={{ border: 'none', background: 'none', color: 'var(--color-gold-dark)', padding: '4px', cursor: 'pointer', display: 'flex' }} title="Baixar pasta em ZIP">
                          <Download size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredDocs.length === 0 && !hasFolderContent ? (
              <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
                <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                  {searchTerm || selectedCategoryFilter !== 'Todos' || fileTypeFilter !== 'Todos'
                    ? 'Nenhum arquivo encontrado para os filtros aplicados.'
                    : selectedFolder ? 'Nenhum arquivo nesta pasta.' : 'Nenhum arquivo solto nesta empresa.'}
                </p>
              </div>
            ) : filteredDocs.length > 0 ? (
              <OrganizedDocumentList
                documents={filteredDocs}
                groupBy={groupBy}
                sortBy={sortBy}
                viewMode={viewMode}
                onPreview={onPreview}
                onRename={selectedCompanyId !== null ? onStartRename : undefined}
                onDownload={onDownload}
                onMove={selectedCompanyId !== null ? () => undefined : undefined}
                onDelete={selectedCompanyId !== null ? handleDeleteFile : undefined}
                selectedDocIds={selectedDocIds}
                onToggleSelect={toggleSelectDoc}
              />
            ) : null}
          </div>
        )}
      </div>

      {isFolderNavigationVisible && selectedCompanyId !== null && (
        <DocumentMoveDrawer
          key={`documentos_move_drawer_company_${selectedCompanyId}`}
          targets={moveTargets}
          dropTargetKey={dropTargetFolder}
          storageKey={`documentos_move_drawer_company_${selectedCompanyId}`}
          canDropOnFolder={canDropOnFolder}
          onDropItem={handleDropItem}
          onDropTargetChange={setDropTargetFolder}
        />
      )}
    </div>
    {children}
  </div>
);
