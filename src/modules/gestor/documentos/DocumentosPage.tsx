import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDocumentos } from './hooks/useDocumentos';
import type { DocumentosTab } from './hooks/useDocumentos';
import { SystemQuickModal } from '../components/SystemQuickModal';
import { DocumentosPageOverlays } from './components/DocumentosPageOverlays';
import { DocumentosPageView } from './components/DocumentosPageView';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import type { Company, CompanyDocument } from '../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentCategory } from './services/documentosService';
import type { ShareableDocument } from './services/documentShareService';
import type { DocumentGroupBy, DocumentSortBy } from './utils/documentOrganization';
import { normalizeFolderPath } from './utils/folderPaths';
import { documentosPreferencesService } from './services/documentosPreferencesService';
import {
  createDocumentCategory,
  documentosService,
  isDefaultDocumentCategoryName,
  normalizeDocumentCategoryNames,
} from './services/documentosService';
import './Documentos.css';

interface DocumentosPageProps {
  initialActiveTab?: DocumentosTab;
  initialPersonalFolder?: string | null;
  initialCompanyId?: string | null;
  onViewContextChange?: (context: InternalTabContext) => void;
}

const tabLabels: Record<DocumentosTab, string> = {
  meus: 'Biblioteca',
  empresas: 'Por Empresa',
  inativas: 'Inativas',
  todos: 'Todos os Documentos',
  compartilhados: 'Compartilhados',
};

const getFolderLabel = (path?: string | null) => path?.split('/').at(-1) || '';

const makeDocumentCategoryId = (name: string) => (
  `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-')}-${Date.now()}`
);

const getFolderDocuments = (documents: CompanyDocument[], folderPath: string | null) => {
  if (folderPath === null) return documents;

  const prefix = `${folderPath}/`;
  return documents.filter((doc) => {
    const docFolder = doc.pasta || '';
    return docFolder === folderPath || docFolder.startsWith(prefix);
  });
};

export const DocumentosPage: React.FC<DocumentosPageProps> = ({
  initialActiveTab,
  initialPersonalFolder,
  initialCompanyId,
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [selectedCompanyContext, setSelectedCompanyContext] = useState<{ id: string | null; name?: string }>(() => ({
    id: initialCompanyId || null,
  }));
  const [companyFolder, setCompanyFolder] = useState<string | null>(null);
  const [quickModal, setQuickModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm?: () => void;
  } | null>(null);
  const personalFoldersList = useMemo(() => meusDocs.pastas || [], [meusDocs.pastas]);
  const personalDocuments = useMemo(() => meusDocs.documentos || [], [meusDocs.documentos]);
  const personalCategoriesList = useMemo(() => (
    (meusDocs.categorias || []).filter((item) => item.ativo).map((item) => item.nome)
  ), [meusDocs.categorias]);
  const activeCompanies = useMemo(() => (
    companies.filter((company) => company.status !== 'Inativa')
  ), [companies]);
  const inactiveCompanies = useMemo(() => (
    companies.filter((company) => company.status === 'Inativa')
  ), [companies]);
  const handleCompanyChange = useCallback((id: string | null, name?: string) => {
    setSelectedCompanyContext((current) => (
      current.id === id && current.name === name ? current : { id, name }
    ));
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message);
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const titleSuffix = useMemo(() => {
    if (activeTab === 'meus') return getFolderLabel(personalFolder) || tabLabels.meus;
    if (activeTab === 'empresas') return selectedCompanyContext.name || tabLabels.empresas;
    if (activeTab === 'inativas') return selectedCompanyContext.name || tabLabels.inativas;
    if (activeTab === 'compartilhados') return tabLabels.compartilhados;
    return tabLabels.todos;
  }, [activeTab, personalFolder, selectedCompanyContext.name]);

  useEffect(() => {
    onViewContextChange?.({
      titleSuffix,
      data: {
        activeTab,
        personalFolder,
        selectedCompanyId: selectedCompanyContext.id,
      },
    });
  }, [activeTab, onViewContextChange, personalFolder, selectedCompanyContext.id, titleSuffix]);

  useEffect(() => {
    setCompanyFolder(null);
    setSelectedCompanyContext({ id: null });
  }, [activeTab]);

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

  const companyFoldersList = useMemo(() => {
    return selectedCompany?.pastasDocumentos || [];
  }, [selectedCompany]);

  const companyDocuments = useMemo(() => {
    return selectedCompany?.documentos || [];
  }, [selectedCompany]);

  const companyCategoriesList = useMemo(() => {
    return normalizeDocumentCategoryNames(selectedCompany?.categoriasDocumentos);
  }, [selectedCompany]);

  const companyCategoriesForModal = useMemo<DocumentCategory[]>(() => (
    companyCategoriesList.map((name) => createDocumentCategory(name, isDefaultDocumentCategoryName(name)))
  ), [companyCategoriesList]);

  const handleCreateCompanyFolder = useCallback((folderName: string) => {
    if (!selectedCompany) return;
    const normalizedName = normalizeFolderPath(folderName);
    if (!normalizedName) return;
    const fullPath = companyFolder ? `${companyFolder}/${normalizedName}` : normalizedName;

    if (companyFoldersList.some((folder) => normalizeFolderPath(folder).toLowerCase() === fullPath.toLowerCase())) {
      setQuickModal({ title: 'Pasta já Existe', message: 'Uma pasta com este nome já existe aqui.' });
      return;
    }

    const updatedCompany: Company = {
      ...selectedCompany,
      pastasDocumentos: [...companyFoldersList, fullPath]
    };
    saveCompanyDocs(updatedCompany);
    setShowCreateFolderModal(false);
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
      <DocumentosPageView
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lastAccess={lastAccess}
        showActions={showActions}
        showMoreMenu={showMoreMenu}
        setShowMoreMenu={setShowMoreMenu}
        selectedDocIds={selectedDocIds}
        clearSelection={clearSelection}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenCreateFolder={() => setShowCreateFolderModal(true)}
        onOpenCategories={() => setShowCategoriesModal(true)}
        onOpenShare={() => setShowShareModal(true)}
        onBulkDownloadSelected={handleBulkDownloadSelected}
        onBulkDeleteSelected={handleBulkDeleteSelected}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        fileTypeFilter={fileTypeFilter}
        setFileTypeFilter={setFileTypeFilter}
        selectedCategoryFilter={selectedCategoryFilter}
        setSelectedCategoryFilter={setSelectedCategoryFilter}
        categoriesList={categoriesList}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isLoading={isLoading}
        meusDocs={meusDocs}
        saveMeusDocs={saveMeusDocs}
        activeCompanies={activeCompanies}
        inactiveCompanies={inactiveCompanies}
        companies={companies}
        saveCompanyDocs={saveCompanyDocs}
        toggleSelectDoc={toggleSelectDoc}
        selectAllDocs={selectAllDocs}
        handleBulkDownload={handleBulkDownload}
        initialPersonalFolder={initialPersonalFolder}
        setPersonalFolder={setPersonalFolder}
        initialCompanyId={initialCompanyId}
        onCompanyChange={handleCompanyChange}
        companyFolder={companyFolder}
        setCompanyFolder={setCompanyFolder}
        onDownloadFolder={handleDownloadFolderZip}
        onDownloadDocument={handleDownloadDocument}
        onNotify={showSuccessToast}
        shareRefreshKey={shareRefreshKey}
      />

      <DocumentosPageOverlays
        activeTab={activeTab}
        showCategoriesModal={showCategoriesModal}
        onCloseCategories={() => setShowCategoriesModal(false)}
        personalCategories={meusDocs.categorias}
        companyCategoriesForModal={companyCategoriesForModal}
        onSaveCategories={handleSaveModalCategories}
        showCreateFolderModal={showCreateFolderModal}
        onCloseCreateFolder={() => setShowCreateFolderModal(false)}
        onCreatePersonalFolder={handleCreatePersonalFolder}
        onCreateCompanyFolder={handleCreateCompanyFolder}
        personalFolder={personalFolder}
        companyFolder={companyFolder}
        showUploadModal={showUploadModal}
        onCloseUpload={() => setShowUploadModal(false)}
        personalCategoryNames={personalCategoriesList}
        companyCategoryNames={companyCategoriesList}
        onCreateUploadCategory={handleCreateUploadCategory}
        onUploadPersonal={handleUploadPersonalFile}
        onUploadCompany={handleUploadCompanyFile}
        showShareModal={showShareModal}
        shareDocuments={selectedShareDocuments}
        onCloseShare={() => setShowShareModal(false)}
        onShareCreated={(count) => {
          setShareRefreshKey((current) => current + 1);
          setActiveTab('compartilhados');
          clearSelection();
          showSuccessToast(`${count} link(s) de compartilhamento gerado(s).`);
        }}
        successToast={successToast}
      />

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
