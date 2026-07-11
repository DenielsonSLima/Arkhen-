import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentosService, type UploadCompanyDocumentInput, type UploadDocumentInput } from '../services/documentosService';
import type { DocumentCategory, MeusDocumentosData } from '../services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const documentosKeys = {
  settings: ['documentos', 'settings'] as const,
  personal: ['documentos', 'personal'] as const,
  companyDocs: ['documentos', 'company-docs'] as const,
  companies: ['documentos', 'companies'] as const,
};

const reconcileDocumentChanges = async (previous: CompanyDocument[], next: CompanyDocument[]) => {
  const nextById = new Map(next.map((doc) => [doc.id, doc]));
  const previousById = new Map(previous.map((doc) => [doc.id, doc]));

  await Promise.all(previous.map(async (doc) => {
    if (!nextById.has(doc.id)) {
      await documentosService.deleteDocument(doc.id);
    }
  }));

  await Promise.all(next.map(async (doc) => {
    const current = previousById.get(doc.id);
    if (!current) return;

    const tasks: Promise<void>[] = [];
    if (current.nome !== doc.nome) tasks.push(documentosService.renameDocument(doc.id, doc.nome));
    if ((current.pasta || '') !== (doc.pasta || '')) tasks.push(documentosService.moveDocument(doc.id, doc.pasta || ''));
    await Promise.all(tasks);
  }));
};

export const invalidateDocumentosQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: documentosKeys.personal });
  queryClient.invalidateQueries({ queryKey: documentosKeys.companyDocs });
};

export const useDocumentosBaseQueries = () => {
  const settingsQuery = useQuery({
    queryKey: documentosKeys.settings,
    queryFn: documentosService.getMeusDocumentos,
  });

  const companiesQuery = useQuery({
    queryKey: documentosKeys.companies,
    queryFn: documentosService.listCompanies,
  });

  const personalDocsQuery = useQuery({
    queryKey: documentosKeys.personal,
    queryFn: documentosService.listPersonalDocumentos,
  });

  const companyDocsQuery = useQuery({
    queryKey: documentosKeys.companyDocs,
    queryFn: documentosService.listCompanyDocumentos,
  });

  return { settingsQuery, companiesQuery, personalDocsQuery, companyDocsQuery };
};

export const useDocumentosMutations = (
  currentSettings: MeusDocumentosData,
  companies: Company[],
) => {
  const queryClient = useQueryClient();

  const uploadPersonalMutation = useMutation({
    mutationFn: (input: UploadDocumentInput) => documentosService.uploadPersonalDocument(input),
    onSuccess: () => invalidateDocumentosQueries(queryClient),
  });

  const uploadCompanyMutation = useMutation({
    mutationFn: (input: UploadCompanyDocumentInput) => documentosService.uploadCompanyDocument(input),
    onSuccess: () => invalidateDocumentosQueries(queryClient),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedData: MeusDocumentosData) => {
      documentosService.saveMeusDocumentos(updatedData);
      await reconcileDocumentChanges(currentSettings.documentos || [], updatedData.documentos || []);
      return documentosService.getMeusDocumentos();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentosKeys.settings, data);
      invalidateDocumentosQueries(queryClient);
    },
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categories: DocumentCategory[]) => {
      const updatedData = { ...currentSettings, categorias: categories };
      documentosService.saveMeusDocumentos(updatedData);
      return documentosService.getMeusDocumentos();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentosKeys.settings, data);
    },
  });

  const saveCompanyMutation = useMutation({
    mutationFn: async (updatedCompany: Company) => {
      const currentCompany = companies.find((company) => company.id === updatedCompany.id);
      await reconcileDocumentChanges(currentCompany?.documentos || [], updatedCompany.documentos || []);
      await documentosService.updateCompanyDocumentSettings(updatedCompany.id, {
        pastasDocumentos: updatedCompany.pastasDocumentos || [],
        categoriasDocumentos: updatedCompany.categoriasDocumentos || [],
      });
      return documentosService.listCompanies();
    },
    onSuccess: (nextCompanies) => {
      queryClient.setQueryData(documentosKeys.companies, nextCompanies);
      invalidateDocumentosQueries(queryClient);
    },
  });

  return {
    uploadPersonalMutation,
    uploadCompanyMutation,
    saveSettingsMutation,
    saveCategoriesMutation,
    saveCompanyMutation,
  };
};
