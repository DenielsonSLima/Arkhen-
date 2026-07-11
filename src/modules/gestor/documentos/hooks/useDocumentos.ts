import { useEffect, useMemo, useState } from 'react';
import { documentosService, type UploadCompanyDocumentInput, type UploadDocumentInput } from '../services/documentosService';
import type { DocumentCategory, MeusDocumentosData } from '../services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useDocumentosRealtime } from './useDocumentosRealtime';
import { useDocumentosBaseQueries, useDocumentosMutations } from '../queries/useDocumentosQueries';

export type DocumentosTab = 'meus' | 'empresas' | 'todos' | 'compartilhados';

interface UseDocumentosOptions {
  initialActiveTab?: DocumentosTab;
}

export const useDocumentos = (options: UseDocumentosOptions = {}) => {
  const [activeTab, setActiveTab] = useState<DocumentosTab>(() => options.initialActiveTab || 'meus');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todos');
  const [fileTypeFilter, setFileTypeFilter] = useState('Todos');

  useDocumentosRealtime();
  const { settingsQuery, companiesQuery, personalDocsQuery, companyDocsQuery } = useDocumentosBaseQueries();

  const settings = settingsQuery.data || { pastas: [], categorias: [], documentos: [] };
  const personalDocs = personalDocsQuery.data || [];
  const companyDocs = companyDocsQuery.data || [];

  const meusDocs = useMemo<MeusDocumentosData>(() => {
    const docFolders = personalDocs.map((doc) => doc.pasta).filter(Boolean) as string[];
    return {
      ...settings,
      pastas: Array.from(new Set([...(settings.pastas || []), ...docFolders])),
      documentos: personalDocs,
    };
  }, [settings, personalDocs]);

  const companies = useMemo<Company[]>(() => {
    return (companiesQuery.data || []).map((company) => {
      const documentos = companyDocs.filter((doc) => doc.companyId === company.id);
      const docFolders = documentos.map((doc) => doc.pasta).filter(Boolean) as string[];
      return {
        ...company,
        documentos,
        pastasDocumentos: Array.from(new Set([...(company.pastasDocumentos || []), ...docFolders])),
      };
    });
  }, [companiesQuery.data, companyDocs]);

  const {
    uploadPersonalMutation,
    uploadCompanyMutation,
    saveSettingsMutation,
    saveCategoriesMutation,
    saveCompanyMutation,
  } = useDocumentosMutations(meusDocs, companies);

  const handleSaveMeusDocs = async (updatedData: MeusDocumentosData) => {
    await saveSettingsMutation.mutateAsync(updatedData);
  };

  const handleSaveCategories = async (categories: DocumentCategory[]) => {
    await saveCategoriesMutation.mutateAsync(categories);
  };

  const handleSaveCompanyDocs = async (updatedCompany: Company) => {
    await saveCompanyMutation.mutateAsync(updatedCompany);
  };

  const uploadPersonalDocument = async (input: UploadDocumentInput) => {
    return uploadPersonalMutation.mutateAsync(input);
  };

  const uploadCompanyDocument = async (input: UploadCompanyDocumentInput) => {
    return uploadCompanyMutation.mutateAsync(input);
  };

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => (
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    ));
  };

  const clearSelection = () => {
    setSelectedDocIds([]);
  };

  const selectAllDocs = (docIds: string[]) => {
    setSelectedDocIds(docIds);
  };

  const handleBulkDownload = async (documents: CompanyDocument[]) => {
    if (documents.length === 0) return;
    await Promise.all(documents.map((doc) => documentosService.downloadDocument(doc)));
    setSelectedDocIds([]);
  };

  const categoriesList = useMemo(() => {
    const personal = (meusDocs.categorias || []).filter((item) => item.ativo).map((item) => item.nome);
    const clientDocs = companies.flatMap((company) => (company.documentos || []).map((doc) => doc.tipo));
    return Array.from(new Set([...personal, ...clientDocs]));
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
    isLoading: settingsQuery.isLoading || companiesQuery.isLoading || personalDocsQuery.isLoading || companyDocsQuery.isLoading,
  };
};
