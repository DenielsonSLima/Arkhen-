import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Building, CheckCircle2, Download, Files, FolderPlus, Grid, List, MoreHorizontal, Plus, Search, Share2, Trash2, Upload, AlignJustify, Link2 } from 'lucide-react';
import { useDocumentos } from './hooks/useDocumentos';
import type { DocumentosTab } from './hooks/useDocumentos';
import { SystemQuickModal } from '../components/SystemQuickModal';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import type { Company, CompanyDocument } from '../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentCategory } from './services/documentosService';
import type { ShareableDocument } from './services/documentShareService';
import type { DocumentGroupBy, DocumentSortBy } from './utils/documentOrganization';
import { documentosService } from './services/documentosService';

const MeusDocumentosTab = React.lazy(() => import('./components/MeusDocumentosTab').then((module) => ({ default: module.MeusDocumentosTab })));
const DocumentosEmpresasTab = React.lazy(() => import('./components/DocumentosEmpresasTab').then((module) => ({ default: module.DocumentosEmpresasTab })));
const TodosDocumentosTab = React.lazy(() => import('./components/TodosDocumentosTab').then((module) => ({ default: module.TodosDocumentosTab })));
const SharedDocumentsTab = React.lazy(() => import('./components/SharedDocumentsTab').then((module) => ({ default: module.SharedDocumentsTab })));
const DocumentCategoriesModal = React.lazy(() => import('./components/DocumentCategoriesModal').then((module) => ({ default: module.DocumentCategoriesModal })));
const CreateFolderModal = React.lazy(() => import('./components/CreateFolderModal').then((module) => ({ default: module.CreateFolderModal })));
const ShareDocumentModal = React.lazy(() => import('./components/ShareDocumentModal').then((module) => ({ default: module.ShareDocumentModal })));
const DocumentUploadModal = React.lazy(() => import('../gestao-empresarial/components/DocumentUploadModal').then((module) => ({ default: module.DocumentUploadModal })));

interface DocumentosPageProps {
  initialActiveTab?: DocumentosTab;
  initialPersonalFolder?: string | null;
  initialCompanyId?: string | null;
  onViewContextChange?: (context: InternalTabContext) => void;
}

const tabLabels: Record<DocumentosTab, string> = {
  meus: 'Biblioteca',
  empresas: 'Por Empresa',
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

const DocumentosLoadingState = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
    <div className="loading-spinner" style={{ margin: '0 auto 12px auto' }}></div>
    <p style={{ fontSize: '0.85rem' }}>Carregando documentos...</p>
  </div>
);

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
    // Carregar ultimo acesso
    const key = 'docs_last_access';
    const last = localStorage.getItem(key);
    if (last) {
      setLastAccess(new Date(last).toLocaleString('pt-BR'));
    }
    localStorage.setItem(key, new Date().toISOString());
  }, []);

  const handleCreatePersonalFolder = useCallback((folderName: string) => {
    const fullPath = personalFolder ? `${personalFolder}/${folderName}` : folderName;

    if (personalFoldersList.includes(fullPath)) {
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
    return selectedCompany?.categoriasDocumentos || ['Outros'];
  }, [selectedCompany]);

  const handleCreateCompanyFolder = useCallback((folderName: string) => {
    if (!selectedCompany) return;
    const fullPath = companyFolder ? `${companyFolder}/${folderName}` : folderName;

    if (companyFoldersList.includes(fullPath)) {
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
    const existing = (selectedCompany.categoriasDocumentos || []).find((item) => item.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    await saveCompanyDocs({
      ...selectedCompany,
      categoriasDocumentos: [...(selectedCompany.categoriasDocumentos || []), name],
    });
    return name;
  }, [activeTab, meusDocs.categorias, saveCategories, saveCompanyDocs, selectedCompany]);

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
    if (activeTab === 'empresas' && selectedCompanyContext.id !== null) return true;
    return false;
  }, [activeTab, selectedCompanyContext.id]);

  return (
    <div className="gestao-empresarial-container animate-fade-in" style={{ padding: '12px 16px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Documentos
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
            Biblioteca de documentos por empresa, pastas, contratos, procurações e certidões.
          </p>
          {lastAccess && (
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Último acesso em: {lastAccess}
            </p>
          )}
        </div>

        {showActions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', alignItems: 'flex-end', minWidth: 'min(100%, 420px)' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="btn-add-user"
              onClick={() => setShowUploadModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}
            >
              <Upload size={12} /> Enviar Arquivo
            </button>

            <button
              className="btn-add-user"
              onClick={() => setShowCreateFolderModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
            >
              <FolderPlus size={12} /> Nova Pasta
            </button>

            <button
              className="btn-add-user"
              onClick={() => setShowCategoriesModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
            >
              <Plus size={12} /> Categorias
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-add-user"
                onClick={() => setShowMoreMenu((current) => !current)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', padding: '6px 8px', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }}
                title="Mais opções"
              >
                <MoreHorizontal size={15} />
              </button>
              {showMoreMenu && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: '210px', background: '#ffffff', border: '1px solid #d8e0ea', borderRadius: '8px', boxShadow: '0 18px 42px rgba(15, 23, 42, 0.16)', padding: '6px' }}>
                  <button type="button" onClick={() => { setActiveTab('compartilhados'); setShowMoreMenu(false); }} style={{ width: '100%', border: 'none', background: 'transparent', color: '#334155', padding: '8px 9px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 750 }}>
                    <Link2 size={14} /> Arquivos compartilhados
                  </button>
                  {selectedDocIds.length > 0 && (
                    <button type="button" onClick={() => { clearSelection(); setShowMoreMenu(false); }} style={{ width: '100%', border: 'none', background: 'transparent', color: '#64748b', padding: '8px 9px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 750 }}>
                      <CheckCircle2 size={14} /> Limpar seleção
                    </button>
                  )}
                </div>
              )}
            </div>
            </div>

            {selectedDocIds.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn-add-user"
                  onClick={() => setShowShareModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#0f172a', color: '#ffffff', border: 'none' }}
                >
                  <Share2 size={12} /> Compartilhar ({selectedDocIds.length})
                </button>
                <button
                  className="btn-add-user"
                  onClick={handleBulkDownloadSelected}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}
                >
                  <Download size={12} /> Baixar ({selectedDocIds.length})
                </button>
                {selectedDocIds.length > 1 && (
                  <button
                    className="btn-add-user"
                    onClick={handleBulkDeleteSelected}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                  >
                    <Trash2 size={12} /> Apagar ({selectedDocIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Filters Row (Above Tabs Navigation) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', width: '100%' }}>
        {/* Search — takes all remaining space */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar por nome, tipo, conteúdo simulado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
          />
        </div>

        {/* Tipo de Arquivo filter */}
        <select
          value={fileTypeFilter}
          onChange={(e) => setFileTypeFilter(e.target.value)}
          style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '100px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}
        >
          <option value="Todos">Formatos</option>
          <option value="pdf">PDF</option>
          <option value="docx">DOCX / DOC</option>
          <option value="xlsx">XLSX / XLS</option>
          <option value="image">Imagens</option>
          <option value="xml">XML Fiscal</option>
          <option value="text">TXT / SPED</option>
          <option value="csv">CSV</option>
          <option value="bank">Bancário / CNAB</option>
          <option value="certificate">Certificados</option>
          <option value="archive">Compactados</option>
          <option value="email">E-mails</option>
        </select>

        {/* Category filter — fixed width on the right */}
        <select
          value={selectedCategoryFilter}
          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '130px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}
        >
          <option value="Todos">Todas Categorias</option>
          {categoriesList.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>

        {activeTab !== 'compartilhados' && (
          <>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as DocumentGroupBy)}
              style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '120px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}
              title="Agrupar documentos"
            >
              <option value="none">Sem grupos</option>
              <option value="type">Agrupar: tipo</option>
              <option value="category">Agrupar: categoria</option>
              <option value="folder">Agrupar: pasta</option>
              <option value="company">Agrupar: empresa</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as DocumentSortBy)}
              style={{ padding: '6px 8px', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', backgroundColor: '#ffffff', minWidth: '132px', flexShrink: 0, cursor: 'pointer', color: '#475569' }}
              title="Ordenar documentos"
            >
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
              <option value="last-opened">Último acesso</option>
            </select>
          </>
        )}

        <div style={{ display: 'inline-flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px', flexShrink: 0 }}>
          <button
            onClick={() => setViewMode('list')}
            style={{ border: 'none', background: viewMode === 'list' ? '#fff' : 'none', color: viewMode === 'list' ? '#0f172a' : '#64748b', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
            title="Visualizar em Lista"
          >
            <List size={13} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            style={{ border: 'none', background: viewMode === 'grid' ? '#fff' : 'none', color: viewMode === 'grid' ? '#0f172a' : '#64748b', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
            title="Visualizar em Cards"
          >
            <Grid size={13} />
          </button>
          <button
            onClick={() => setViewMode('compact')}
            style={{ border: 'none', background: viewMode === 'compact' ? '#fff' : 'none', color: viewMode === 'compact' ? '#0f172a' : '#64748b', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
            title="Visualização Compacta"
          >
            <AlignJustify size={13} />
          </button>
        </div>
      </div>

      {/* Tabs navigation selector */}
      <div className="detail-tab-nav" style={{ marginBottom: '12px', marginTop: '2px' }}>
        <button
          className={`detail-tab-btn ${activeTab === 'meus' ? 'active' : ''}`}
          onClick={() => setActiveTab('meus')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <Archive size={14} />
          Biblioteca
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'empresas' ? 'active' : ''}`}
          onClick={() => setActiveTab('empresas')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <Building size={14} />
          Por Empresa
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => setActiveTab('todos')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <Files size={14} />
          Todos os Documentos
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'compartilhados' ? 'active' : ''}`}
          onClick={() => setActiveTab('compartilhados')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <Link2 size={14} />
          Compartilhados
        </button>
      </div>

      {/* Tab contents */}
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
            ) : activeTab === 'empresas' ? (
              <DocumentosEmpresasTab
                companies={companies}
                selectedDocIds={selectedDocIds}
                toggleSelectDoc={toggleSelectDoc}
                searchTerm={searchTerm}
                selectedCategoryFilter={selectedCategoryFilter}
                fileTypeFilter={fileTypeFilter}
                initialSelectedCompanyId={initialCompanyId}
                onCompanyChange={handleCompanyChange}
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

      <Suspense fallback={null}>
        {showCategoriesModal && (
          <DocumentCategoriesModal
            isOpen={showCategoriesModal}
            categories={meusDocs.categorias}
            onClose={() => setShowCategoriesModal(false)}
            onSave={saveCategories}
          />
        )}

        {showCreateFolderModal && (
          <CreateFolderModal
            isOpen={showCreateFolderModal}
            onClose={() => setShowCreateFolderModal(false)}
            onSubmit={activeTab === 'meus' ? handleCreatePersonalFolder : handleCreateCompanyFolder}
            parentFolderName={activeTab === 'meus' ? (personalFolder ? getFolderLabel(personalFolder) : null) : (companyFolder ? companyFolder.split('/').at(-1) || null : null)}
          />
        )}

        {showUploadModal && (
          <DocumentUploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            categories={activeTab === 'meus' ? personalCategoriesList : companyCategoriesList}
            currentFolder={activeTab === 'meus' ? personalFolder : companyFolder}
            onCreateCategory={handleCreateUploadCategory}
            onUpload={activeTab === 'meus' ? handleUploadPersonalFile : handleUploadCompanyFile}
          />
        )}

        {showShareModal && (
          <ShareDocumentModal
            isOpen={showShareModal}
            documents={selectedShareDocuments}
            onClose={() => setShowShareModal(false)}
            onCreated={(links) => {
              setShareRefreshKey((current) => current + 1);
              setActiveTab('compartilhados');
              clearSelection();
              showSuccessToast(`${links.length} link(s) de compartilhamento gerado(s).`);
            }}
          />
        )}
      </Suspense>

      {successToast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '18px',
            right: '18px',
            zIndex: 2200,
            width: 'min(360px, calc(100vw - 32px))',
            padding: '12px 14px',
            borderRadius: '10px',
            background: '#0f172a',
            border: '1px solid rgba(197, 146, 53, 0.5)',
            color: '#ffffff',
            boxShadow: '0 18px 46px rgba(15, 23, 42, 0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            fontWeight: 750,
          }}
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 size={18} style={{ color: '#d9a441', flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{successToast}</span>
        </div>
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
