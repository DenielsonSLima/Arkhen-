import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentosService, type UploadCompanyDocumentInput, type UploadDocumentInput } from '../services/documentosService';
import type { DocumentCategory, MeusDocumentosData } from '../services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useDocumentosRealtime } from './useDocumentosRealtime';
import { useDocumentosBaseQueries, useDocumentosMutations, documentosKeys } from '../queries/useDocumentosQueries';

export type DocumentosTab = 'meus' | 'empresas' | 'inativas' | 'todos' | 'compartilhados';

interface UseDocumentosOptions {
  initialActiveTab?: DocumentosTab;
}

const EMPTY_DOCUMENTOS: CompanyDocument[] = [];
const EMPTY_COMPANIES: Company[] = [];
const EMPTY_SETTINGS: MeusDocumentosData = { pastas: [], categorias: [], documentos: [] };

export const useDocumentos = (options: UseDocumentosOptions = {}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DocumentosTab>(() => options.initialActiveTab || 'meus');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todos');
  const [fileTypeFilter, setFileTypeFilter] = useState('Todos');

  const documentosRealtime = useDocumentosRealtime();
  const { settingsQuery, companiesQuery, personalDocsQuery, companyDocsQuery } = useDocumentosBaseQueries(activeTab);

  const settings = settingsQuery.data ?? EMPTY_SETTINGS;
  const personalDocs = personalDocsQuery.data ?? EMPTY_DOCUMENTOS;
  const companyDocs = companyDocsQuery.data ?? EMPTY_DOCUMENTOS;
  const companyRows = companiesQuery.data ?? EMPTY_COMPANIES;

  const meusDocs = useMemo<MeusDocumentosData>(() => {
    const docFolders = personalDocs.map((doc) => doc.pasta).filter(Boolean) as string[];
    return {
      ...settings,
      pastas: Array.from(new Set([...(settings.pastas || []), ...docFolders])),
      documentos: personalDocs,
    };
  }, [settings, personalDocs]);

  const companies = useMemo<Company[]>(() => {
    const docsByCompanyId = new Map<string, CompanyDocument[]>();
    companyDocs.forEach((doc) => {
      if (!doc.companyId) return;
      const docs = docsByCompanyId.get(doc.companyId);
      if (docs) {
        docs.push(doc);
      } else {
        docsByCompanyId.set(doc.companyId, [doc]);
      }
    });

    return companyRows.map((company) => {
      const documentos = docsByCompanyId.get(company.id) || EMPTY_DOCUMENTOS;
      const docFolders = documentos.map((doc) => doc.pasta).filter(Boolean) as string[];
      return {
        ...company,
        documentos,
        pastasDocumentos: Array.from(new Set([...(company.pastasDocumentos || []), ...docFolders])),
      };
    });
  }, [companyRows, companyDocs]);

  const {
    saveSettingsMutation,
    saveCategoriesMutation,
    saveCompanyMutation,
  } = useDocumentosMutations(meusDocs, companies);

  const handleSaveMeusDocs = useCallback(async (updatedData: MeusDocumentosData) => {
    await saveSettingsMutation.mutateAsync(updatedData);
  }, [saveSettingsMutation]);

  const handleSaveCategories = useCallback(async (categories: DocumentCategory[]) => {
    await saveCategoriesMutation.mutateAsync(categories);
  }, [saveCategoriesMutation]);

  const handleSaveCompanyDocs = useCallback(async (updatedCompany: Company) => {
    await saveCompanyMutation.mutateAsync(updatedCompany);
  }, [saveCompanyMutation]);

  const uploadPersonalDocument = useCallback(async (input: UploadDocumentInput) => {
    const doc = await documentosService.uploadPersonalDocument(input);
    queryClient.invalidateQueries({ queryKey: documentosKeys.personal(), exact: true });
    return doc;
  }, [queryClient]);

  const uploadCompanyDocument = useCallback(async (input: UploadCompanyDocumentInput) => {
    const doc = await documentosService.uploadCompanyDocument(input);
    queryClient.invalidateQueries({ queryKey: documentosKeys.companyDocs(), exact: true });
    queryClient.invalidateQueries({ queryKey: documentosKeys.company(input.companyId) });
    return doc;
  }, [queryClient]);

  const toggleSelectDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) => (
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    ));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDocIds([]);
  }, []);

  const selectAllDocs = useCallback((docIds: string[]) => {
    setSelectedDocIds(docIds);
  }, []);

  const handleBulkDownload = useCallback(async (documents: CompanyDocument[]) => {
    if (documents.length === 0) return;
    await Promise.all(documents.map((doc) => documentosService.downloadDocument(doc)));
    setSelectedDocIds([]);
  }, []);

  const categoriesList = useMemo(() => {
    const personal = (meusDocs.categorias || []).filter((item) => item.ativo).map((item) => item.nome);
    const companyCategories = companies.flatMap((company) => company.categoriasDocumentos || []);
    const clientDocs = companies.flatMap((company) => (company.documentos || []).map((doc) => doc.tipo));
    return Array.from(new Set([...personal, ...companyCategories, ...clientDocs]));
  }, [meusDocs.categorias, companies]);

  useEffect(() => {
    setSelectedDocIds([]);
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    meusDocs,
    saveMeusDocs: handleSaveMeusDocs,
    saveCategories: handleSaveCategories,
    companies,
    saveCompanyDocs: handleSaveCompanyDocs,
    uploadPersonalDocument,
    uploadCompanyDocument,
    selectedDocIds,
    toggleSelectDoc,
    clearSelection,
    selectAllDocs,
    handleBulkDownload,
    searchTerm,
    setSearchTerm,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    fileTypeFilter,
    setFileTypeFilter,
    categoriesList,
    realtimeStatus: documentosRealtime.status,
    realtimeError: documentosRealtime.error,
    isRealtimeConnected: documentosRealtime.isConnected,
    isLoading: settingsQuery.isLoading
      || (activeTab === 'meus' && personalDocsQuery.isLoading)
      || ((activeTab === 'empresas' || activeTab === 'inativas') && (companiesQuery.isLoading || companyDocsQuery.isLoading))
      || (activeTab === 'todos' && (personalDocsQuery.isLoading || companiesQuery.isLoading || companyDocsQuery.isLoading)),
  };
};
