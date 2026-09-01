import React, { useEffect, useMemo, useState } from 'react';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentQuickPreview } from '../../gestao-empresarial/components/DocumentQuickPreview';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';
import { DocumentosEmpresasTabView } from './DocumentosEmpresasTabView';

// Imported modular modals and utilities
import { RenameFileModal } from './RenameFileModal';
import type { DocumentMoveTarget } from './DocumentMoveDrawer';
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
    <DocumentosEmpresasTabView
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompany={selectedCompany}
        setSelectedCompanyId={setSelectedCompanyId}
        selectedFolder={selectedFolder}
        onFolderChange={onFolderChange}
        breadcrumbs={breadcrumbs}
        isGlobalSearchActive={isGlobalSearchActive}
        isFolderNavigationVisible={isFolderNavigationVisible}
        currentSubFolders={currentSubFolders}
        documents={documents}
        filteredDocs={filteredDocs}
        hasFolderContent={hasFolderContent}
        searchTerm={searchTerm}
        selectedCategoryFilter={selectedCategoryFilter}
        fileTypeFilter={fileTypeFilter}
        groupBy={groupBy}
        sortBy={sortBy}
        viewMode={viewMode}
        selectedDocIds={selectedDocIds}
        toggleSelectDoc={toggleSelectDoc}
        draggedFolder={draggedFolder}
        setDraggedFolder={setDraggedFolder}
        dropTargetFolder={dropTargetFolder}
        setDropTargetFolder={setDropTargetFolder}
        moveTargets={moveTargets}
        handleBackClick={handleBackClick}
        handleDeleteFolder={handleDeleteFolder}
        handleDeleteFile={handleDeleteFile}
        handleDropItem={handleDropItem}
        canDropOnFolder={canDropOnFolder}
        onDownloadFolder={onDownloadFolder}
        onDownload={onDownload}
        onPreview={setPreviewDoc}
        onStartRename={(docId, currentName) => {
          setRenameDocId(docId);
          setRenameDocName(currentName);
        }}
    >

      <RenameFileModal
        isOpen={renameDocId !== null}
        onClose={() => {
          setRenameDocId(null);
          setRenameDocName('');
        }}
        onSubmit={handleRenameFileSubmit}
        currentName={renameDocName}
      />

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
    </DocumentosEmpresasTabView>
  );
};
