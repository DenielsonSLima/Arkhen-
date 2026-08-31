import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentQuickPreview } from '../../gestao-empresarial/components/DocumentQuickPreview';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { OrganizedDocumentList } from './OrganizedDocumentList';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';

import { RenameFileModal } from './RenameFileModal';
import { DocumentMoveDrawer, type DocumentMoveTarget } from './DocumentMoveDrawer';
import { DocumentosEmpresasBrowser } from './DocumentosEmpresasBrowser';
import { moveFolderTree } from '../utils/folderPaths';
import { matchesDocumentFileType } from '../utils/fileTypeFilters';
import { useCompanyLibraryWorkspace } from '../hooks/useCompanyLibraryWorkspace';

interface DocumentosEmpresasTabProps {
  companies: Company[];
  statusFilter: Company['status'];
  selectedDocIds: string[];
  toggleSelectDoc: (docId: string) => void;
  searchTerm: string;
  selectedCategoryFilter: string;
  fileTypeFilter: string;
  initialSelectedCompanyId?: string | null;
  initialSelectedEntryKey?: string | null;
  onCompanyChange?: (companyId: string | null, companyName?: string, entryKey?: string | null) => void;
  onClearSearch?: () => void;
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
  statusFilter,
  selectedDocIds,
  toggleSelectDoc,
  searchTerm,
  selectedCategoryFilter,
  fileTypeFilter,
  initialSelectedCompanyId,
  initialSelectedEntryKey,
  onCompanyChange,
  onClearSearch,
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
  const {
    entries,
    selectedEntryKey,
    setSelectedEntryKey,
    selectedEntry,
    selectedCompany,
    workspaceRootPath,
    currentFolder,
    foldersList,
    workspaceDocuments,
    ownerFolders,
    ownerDocuments,
    currentSubFolders,
    isAtWorkspaceRoot,
    parentFolder,
    siblingFolders,
    breadcrumbs,
    protectedBranchRoots,
  } = useCompanyLibraryWorkspace({
    companies,
    statusFilter,
    initialSelectedCompanyId,
    initialSelectedEntryKey,
    selectedFolder,
    onFolderChange,
    onCompanyChange,
  });
  const isProtectedBranchFolder = (path: string) => protectedBranchRoots.some(
    (root) => path === root || root.startsWith(`${path}/`),
  );
  const isWorkspaceFolder = (path: string) => foldersList.includes(path);
  const isWorkspaceTarget = (path: string | null) => (
    path === workspaceRootPath || (path !== null && isWorkspaceFolder(path))
  );
  const moveTargets = useMemo<DocumentMoveTarget[]>(() => {
    const targets: DocumentMoveTarget[] = [];
    if (currentFolder && !isAtWorkspaceRoot) {
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
      const fullPath = currentFolder ? `${currentFolder}/${shortName}` : shortName;
      const filesInFolder = workspaceDocuments.filter(d => {
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
  }, [currentFolder, currentSubFolders, isAtWorkspaceRoot, parentFolder, siblingFolders, workspaceDocuments]);

  const isFolderNavigationVisible = !searchTerm.trim()
    && selectedCategoryFilter === 'Todos'
    && fileTypeFilter === 'Todos';
  const hasFolderContent = isFolderNavigationVisible && currentSubFolders.length > 0;

  const allCompaniesDocs = useMemo(() => {
    return entries.flatMap(entry =>
      entry.documents.map(d => ({
        ...d,
        empresaNome: entry.displayName
      }))
    );
  }, [entries]);

  const selectedCompanyDocs = useMemo<CompanyDocumentWithCompany[]>(() => {
    if (!selectedEntry) return [];
    return workspaceDocuments.map(d => ({
      ...d,
      empresaNome: selectedEntry.displayName,
    }));
  }, [selectedEntry, workspaceDocuments]);

  const filteredDocs = useMemo(() => {
    let list = selectedEntry ? selectedCompanyDocs : allCompaniesDocs;

    if (selectedEntry && !searchTerm.trim()) {
      const isFileFilterActive = selectedCategoryFilter !== 'Todos' || fileTypeFilter !== 'Todos';
      list = list.filter(d => {
        const folder = d.pasta ?? null;
        if (isFileFilterActive && !currentFolder) return true;
        if (!isFileFilterActive || !currentFolder) return folder === currentFolder;
        return folder === currentFolder || Boolean(folder?.startsWith(`${currentFolder}/`));
      });
    }

    if (selectedCategoryFilter !== 'Todos') {
      list = list.filter(d => d.tipo === selectedCategoryFilter);
    }

    if (fileTypeFilter !== 'Todos') {
      list = list.filter(d => matchesDocumentFileType(d, fileTypeFilter));
    }

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
  }, [selectedEntry, selectedCompanyDocs, allCompaniesDocs, selectedCategoryFilter, fileTypeFilter, searchTerm, currentFolder]);

  const isGlobalSearchActive = selectedEntryKey === null && searchTerm.trim() !== '';

  const handleDeleteFolder = (shortName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCompany) return;
    const fullPath = currentFolder ? `${currentFolder}/${shortName}` : shortName;

    if (isProtectedBranchFolder(fullPath)) {
      setQuickModal({ title: 'Pasta vinculada à filial', message: 'Esta pasta é criada automaticamente para a filial e não pode ser removida pela Biblioteca.' });
      return;
    }

    const prefix = fullPath + '/';
    const folderFiles = ownerDocuments.filter(
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
          pastasDocumentos: ownerFolders.filter(f => f !== fullPath && !f.startsWith(prefix))
        });
      },
    });
  };

  const handleMoveFolder = async (sourcePath: string, targetPath: string | null) => {
    if (!selectedCompany) return;
    if (!isWorkspaceFolder(sourcePath) || !isWorkspaceTarget(targetPath)) {
      setQuickModal({ title: 'Movimentação inválida', message: 'A pasta não pertence à empresa ou filial selecionada.' });
      return;
    }
    if (isProtectedBranchFolder(sourcePath)) {
      setQuickModal({ title: 'Pasta vinculada à filial', message: 'Esta pasta é criada automaticamente para a filial e não pode ser movida pela Biblioteca.' });
      return;
    }
    const moved = moveFolderTree(sourcePath, targetPath, ownerFolders, ownerDocuments);
    if (!moved) return;
    const updatedCompany: Company = {
      ...selectedCompany,
      pastasDocumentos: moved.pastas,
      documentos: moved.documentos
    };
    try {
      await onSaveCompanyDocs?.(updatedCompany);
      if (currentFolder && (currentFolder === sourcePath || currentFolder.startsWith(sourcePath + '/'))) {
        onFolderChange(moved.movePath(currentFolder));
      }
    } catch (error) {
      setQuickModal({
        title: 'Falha ao mover pasta',
        message: error instanceof Error ? error.message : 'Não foi possível mover a pasta.',
      });
    }
    setDraggedFolder(null);
    setDropTargetFolder(null);
  };

  const handleMoveFileToFolder = async (docId: string, targetFolder: string | null) => {
    if (!selectedCompany) return;
    if (!workspaceDocuments.some((document) => document.id === docId) || !isWorkspaceTarget(targetFolder)) {
      setQuickModal({ title: 'Movimentação inválida', message: 'O arquivo ou a pasta de destino não pertence à empresa ou filial selecionada.' });
      return;
    }
    const docIds = workspaceDocuments.map(doc => doc.id);
    const idsToMove = selectedDocIds.includes(docId) ? selectedDocIds.filter(id => docIds.includes(id)) : [docId];
    const updatedDocs = ownerDocuments.map(d =>
      idsToMove.includes(d.id) ? { ...d, pasta: targetFolder || undefined } : d
    );
    const updatedCompany: Company = {
      ...selectedCompany,
      documentos: updatedDocs
    };
    try {
      await onSaveCompanyDocs?.(updatedCompany);
      const movedDoc = workspaceDocuments.find(d => d.id === docId);
      onNotify?.(
        idsToMove.length > 1
          ? `${idsToMove.length} arquivos movidos com sucesso.`
          : `Arquivo "${movedDoc?.nome || 'selecionado'}" movido com sucesso.`
      );
    } catch (error) {
      setQuickModal({
        title: 'Falha ao mover arquivo',
        message: error instanceof Error ? error.message : 'Não foi possível mover o arquivo.',
      });
    }
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
        void handleMoveFileToFolder(item.id, targetFolder);
      }
      if (item.kind === 'folder' && item.path) {
        void handleMoveFolder(item.path, targetFolder);
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
    const updatedDocs = ownerDocuments.map(d => d.id === renameDocId ? { ...d, nome: newName } : d);
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
        const deletedDoc = workspaceDocuments.find(d => d.id === docId);
        const updatedDocs = ownerDocuments.filter(d => d.id !== docId);
        await onSaveCompanyDocs?.({
          ...selectedCompany,
          documentos: updatedDocs
        });
        onNotify?.(`Arquivo "${deletedDoc?.nome || 'selecionado'}" apagado com sucesso.`);
      },
    });
  };

  const goBack = () => {
    if (!currentFolder || isAtWorkspaceRoot) return;
    onFolderChange(parentFolder);
  };

  const handleBackClick = () => {
    if (isGlobalSearchActive) {
      onClearSearch?.();
      return;
    }
    if (!isAtWorkspaceRoot) {
      goBack();
    } else {
      setSelectedEntryKey(null);
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
      onDrop={(event) => handleDropItem(event, currentFolder)}
      style={{ padding: '4px 0' }}
    >
      <div className="documents-move-layout">
        <div className="documents-move-main">
          <DocumentosEmpresasBrowser
            entries={entries}
            selectedEntryKey={selectedEntryKey}
            selectedEntry={selectedEntry}
            workspaceRootPath={workspaceRootPath}
            selectedFolder={currentFolder}
            breadcrumbs={breadcrumbs}
            filteredDocsCount={filteredDocs.length}
            isGlobalSearchActive={isGlobalSearchActive}
            isFolderNavigationVisible={isFolderNavigationVisible}
            currentSubFolders={currentSubFolders}
            documents={workspaceDocuments}
            draggedFolder={draggedFolder}
            dropTargetFolder={dropTargetFolder}
            onBackClick={handleBackClick}
            onFolderChange={onFolderChange}
            onEntrySelect={setSelectedEntryKey}
            onDraggedFolderChange={setDraggedFolder}
            onDropTargetChange={setDropTargetFolder}
            canDropOnFolder={canDropOnFolder}
            onDropItem={handleDropItem}
            onDeleteFolder={handleDeleteFolder}
            onDownloadFolder={onDownloadFolder}
          >
          {filteredDocs.length === 0 && !hasFolderContent ? (
            <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
              <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                {searchTerm || selectedCategoryFilter !== 'Todos' || fileTypeFilter !== 'Todos'
                  ? 'Nenhum arquivo encontrado para os filtros aplicados.'
                  : currentFolder !== workspaceRootPath ? 'Nenhum arquivo nesta pasta.' : 'Nenhum arquivo solto nesta empresa ou filial.'}
              </p>
            </div>
          ) : filteredDocs.length > 0 ? (
            <OrganizedDocumentList
              documents={filteredDocs}
              groupBy={groupBy}
              sortBy={sortBy}
              viewMode={viewMode}
              onPreview={setPreviewDoc}
              onRename={selectedEntryKey !== null ? (docId, currentName) => {
                setRenameDocId(docId);
                setRenameDocName(currentName);
              } : undefined}
              onDownload={onDownload}
              onMove={selectedEntryKey !== null ? () => undefined : undefined}
              onDelete={selectedEntryKey !== null ? handleDeleteFile : undefined}
              selectedDocIds={selectedDocIds}
              onToggleSelect={toggleSelectDoc}
            />
          ) : null}
          </DocumentosEmpresasBrowser>
        </div>

        {isFolderNavigationVisible && selectedEntryKey !== null && (
          <DocumentMoveDrawer
            key={`documentos_move_drawer_company_${selectedEntryKey}`}
            targets={moveTargets}
            dropTargetKey={dropTargetFolder}
            storageKey={`documentos_move_drawer_company_${selectedEntryKey}`}
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
