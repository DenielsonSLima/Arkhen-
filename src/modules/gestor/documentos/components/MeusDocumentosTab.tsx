import React, { useEffect, useMemo, useState } from 'react';
import { 
  FolderOpen, AlertCircle, Download,
  Trash2, ArrowLeft, ChevronRight
} from 'lucide-react';
import type { MeusDocumentosData } from '../services/documentosService';
import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentQuickPreview } from '../../gestao-empresarial/components/DocumentQuickPreview';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { OrganizedDocumentList } from './OrganizedDocumentList';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';

// Imported modular modals
import { RenameFileModal } from './RenameFileModal';
import { buildBreadcrumb, getDirectChildren, moveFolderTree } from '../utils/folderPaths';

interface MeusDocumentosTabProps {
  meusDocs: MeusDocumentosData;
  onSaveMeusDocs: (data: MeusDocumentosData) => void;
  selectedDocIds: string[];
  toggleSelectDoc: (docId: string) => void;
  searchTerm: string;
  selectedCategoryFilter: string;
  fileTypeFilter: string;
  initialSelectedFolder?: string | null;
  onFolderChange?: (folder: string | null) => void;
  viewMode: 'list' | 'grid' | 'compact';
  groupBy: DocumentGroupBy;
  sortBy: DocumentSortBy;
  onDownloadFolder?: (folderPath: string) => void;
  onNotify?: (message: string) => void;
}

export const MeusDocumentosTab: React.FC<MeusDocumentosTabProps> = ({
  meusDocs,
  onSaveMeusDocs,
  selectedDocIds,
  toggleSelectDoc,
  searchTerm,
  selectedCategoryFilter,
  fileTypeFilter,
  initialSelectedFolder,
  onFolderChange,
  viewMode,
  groupBy,
  sortBy,
  onDownloadFolder,
  onNotify,
}) => {
  // path completo da pasta atual (null = raiz)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => initialSelectedFolder || null);

  // Modals state
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

  const foldersList = useMemo(() => meusDocs.pastas || [], [meusDocs.pastas]);
  const documents = useMemo(() => meusDocs.documentos || [], [meusDocs.documentos]);

  useEffect(() => {
    onFolderChange?.(selectedFolder);
  }, [onFolderChange, selectedFolder]);

  // Subpastas diretas da pasta atual
  const currentSubFolders = useMemo(
    () => getDirectChildren(foldersList, selectedFolder),
    [foldersList, selectedFolder]
  );

  // Breadcrumb
  const breadcrumb = useMemo(() => buildBreadcrumb(selectedFolder), [selectedFolder]);
  const hasFolderContent = !searchTerm.trim() && currentSubFolders.length > 0;

  const filteredDocs = useMemo(() => {
    let list = documents;

    if (!searchTerm.trim()) {
      // sem busca: mostra só arquivos cuja pasta === path atual
      list = list.filter(d => (d.pasta ?? null) === selectedFolder);
    }

    if (selectedCategoryFilter !== 'Todos') {
      list = list.filter(d => d.tipo === selectedCategoryFilter);
    }

    if (fileTypeFilter !== 'Todos') {
      list = list.filter(d => {
        const ext = d.nome.split('.').pop()?.toLowerCase();
        if (fileTypeFilter === 'image') return ext === 'png' || ext === 'jpg' || ext === 'jpeg';
        if (fileTypeFilter === 'pdf') return ext === 'pdf';
        if (fileTypeFilter === 'docx') return ext === 'docx' || ext === 'doc';
        if (fileTypeFilter === 'xlsx') return ext === 'xlsx' || ext === 'xls';
        if (fileTypeFilter === 'xml') return ext === 'xml';
        if (fileTypeFilter === 'text') return ['txt', 'efd', 'ecd', 'ecf'].includes(ext || '');
        if (fileTypeFilter === 'csv') return ext === 'csv';
        if (fileTypeFilter === 'bank') return ['ofx', 'qif', 'rem', 'ret', 'cnab'].includes(ext || '');
        if (fileTypeFilter === 'certificate') return ['pfx', 'p12', 'cer', 'crt', 'pem', 'p7s'].includes(ext || '');
        if (fileTypeFilter === 'archive') return ['zip', 'rar', '7z'].includes(ext || '');
        if (fileTypeFilter === 'email') return ['eml', 'msg'].includes(ext || '');
        return true;
      });
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(d =>
        d.nome.toLowerCase().includes(lowerSearch) ||
        d.tipo.toLowerCase().includes(lowerSearch) ||
        (d.descricao && d.descricao.toLowerCase().includes(lowerSearch))
      );
    }

    return list;
  }, [documents, selectedFolder, selectedCategoryFilter, fileTypeFilter, searchTerm]);

  // --- Actions ---

  const handleDeleteFolder = (shortName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullPath = selectedFolder ? `${selectedFolder}/${shortName}` : shortName;

    // Todos arquivos dentro desta pasta (recursivo)
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
        onSaveMeusDocs({
          ...meusDocs,
          pastas: foldersList.filter(f => f !== fullPath && !f.startsWith(prefix))
        });
      },
    });
  };

  const handleMoveFolder = (sourcePath: string, targetPath: string | null) => {
    const moved = moveFolderTree(sourcePath, targetPath, foldersList, documents);
    if (!moved) return;
    onSaveMeusDocs({ ...meusDocs, pastas: moved.pastas, documentos: moved.documentos });
    if (selectedFolder && (selectedFolder === sourcePath || selectedFolder.startsWith(sourcePath + '/'))) {
      setSelectedFolder(moved.movePath(selectedFolder));
    }
    setDraggedFolder(null);
    setDropTargetFolder(null);
  };

  const handleMoveFileToFolder = async (docId: string, targetFolder: string | null) => {
    const docIds = documents.map(doc => doc.id);
    const idsToMove = selectedDocIds.includes(docId) ? selectedDocIds.filter(id => docIds.includes(id)) : [docId];
    const updatedDocs = documents.map(d =>
      idsToMove.includes(d.id) ? { ...d, pasta: targetFolder || undefined } : d
    );
    await onSaveMeusDocs({ ...meusDocs, documentos: updatedDocs });
    const movedDoc = documents.find(d => d.id === docId);
    onNotify?.(
      idsToMove.length > 1
        ? `${idsToMove.length} arquivos movidos com sucesso.`
        : `Arquivo "${movedDoc?.nome || 'selecionado'}" movido com sucesso.`
    );
  };

  const handleDropItem = (event: React.DragEvent, targetFolder: string | null) => {
    event.preventDefault();
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

  const handleRenameFileSubmit = async (newName: string) => {
    if (!renameDocId) return;
    const updatedDocs = documents.map(d => d.id === renameDocId ? { ...d, nome: newName } : d);
    await onSaveMeusDocs({ ...meusDocs, documentos: updatedDocs });
    setRenameDocId(null);
    setRenameDocName('');
    onNotify?.(`Arquivo renomeado para "${newName}".`);
  };

  const handleDeleteFile = (docId: string) => {
    setQuickModal({
      title: 'Excluir Arquivo',
      message: 'Tem certeza de que deseja excluir este arquivo permanentemente?',
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        const deletedDoc = documents.find(d => d.id === docId);
        const updatedDocs = documents.filter(d => d.id !== docId);
        await onSaveMeusDocs({ ...meusDocs, documentos: updatedDocs });
        onNotify?.(`Arquivo "${deletedDoc?.nome || 'selecionado'}" apagado com sucesso.`);
      },
    });
  };

  const goBack = () => {
    if (!selectedFolder) return;
    const parts = selectedFolder.split('/');
    parts.pop();
    setSelectedFolder(parts.length === 0 ? null : parts.join('/'));
  };

  return (
    <div
      className="animate-fade-in"
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('application/x-documentos-item')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(event) => handleDropItem(event, selectedFolder)}
      style={{ padding: '4px 0' }}
    >
      
      {/* Breadcrumb */}
      {selectedFolder !== null && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '4px', flexWrap: 'wrap' }}>
        
          <button
            onClick={goBack}
            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', padding: '4px' }}
          >
            <ArrowLeft size={16} />
          </button>
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={14} style={{ color: '#cbd5e1' }} />}
              <button
                onClick={() => setSelectedFolder(crumb.path)}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                  fontSize: '0.88rem', fontWeight: i === breadcrumb.length - 1 ? 800 : 600,
                  color: i === breadcrumb.length - 1 ? 'var(--color-gold-dark)' : '#64748b'
                }}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Arquivos count */}
      {(selectedFolder || searchTerm) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {searchTerm ? 'Busca Global' : 'Arquivos nesta pasta'} ({filteredDocs.length})
          </div>
        </div>
      )}

      {/* Subpastas da pasta atual */}
      {!searchTerm.trim() && currentSubFolders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {selectedFolder && (
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
              Subpastas
            </div>
          )}
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
                  onClick={() => setSelectedFolder(fullPath)}
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
                    if (draggedFolder && draggedFolder !== fullPath && !fullPath.startsWith(draggedFolder + '/')) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropTargetFolder(fullPath);
                    }
                  }}
                  onDragLeave={() => setDropTargetFolder((current) => current === fullPath ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDropItem(event, fullPath);
                  }}
                  style={{
                    outline: dropTargetFolder === fullPath ? '2px solid var(--color-gold-primary)' : undefined,
                    opacity: draggedFolder === fullPath ? 0.55 : 1,
                    cursor: 'grab',
                  }}
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

      {/* Render Files */}
      {filteredDocs.length === 0 && !hasFolderContent ? (
        <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
          <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            {searchTerm || selectedCategoryFilter !== 'Todos' || fileTypeFilter !== 'Todos'
              ? 'Nenhum arquivo encontrado para os filtros aplicados.'
              : selectedFolder ? 'Nenhum arquivo nesta pasta.' : 'Nenhum arquivo solto na biblioteca.'}
          </p>
        </div>
      ) : filteredDocs.length > 0 ? (
        <OrganizedDocumentList
          documents={filteredDocs}
          groupBy={groupBy}
          sortBy={sortBy}
          viewMode={viewMode}
          onPreview={setPreviewDoc}
          onRename={(docId, currentName) => {
            setRenameDocId(docId);
            setRenameDocName(currentName);
          }}
          onMove={() => undefined}
          onDelete={handleDeleteFile}
          selectedDocIds={selectedDocIds}
          onToggleSelect={toggleSelectDoc}
        />
      ) : null}

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
