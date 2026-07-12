import React, { useEffect, useMemo, useState } from 'react';
import { 
  FolderOpen, AlertCircle, ArrowLeft, Trash2, ChevronRight, Download
} from 'lucide-react';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentQuickPreview } from '../../gestao-empresarial/components/DocumentQuickPreview';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { OrganizedDocumentList } from './OrganizedDocumentList';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';

// Imported modular modals and utilities
import { RenameFileModal } from './RenameFileModal';
import { DocumentMoveDrawer, type DocumentMoveTarget } from './DocumentMoveDrawer';
import { getDirectChildren, moveFolderTree } from '../utils/folderPaths';
import { matchesDocumentFileType } from '../utils/fileTypeFilters';

interface DocumentosEmpresasTabProps {
  companies: Company[];
  selectedDocIds: string[];
  toggleSelectDoc: (docId: string) => void;
  searchTerm: string;
  selectedCategoryFilter: string;
  fileTypeFilter: string;
  initialSelectedCompanyId?: string | null;
  onCompanyChange?: (companyId: string | null, companyName?: string) => void;
  viewMode: 'list' | 'grid' | 'compact';
  onSaveCompanyDocs?: (company: Company) => Promise<void> | void;
  selectedFolder: string | null;
  onFolderChange: (folder: string | null) => void;
  groupBy: DocumentGroupBy;
  sortBy: DocumentSortBy;
  onDownloadFolder?: (folderPath: string) => void;
  onDownload?: (doc: CompanyDocument) => void;
  onNotify?: (message: string) => void;
}

type CompanyDocumentWithCompany = CompanyDocument & {
  empresaNome: string;
};

export const DocumentosEmpresasTab: React.FC<DocumentosEmpresasTabProps> = ({
  companies,
  selectedDocIds,
  toggleSelectDoc,
  searchTerm,
  selectedCategoryFilter,
  fileTypeFilter,
  initialSelectedCompanyId,
  onCompanyChange,
  viewMode: initialViewMode,
  onSaveCompanyDocs,
  selectedFolder,
  onFolderChange,
  groupBy,
  sortBy,
  onDownloadFolder,
  onDownload,
  onNotify,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => initialSelectedCompanyId || null);

  // Modals and operations state
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null);
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameDocName, setRenameDocName] = useState('');
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [quickModal, setQuickModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm?: () => void;
  } | null>(null);

  const viewMode = initialViewMode;

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    onCompanyChange?.(selectedCompanyId, selectedCompany?.nome);
  }, [onCompanyChange, selectedCompanyId, selectedCompany?.nome]);

  // Clean folder path if we switch or reset the selected company
  useEffect(() => {
    onFolderChange(null);
  }, [selectedCompanyId, onFolderChange]);

  const foldersList = useMemo(() => {
    return selectedCompany?.pastasDocumentos || [];
  }, [selectedCompany?.pastasDocumentos]);

  const documents = useMemo(() => {
    return selectedCompany?.documentos || [];
  }, [selectedCompany?.documentos]);

  // Subpastas diretas da pasta atual do cliente selecionado
  const currentSubFolders = useMemo(
    () => getDirectChildren(foldersList, selectedFolder),
    [foldersList, selectedFolder]
  );
  const parentFolder = useMemo(() => {
    if (!selectedFolder) return null;
    const parts = selectedFolder.split('/');
    parts.pop();
    return parts.length > 0 ? parts.join('/') : null;
  }, [selectedFolder]);
  const siblingFolders = useMemo(() => {
    if (!selectedFolder) return [];
    const currentName = selectedFolder.split('/').at(-1);
    return getDirectChildren(foldersList, parentFolder).filter((folder) => folder !== currentName);
  }, [foldersList, parentFolder, selectedFolder]);
  const moveTargets = useMemo<DocumentMoveTarget[]>(() => {
    const targets: DocumentMoveTarget[] = [];
    if (selectedFolder) {
      targets.push({
        key: parentFolder ?? '__root__',
        label: parentFolder ? `Voltar para ${parentFolder.split('/').at(-1)}` : 'Mover para a raiz',
        targetFolder: parentFolder,
        description: parentFolder ? 'Soltar na pasta acima' : 'Soltar fora das pastas',
      });
      siblingFolders.forEach((shortName) => {
        const fullPath = parentFolder ? `${parentFolder}/${shortName}` : shortName;
        targets.push({
          key: fullPath,
          label: shortName,
          targetFolder: fullPath,
          description: 'Outra pasta no mesmo nível',
        });
      });
    }
    currentSubFolders.forEach((shortName) => {
      const fullPath = selectedFolder ? `${selectedFolder}/${shortName}` : shortName;
      const filesInFolder = documents.filter(d => {
        if (!d.pasta) return false;
        return d.pasta === fullPath || d.pasta.startsWith(fullPath + '/');
      }).length;
      targets.push({
        key: fullPath,
        label: shortName,
        targetFolder: fullPath,
        description: `${filesInFolder} ${filesInFolder === 1 ? 'arquivo' : 'arquivos'}`,
      });
    });
    return targets;
  }, [currentSubFolders, documents, parentFolder, selectedFolder, siblingFolders]);

  // Custom company breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path: string | null }[] = [{ label: selectedCompany?.nome || '', path: null }];
    if (!selectedFolder) return crumbs;
    const parts = selectedFolder.split('/');
    parts.forEach((part, index) => {
      crumbs.push({ label: part, path: parts.slice(0, index + 1).join('/') });
    });
    return crumbs;
  }, [selectedCompany?.nome, selectedFolder]);

  const isFolderNavigationVisible = !searchTerm.trim()
    && selectedCategoryFilter === 'Todos'
    && fileTypeFilter === 'Todos';
  const hasFolderContent = isFolderNavigationVisible && currentSubFolders.length > 0;

  // Flat array of all documents from all companies, with company names injected
  const allCompaniesDocs = useMemo(() => {
    return companies.flatMap(c => 
      (c.documentos || []).map(d => ({
        ...d,
        empresaNome: c.nome
      }))
    );
  }, [companies]);

  const selectedCompanyDocs = useMemo<CompanyDocumentWithCompany[]>(() => {
    if (!selectedCompany) return [];
    return documents.map(d => ({
      ...d,
      empresaNome: selectedCompany.nome,
    }));
  }, [selectedCompany, documents]);

  // Filtered documents list
  const filteredDocs = useMemo(() => {
    let list = selectedCompany ? selectedCompanyDocs : allCompaniesDocs;

    if (selectedCompany && !searchTerm.trim()) {
      const isFileFilterActive = selectedCategoryFilter !== 'Todos' || fileTypeFilter !== 'Todos';
      list = list.filter(d => {
        const folder = d.pasta ?? null;
        if (isFileFilterActive && !selectedFolder) return true;
        if (!isFileFilterActive || !selectedFolder) return folder === selectedFolder;
        return folder === selectedFolder || Boolean(folder?.startsWith(`${selectedFolder}/`));
      });
    }

    // Apply category filter
    if (selectedCategoryFilter !== 'Todos') {
      list = list.filter(d => d.tipo === selectedCategoryFilter);
    }

    if (fileTypeFilter !== 'Todos') {
      list = list.filter(d => matchesDocumentFileType(d, fileTypeFilter));
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(d => 
        d.nome.toLowerCase().includes(lowerSearch) ||
        d.tipo.toLowerCase().includes(lowerSearch) ||
        d.empresaNome.toLowerCase().includes(lowerSearch) ||
        (d.descricao && d.descricao.toLowerCase().includes(lowerSearch))
      );
    }

    return list;
  }, [selectedCompany, selectedCompanyDocs, allCompaniesDocs, selectedCategoryFilter, fileTypeFilter, searchTerm, selectedFolder]);

  // Determine if we should show the folder layout or unrolled search results
  const isGlobalSearchActive = selectedCompanyId === null && searchTerm.trim() !== '';

  // --- Core CRUD Handlers for Company Folder / Files ---

  const handleDeleteFolder = (shortName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCompany) return;
    const fullPath = selectedFolder ? `${selectedFolder}/${shortName}` : shortName;

    const prefix = fullPath + '/';
    const folderFiles = documents.filter(
      d => d.pasta === fullPath || (d.pasta && d.pasta.startsWith(prefix))
    );

    if (folderFiles.length > 0) {
      setQuickModal({
        title: 'Pasta com Arquivos',
        message: 'Não é possível excluir esta pasta porque ela contém arquivos. Mova ou exclua os arquivos primeiro.',
      });
      return;
    }

    setQuickModal({
      title: 'Excluir Pasta',
      message: `Tem certeza de que deseja excluir a pasta "${shortName}"?`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: () => {
        onSaveCompanyDocs?.({
          ...selectedCompany,
          pastasDocumentos: foldersList.filter(f => f !== fullPath && !f.startsWith(prefix))
        });
      },
    });
  };

  const handleMoveFolder = (sourcePath: string, targetPath: string | null) => {
    if (!selectedCompany) return;
    const moved = moveFolderTree(sourcePath, targetPath, foldersList, documents);
    if (!moved) return;
    const updatedCompany: Company = {
      ...selectedCompany,
      pastasDocumentos: moved.pastas,
      documentos: moved.documentos
    };
    onSaveCompanyDocs?.(updatedCompany);
    if (selectedFolder && (selectedFolder === sourcePath || selectedFolder.startsWith(sourcePath + '/'))) {
      onFolderChange(moved.movePath(selectedFolder));
    }
    setDraggedFolder(null);
    setDropTargetFolder(null);
  };

  const handleMoveFileToFolder = async (docId: string, targetFolder: string | null) => {
    if (!selectedCompany) return;
    const docIds = documents.map(doc => doc.id);
    const idsToMove = selectedDocIds.includes(docId) ? selectedDocIds.filter(id => docIds.includes(id)) : [docId];
    const updatedDocs = documents.map(d =>
      idsToMove.includes(d.id) ? { ...d, pasta: targetFolder || undefined } : d
    );
    const updatedCompany: Company = {
      ...selectedCompany,
      documentos: updatedDocs
    };
    await onSaveCompanyDocs?.(updatedCompany);
    const movedDoc = documents.find(d => d.id === docId);
    onNotify?.(
      idsToMove.length > 1
        ? `${idsToMove.length} arquivos movidos com sucesso.`
        : `Arquivo "${movedDoc?.nome || 'selecionado'}" movido com sucesso.`
    );
  };

  const handleDropItem = (event: React.DragEvent, targetFolder: string | null) => {
    event.preventDefault();
    setDropTargetFolder(null);
    if (!selectedCompany) return;
    const payload = event.dataTransfer.getData('application/x-documentos-item');
    if (!payload) return;

    try {
      const item = JSON.parse(payload) as { kind?: string; id?: string; path?: string };
      if (item.kind === 'document' && item.id) {
        handleMoveFileToFolder(item.id, targetFolder);
      }
      if (item.kind === 'folder' && item.path) {
        handleMoveFolder(item.path, targetFolder);
      }
    } catch {
      // Invalid drag payloads are ignored.
    }
  };

  const canDropOnFolder = (event: React.DragEvent, targetFolder: string | null) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-documentos-item')) return false;
    if (!draggedFolder) return true;
    return draggedFolder !== targetFolder && !(targetFolder || '').startsWith(draggedFolder + '/');
  };

  const handleRenameFileSubmit = async (newName: string) => {
    if (!selectedCompany || !renameDocId) return;
    const updatedDocs = documents.map(d => d.id === renameDocId ? { ...d, nome: newName } : d);
    const updatedCompany: Company = {
      ...selectedCompany,
      documentos: updatedDocs
    };
    await onSaveCompanyDocs?.(updatedCompany);
    setRenameDocId(null);
    setRenameDocName('');
    onNotify?.(`Arquivo renomeado para "${newName}".`);
  };

  const handleDeleteFile = (docId: string) => {
    if (!selectedCompany) return;
    setQuickModal({
      title: 'Excluir Arquivo',
      message: 'Tem certeza de que deseja excluir este arquivo permanentemente?',
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        const deletedDoc = documents.find(d => d.id === docId);
        const updatedDocs = documents.filter(d => d.id !== docId);
        await onSaveCompanyDocs?.({
          ...selectedCompany,
          documentos: updatedDocs
        });
        onNotify?.(`Arquivo "${deletedDoc?.nome || 'selecionado'}" apagado com sucesso.`);
      },
    });
  };

  const goBack = () => {
    if (!selectedFolder) return;
    const parts = selectedFolder.split('/');
    parts.pop();
    onFolderChange(parts.length === 0 ? null : parts.join('/'));
  };

  const handleBackClick = () => {
    if (selectedFolder !== null) {
      goBack();
    } else {
      setSelectedCompanyId(null);
    }
  };

  return (
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
      
      {/* Path Breadcrumbs & Top actions row */}
      {(selectedCompanyId !== null || isGlobalSearchActive) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleBackClick}
              style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', padding: '4px' }}
            >
              <ArrowLeft size={16} />
            </button>
            
            <button
              onClick={() => onFolderChange(null)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                fontSize: '0.88rem', fontWeight: selectedFolder === null ? 800 : 600,
                color: selectedFolder === null ? 'var(--color-gold-dark)' : '#64748b'
              }}
            >
              {selectedCompany?.nome || 'Documentos da Empresa'}
            </button>

            {selectedFolder && breadcrumbs.slice(1).map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
                <button
                  onClick={() => onFolderChange(crumb.path)}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                    fontSize: '0.88rem', fontWeight: i === breadcrumbs.length - 2 ? 800 : 600,
                    color: i === breadcrumbs.length - 2 ? 'var(--color-gold-dark)' : '#64748b'
                  }}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}

            {isGlobalSearchActive && (
              <>
                <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-gold-dark)', padding: '2px 4px' }}>
                  Pesquisa Global
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Title / Section Header Row */}
      {(selectedCompanyId !== null || isGlobalSearchActive) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isGlobalSearchActive 
              ? 'Busca Global entre Clientes' 
              : `Arquivos da Empresa (${filteredDocs.length})`
            }
          </div>
        </div>
      )}

      {/* Directory of Company Folders OR unrolled global search results */}
      {selectedCompanyId === null && !isGlobalSearchActive ? (
        <div>
          {companies.length === 0 ? (
            <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
              <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                Nenhuma empresa cliente cadastrada no Supabase.
              </p>
            </div>
          ) : (
            <div className="docs-folders-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {companies.map((company) => {
              const filesCount = company.documentos.length;
              return (
                <div 
                  key={company.id} 
                  className="doc-folder-card" 
                  onClick={() => setSelectedCompanyId(company.id)}
                  style={{ position: 'relative', alignItems: 'flex-start', paddingTop: '14px', paddingBottom: '14px' }}
                >
                  <FolderOpen className="doc-folder-icon" size={22} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
                  <div className="doc-folder-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{company.nome}</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                      CNPJ: {company.cnpj || 'Não cadastrado'}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: company.tipoEstabelecimento === 'Matriz' ? '#eff6ff' : '#f5f5f4',
                        color: company.tipoEstabelecimento === 'Matriz' ? '#1e40af' : '#44403c',
                        border: company.tipoEstabelecimento === 'Matriz' ? '1px solid #bfdbfe' : '1px solid #e7e5e4'
                      }}>
                        {company.tipoEstabelecimento}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a'
                      }}>
                        {company.tipo}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#f0fdf4',
                        color: '#166534',
                        border: '1px solid #bbf7d0',
                        marginLeft: 'auto'
                      }}>
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
        /* Selected Company Documents View OR Global Search Results Listing */
        <div>
          
          {/* Company subfolders rendering */}
          {isFolderNavigationVisible && selectedCompanyId !== null && (selectedFolder || currentSubFolders.length > 0) && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                {selectedFolder ? 'Subpastas' : 'Pastas da empresa'}
              </div>
              <div className="docs-folders-grid">
                {currentSubFolders.map((shortName, index) => {
                  const fullPath = selectedFolder ? `${selectedFolder}/${shortName}` : shortName;
                  const filesInFolder = documents.filter(d => {
                    if (!d.pasta) return false;
                    return d.pasta === fullPath || d.pasta.startsWith(fullPath + '/');
                  }).length;
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
                      onDragEnd={() => {
                        setDraggedFolder(null);
                        setDropTargetFolder(null);
                      }}
                      onDragOver={(event) => {
                        if (!canDropOnFolder(event, fullPath)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTargetFolder(fullPath);
                      }}
                      onDragLeave={() => setDropTargetFolder((current) => current === fullPath ? null : current)}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDropItem(event, fullPath);
                      }}
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
                        <button
                      onClick={(e) => handleDeleteFolder(shortName, e)}
                          style={{ border: 'none', background: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex' }}
                          title="Excluir Pasta"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadFolder?.(fullPath);
                        }}
                        style={{ border: 'none', background: 'none', color: 'var(--color-gold-dark)', padding: '4px', cursor: 'pointer', display: 'flex' }}
                        title="Baixar pasta em ZIP"
                      >
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
              onPreview={setPreviewDoc}
              onRename={selectedCompanyId !== null ? (docId, currentName) => {
                setRenameDocId(docId);
                setRenameDocName(currentName);
              } : undefined}
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

      {/* MODAL - RENAME FILE */}
      <RenameFileModal
        isOpen={renameDocId !== null}
        onClose={() => {
          setRenameDocId(null);
          setRenameDocName('');
        }}
        onSubmit={handleRenameFileSubmit}
        currentName={renameDocName}
      />

      {/* DOCUMENT PREVIEW OVERLAY */}
      {previewDoc && (
        <DocumentQuickPreview 
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <SystemQuickModal
        isOpen={quickModal !== null}
        title={quickModal?.title || ''}
        message={quickModal?.message || ''}
        confirmLabel={quickModal?.confirmLabel}
        danger={quickModal?.danger}
        onConfirm={quickModal?.onConfirm}
        onClose={() => setQuickModal(null)}
      />

    </div>
  );
};
