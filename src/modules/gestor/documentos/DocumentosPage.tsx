import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useDocumentos } from './hooks/useDocumentos';
import type { DocumentosTab } from './hooks/useDocumentos';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import type { Company, CompanyDocument } from '../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentCategory } from './services/documentosService';
import type { ShareableDocument } from './services/documentShareService';
import { DocumentosToolbar } from './components/DocumentosToolbar';
import { DocumentosPageOverlays, type DocumentosQuickModalState } from './components/DocumentosPageOverlays';
import { DocumentosLoadingState } from './components/DocumentosLoadingState';
import type { DocumentGroupBy, DocumentSortBy } from './utils/documentOrganization';
import { normalizeFolderPath } from './utils/folderPaths';
import { getDocumentosTitleSuffix, getFolderDocuments, getFolderLabel, makeDocumentCategoryId } from './utils/documentosPageHelpers';
import { documentosPreferencesService } from './services/documentosPreferencesService';
import {
  createDocumentCategory,
  documentosService,
  isDefaultDocumentCategoryName,
  normalizeDocumentCategoryNames,
} from './services/documentosService';
import './Documentos.css';
const MeusDocumentosTab = React.lazy(() => import('./components/MeusDocumentosTab').then((module) => ({ default: module.MeusDocumentosTab })));
const DocumentosEmpresasTab = React.lazy(() => import('./components/DocumentosEmpresasTab').then((module) => ({ default: module.DocumentosEmpresasTab })));
const TodosDocumentosTab = React.lazy(() => import('./components/TodosDocumentosTab').then((module) => ({ default: module.TodosDocumentosTab })));
const SharedDocumentsTab = React.lazy(() => import('./components/SharedDocumentsTab').then((module) => ({ default: module.SharedDocumentsTab })));
const SolicitacoesDocumentosTab = React.lazy(() => import('./components/SolicitacoesDocumentosTab').then((module) => ({ default: module.SolicitacoesDocumentosTab })));
interface DocumentosPageProps {
  initialActiveTab?: DocumentosTab;
  initialPersonalFolder?: string | null;
  initialCompanyId?: string | null;
  initialCompanyEntryKey?: string | null;
  onViewContextChange?: (context: InternalTabContext) => void;
}
export const DocumentosPage: React.FC<DocumentosPageProps> = ({
  initialActiveTab,
  initialPersonalFolder,
  initialCompanyId,
  initialCompanyEntryKey,
  onViewContextChange,
}) => {
  const {
    activeTab,
    setActiveTab,
    meusDocs,
    saveMeusDocs,
    companies,
    saveCompanyDocs,
    selectedDocIds,
    toggleSelectDoc,
    selectAllDocs,
    clearSelection,
    handleBulkDownload,
    searchTerm,
    setSearchTerm,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    fileTypeFilter,
    setFileTypeFilter,
    categoriesList,
    saveCategories,
    uploadPersonalDocument,
    uploadCompanyDocument,
    isLoading
  } = useDocumentos({ initialActiveTab });
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [personalFolder, setPersonalFolder] = useState<string | null>(() => initialPersonalFolder || null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('grid');
  const [groupBy, setGroupBy] = useState<DocumentGroupBy>('none');
  const [sortBy, setSortBy] = useState<DocumentSortBy>('recent');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [selectedCompanyContext, setSelectedCompanyContext] = useState<{ id: string | null; name?: string; entryKey?: string | null }>(() => ({
    id: initialCompanyId || null,
    entryKey: initialCompanyEntryKey || null,
  }));
  const [companyFolder, setCompanyFolder] = useState<string | null>(null);
  const [quickModal, setQuickModal] = useState<DocumentosQuickModalState | null>(null);
  const personalFoldersList = useMemo(() => meusDocs.pastas || [], [meusDocs.pastas]);
  const personalDocuments = useMemo(() => meusDocs.documentos || [], [meusDocs.documentos]);
  const personalCategoriesList = useMemo(() => (
    (meusDocs.categorias || []).filter((item) => item.ativo).map((item) => item.nome)
  ), [meusDocs.categorias]);
  const handleCompanyChange = useCallback((id: string | null, name?: string, entryKey?: string | null) => {
    setSelectedCompanyContext((current) => (
      current.id === id && current.name === name && current.entryKey === entryKey
        ? current
        : { id, name, entryKey }
    ));
  }, []);
  const handleTabChange = useCallback((nextTab: DocumentosTab) => {
    if (nextTab !== activeTab) {
      setCompanyFolder(null);
      setSelectedCompanyContext({ id: null, entryKey: null });
    }
    setActiveTab(nextTab);
  }, [activeTab, setActiveTab]);
  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message);
  }, []);
  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [successToast]);
  const titleSuffix = useMemo(
    () => getDocumentosTitleSuffix(activeTab, personalFolder, selectedCompanyContext.name),
    [activeTab, personalFolder, selectedCompanyContext.name],
  );
  useEffect(() => {
    onViewContextChange?.({
      titleSuffix,
      data: {
        activeTab,
        personalFolder,
        selectedCompanyId: selectedCompanyContext.id,
        selectedCompanyEntryKey: selectedCompanyContext.entryKey,
      },
    });
  }, [activeTab, onViewContextChange, personalFolder, selectedCompanyContext.entryKey, selectedCompanyContext.id, titleSuffix]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const saved = await documentosPreferencesService.getPageLastAccess();
      if (mounted && saved) {
        setLastAccess(new Date(saved).toLocaleString('pt-BR'));
      }
      await documentosPreferencesService.setPageLastAccess(new Date().toISOString());
    })();
    return () => {
      mounted = false;
    }
  }, []);
  const handleCreatePersonalFolder = useCallback((folderName: string) => {
    const normalizedName = normalizeFolderPath(folderName);
    if (!normalizedName) return;
    const fullPath = personalFolder ? `${personalFolder}/${normalizedName}` : normalizedName;
    if (personalFoldersList.some((folder) => normalizeFolderPath(folder).toLowerCase() === fullPath.toLowerCase())) {
      setQuickModal({ title: 'Pasta já Existe', message: 'Uma pasta com este nome já existe aqui.' });
      return;
    }
    saveMeusDocs({ ...meusDocs, pastas: [...personalFoldersList, fullPath] });
    setShowCreateFolderModal(false);
  }, [meusDocs, personalFolder, personalFoldersList, saveMeusDocs]);

  const handleUploadPersonalFile = useCallback(async (file: File, category: string, description: string, targetFolder: string, dataValidade?: string) => {
    const uploadedDocument = await uploadPersonalDocument({ file, category, description, targetFolder, dataValidade });
    showSuccessToast(`Arquivo "${uploadedDocument.nome}" enviado com sucesso.`);
    return uploadedDocument;
  }, [showSuccessToast, uploadPersonalDocument]);

  const handleBulkDownloadSelected = useCallback(async () => {
    if (activeTab === 'meus') {
      await handleBulkDownload(personalDocuments.filter(d => selectedDocIds.includes(d.id)));
    } else {
      await handleBulkDownload(companies
        .flatMap(c => c.documentos || [])
        .filter(d => selectedDocIds.includes(d.id)));
    }
  }, [activeTab, handleBulkDownload, personalDocuments, companies, selectedDocIds]);

  const handleDownloadDocument = useCallback(async (document: CompanyDocument) => {
    try {
      await documentosService.downloadDocument(document);
    } catch (error) {
      setQuickModal({
        title: 'Falha ao baixar',
        message: error instanceof Error ? error.message : 'Não foi possível baixar este arquivo.',
        confirmLabel: 'Fechar',
      });
    }
  }, []);

  const handleBulkDeleteSelected = useCallback(() => {
    const selectedIds = new Set(selectedDocIds);
    const personalSelectedCount = personalDocuments.filter(doc => selectedIds.has(doc.id)).length;
    const companiesWithSelected = companies
      .map((company) => ({
        company,
        selectedCount: (company.documentos || []).filter(doc => selectedIds.has(doc.id)).length,
      }))
      .filter(({ selectedCount }) => selectedCount > 0);
    const totalSelected = personalSelectedCount + companiesWithSelected.reduce((total, item) => total + item.selectedCount, 0);

    if (totalSelected === 0) return;

    setQuickModal({
      title: totalSelected === 1 ? 'Apagar Arquivo' : 'Apagar Arquivos',
      message: totalSelected === 1
        ? 'Tem certeza de que deseja apagar este arquivo permanentemente?'
        : `Tem certeza de que deseja apagar ${totalSelected} arquivos permanentemente?`,
      confirmLabel: 'Apagar',
      danger: true,
      onConfirm: async () => {
        if (personalSelectedCount > 0) {
          await saveMeusDocs({
            ...meusDocs,
            documentos: personalDocuments.filter(doc => !selectedIds.has(doc.id)),
          });
        }

        await Promise.all(companiesWithSelected.map(({ company }) => (
          saveCompanyDocs({
            ...company,
            documentos: (company.documentos || []).filter(doc => !selectedIds.has(doc.id)),
          })
        )));

        clearSelection();
        showSuccessToast(
          totalSelected === 1
            ? 'Arquivo apagado com sucesso.'
            : `${totalSelected} arquivos apagados com sucesso.`
        );
      },
    });
  }, [clearSelection, companies, meusDocs, personalDocuments, saveCompanyDocs, saveMeusDocs, selectedDocIds, showSuccessToast]);

  const selectedShareDocuments = useMemo<ShareableDocument[]>(() => {
    const companyLookup = new Map(companies.map((company) => [company.id, company.nome]));
    const allDocuments: ShareableDocument[] = [
      ...personalDocuments.map((doc) => ({ ...doc, empresaNome: 'Biblioteca pessoal' })),
      ...companies.flatMap((company) => (company.documentos || []).map((doc) => ({
        ...doc,
        empresaNome: companyLookup.get(doc.companyId || company.id) || company.nome,
      }))),
    ];

    return allDocuments.filter((doc) => selectedDocIds.includes(doc.id));
  }, [companies, personalDocuments, selectedDocIds]);

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyContext.id) || null;
  }, [companies, selectedCompanyContext.id]);

  const companyFoldersList = useMemo(() => selectedCompany?.pastasDocumentos || [], [selectedCompany]);
  const companyDocuments = useMemo(() => selectedCompany?.documentos || [], [selectedCompany]);
  const companyCategoriesList = useMemo(
    () => normalizeDocumentCategoryNames(selectedCompany?.categoriasDocumentos),
    [selectedCompany],
  );

  const companyCategoriesForModal = useMemo<DocumentCategory[]>(() => (
    companyCategoriesList.map((name) => createDocumentCategory(name, isDefaultDocumentCategoryName(name)))
  ), [companyCategoriesList]);
  const handleCreateCompanyFolder = useCallback((folderName: string) => {
    if (!selectedCompany) return;
    const normalizedName = normalizeFolderPath(folderName);
    if (!normalizedName || normalizedName.includes('/') || normalizedName === '.' || normalizedName === '..') {
      setQuickModal({ title: 'Nome de pasta inválido', message: 'Use um nome simples, sem barras, "." ou "..".' });
      return;
    }
    const fullPath = companyFolder ? `${companyFolder}/${normalizedName}` : normalizedName;

    if (companyFoldersList.some((folder) => normalizeFolderPath(folder).toLowerCase() === fullPath.toLowerCase())) {
      setQuickModal({ title: 'Pasta já Existe', message: 'Uma pasta com este nome já existe aqui.' });
      return;
    }

    const updatedCompany: Company = {
      ...selectedCompany,
      pastasDocumentos: [...companyFoldersList, fullPath]
    };
    void saveCompanyDocs(updatedCompany).then(() => {
      setShowCreateFolderModal(false);
    }).catch((error: unknown) => {
      setQuickModal({
        title: 'Falha ao criar pasta',
        message: error instanceof Error ? error.message : 'Não foi possível criar a pasta.',
      });
    });
  }, [selectedCompany, companyFolder, companyFoldersList, saveCompanyDocs]);

  const handleUploadCompanyFile = useCallback(async (file: File, category: string, description: string, targetFolder: string, dataValidade?: string) => {
    if (!selectedCompany) return;
    const uploadedDocument = await uploadCompanyDocument({ companyId: selectedCompany.id, file, category, description, targetFolder, dataValidade });
    showSuccessToast(`Arquivo "${uploadedDocument.nome}" enviado com sucesso.`);
    return uploadedDocument;
  }, [selectedCompany, showSuccessToast, uploadCompanyDocument]);

  const handleCreateUploadCategory = useCallback(async (categoryName: string) => {
    const name = categoryName.trim();
    if (!name) return '';

    if (activeTab === 'meus') {
      const existing = meusDocs.categorias.find((item) => item.nome.toLowerCase() === name.toLowerCase());
      if (existing) return existing.nome;

      const nextCategory: DocumentCategory = { id: makeDocumentCategoryId(name), nome: name, ativo: true };
      await saveCategories([...meusDocs.categorias, nextCategory]);
      return name;
    }

    if (!selectedCompany) return '';
    const currentCategories = normalizeDocumentCategoryNames(selectedCompany.categoriasDocumentos);
    const existing = currentCategories.find((item) => item.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    await saveCompanyDocs({
      ...selectedCompany,
      categoriasDocumentos: [...currentCategories, name],
    });
    return name;
  }, [activeTab, meusDocs.categorias, saveCategories, saveCompanyDocs, selectedCompany]);

  const handleSaveModalCategories = useCallback(async (categories: DocumentCategory[]) => {
    if (activeTab === 'meus') {
      await saveCategories(categories);
      return;
    }

    if (!selectedCompany) return;
    await saveCompanyDocs({
      ...selectedCompany,
      categoriasDocumentos: categories.filter((item) => item.ativo).map((item) => item.nome),
    });
  }, [activeTab, saveCategories, saveCompanyDocs, selectedCompany]);

  const handleDownloadFolderZip = useCallback(async (scope: 'meus' | 'empresas', folderPath: string | null) => {
    if (scope === 'meus') {
      const targetDocuments = getFolderDocuments(personalDocuments, folderPath);
      if (targetDocuments.length === 0) {
        setQuickModal({ title: 'Pasta Vazia', message: 'Não há arquivos nesta pasta para baixar.' });
        return;
      }

      await handleBulkDownload(targetDocuments);
      return;
    }

    if (!selectedCompany) {
      setQuickModal({ title: 'Empresa não Selecionada', message: 'Selecione uma empresa para baixar a pasta.' });
      return;
    }

    const targetDocuments = getFolderDocuments(companyDocuments, folderPath);
    if (targetDocuments.length === 0) {
      setQuickModal({ title: 'Pasta Vazia', message: 'Não há arquivos nesta pasta para baixar.' });
      return;
    }

    await handleBulkDownload(targetDocuments);
  }, [personalDocuments, selectedCompany, companyDocuments, handleBulkDownload]);

  const showActions = useMemo(() => {
    if (activeTab === 'meus') return true;
    if ((activeTab === 'empresas' || activeTab === 'inativas') && selectedCompanyContext.id !== null) return true;
    return false;
  }, [activeTab, selectedCompanyContext.id]);

  return (
    <div className="gestao-empresarial-container animate-fade-in" style={{ padding: '12px 16px' }}>
      <DocumentosToolbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        lastAccess={lastAccess}
        showActions={showActions}
        selectedCount={selectedDocIds.length}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenFolder={() => setShowCreateFolderModal(true)}
        onOpenCategories={() => setShowCategoriesModal(true)}
        onOpenShare={() => setShowShareModal(true)}
        onBulkDownload={() => { void handleBulkDownloadSelected(); }}
        onBulkDelete={handleBulkDeleteSelected}
        onClearSelection={clearSelection}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        fileTypeFilter={fileTypeFilter}
        onFileTypeChange={setFileTypeFilter}
        categoryFilter={selectedCategoryFilter}
        onCategoryChange={setSelectedCategoryFilter}
        categories={categoriesList}
        groupBy={groupBy}
        onGroupChange={setGroupBy}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="detail-tab-content">
        {isLoading ? (
          <DocumentosLoadingState />
        ) : (
          <Suspense fallback={<DocumentosLoadingState />}>
            {activeTab === 'meus' ? (
              <MeusDocumentosTab
                meusDocs={meusDocs}
                onSaveMeusDocs={saveMeusDocs}
                selectedDocIds={selectedDocIds}
                toggleSelectDoc={toggleSelectDoc}
                searchTerm={searchTerm}
                selectedCategoryFilter={selectedCategoryFilter}
                fileTypeFilter={fileTypeFilter}
                initialSelectedFolder={initialPersonalFolder}
                onFolderChange={setPersonalFolder}
                viewMode={viewMode}
                groupBy={groupBy}
                sortBy={sortBy}
                onDownloadFolder={(folderPath) => handleDownloadFolderZip('meus', folderPath)}
                onDownload={handleDownloadDocument}
                onNotify={showSuccessToast}
              />
            ) : activeTab === 'empresas' || activeTab === 'inativas' ? (
              <DocumentosEmpresasTab
                key={activeTab}
                companies={companies}
                statusFilter={activeTab === 'inativas' ? 'Inativa' : 'Ativa'}
                selectedDocIds={selectedDocIds}
                toggleSelectDoc={toggleSelectDoc}
                searchTerm={searchTerm}
                selectedCategoryFilter={selectedCategoryFilter}
                fileTypeFilter={fileTypeFilter}
                initialSelectedCompanyId={selectedCompanyContext.id}
                initialSelectedEntryKey={selectedCompanyContext.entryKey}
                onCompanyChange={handleCompanyChange}
                onClearSearch={() => setSearchTerm('')}
                viewMode={viewMode}
                onSaveCompanyDocs={saveCompanyDocs}
                selectedFolder={companyFolder}
                onFolderChange={setCompanyFolder}
                groupBy={groupBy}
                sortBy={sortBy}
                onDownloadFolder={(folderPath) => handleDownloadFolderZip('empresas', folderPath)}
                onDownload={handleDownloadDocument}
                onNotify={showSuccessToast}
              />
            ) : activeTab === 'solicitacoes' ? (
              <SolicitacoesDocumentosTab />
            ) : activeTab === 'todos' ? (
              <TodosDocumentosTab
                meusDocs={meusDocs}
                companies={companies}
                selectedDocIds={selectedDocIds}
                toggleSelectDoc={toggleSelectDoc}
                selectAllDocs={selectAllDocs}
                onBulkDownload={handleBulkDownload}
                onDownload={handleDownloadDocument}
                searchTerm={searchTerm}
                selectedCategoryFilter={selectedCategoryFilter}
                fileTypeFilter={fileTypeFilter}
                viewMode={viewMode}
                groupBy={groupBy}
                sortBy={sortBy}
              />
            ) : (
              <SharedDocumentsTab
                refreshKey={shareRefreshKey}
                onNotify={showSuccessToast}
              />
            )}
          </Suspense>
        )}
      </div>

      <DocumentosPageOverlays
        showCategories={showCategoriesModal}
        categories={activeTab === 'meus' ? meusDocs.categorias : companyCategoriesForModal}
        categoriesDescription={activeTab === 'meus'
          ? 'Categorias padrão ficam sempre ativas; suas categorias extras ficam salvas no Supabase.'
          : 'Categorias padrão ficam sempre ativas; categorias criadas aqui ficam só nesta empresa.'}
        onCloseCategories={() => setShowCategoriesModal(false)}
        onSaveCategories={(categories) => { void handleSaveModalCategories(categories); }}
        showCreateFolder={showCreateFolderModal}
        parentFolderName={activeTab === 'meus'
          ? (personalFolder ? getFolderLabel(personalFolder) : null)
          : (companyFolder ? companyFolder.split('/').at(-1) || null : null)}
        onCloseCreateFolder={() => setShowCreateFolderModal(false)}
        onCreateFolder={activeTab === 'meus' ? handleCreatePersonalFolder : handleCreateCompanyFolder}
        showUpload={showUploadModal}
        uploadCategories={activeTab === 'meus' ? personalCategoriesList : companyCategoriesList}
        currentFolder={activeTab === 'meus' ? personalFolder : companyFolder}
        onCloseUpload={() => setShowUploadModal(false)}
        onCreateCategory={handleCreateUploadCategory}
        onUpload={activeTab === 'meus' ? handleUploadPersonalFile : handleUploadCompanyFile}
        showShare={showShareModal}
        shareDocuments={selectedShareDocuments}
        onCloseShare={() => setShowShareModal(false)}
        onShareCreated={(links) => {
          setShareRefreshKey((current) => current + 1);
          handleTabChange('compartilhados');
          clearSelection();
          showSuccessToast(`${links.length} link(s) de compartilhamento gerado(s).`);
        }}
        successToast={successToast}
        quickModal={quickModal}
        onCloseQuickModal={() => setQuickModal(null)}
      />
    </div>
  );
};
