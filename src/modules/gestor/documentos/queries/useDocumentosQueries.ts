import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentosService, type DocumentScope, type UploadCompanyDocumentInput, type UploadDocumentInput } from '../services/documentosService';
import type { DocumentCategory, MeusDocumentosData } from '../services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const documentosKeys = {
  all: ['documentos'] as const,
  settings: () => [...documentosKeys.all, 'settings'] as const,
  companies: () => [...documentosKeys.all, 'companies'] as const,
  documents: () => [...documentosKeys.all, 'documents'] as const,
  scope: (scope: DocumentScope) => [...documentosKeys.documents(), 'scope', scope] as const,
  personal: () => documentosKeys.scope('pessoal'),
  companyDocs: () => documentosKeys.scope('empresa'),
  company: (companyId: string) => [...documentosKeys.companyDocs(), 'company', companyId] as const,
};

interface DocumentosInvalidationTarget {
  scope?: DocumentScope;
  companyId?: string | null;
  includeCompanies?: boolean;
  includeSettings?: boolean;
}

type DocumentosQueryTab = 'meus' | 'empresas' | 'todos' | 'compartilhados';

const reconcileDocumentChanges = async (previous: CompanyDocument[], next: CompanyDocument[]) => {
  const nextById = new Map(next.map((doc) => [doc.id, doc]));
  const previousById = new Map(previous.map((doc) => [doc.id, doc]));

  const deletedIds = previous.filter((doc) => !nextById.has(doc.id)).map((doc) => doc.id);
  const metadataUpdates = next.flatMap((doc) => {
    const current = previousById.get(doc.id);
    if (!current) return [];

    const changes: { id: string; nome?: string; pasta?: string | null } = { id: doc.id };
    if (current.nome !== doc.nome) changes.nome = doc.nome;
    if ((current.pasta || '') !== (doc.pasta || '')) changes.pasta = doc.pasta || null;

    return changes.nome !== undefined || changes.pasta !== undefined ? [changes] : [];
  });

  await Promise.all([
    documentosService.deleteDocuments(deletedIds),
    documentosService.updateDocumentsMetadata(metadataUpdates),
  ]);

  return {
    changed: deletedIds.length > 0 || metadataUpdates.length > 0,
  };
};

export const invalidateDocumentosQueries = (
  queryClient: QueryClient,
  target: DocumentosInvalidationTarget = {},
) => {
  if (target.includeSettings) {
    queryClient.invalidateQueries({ queryKey: documentosKeys.settings(), exact: true });
  }

  if (target.includeCompanies) {
    queryClient.invalidateQueries({ queryKey: documentosKeys.companies(), exact: true });
  }

  if (target.scope === 'pessoal') {
    queryClient.invalidateQueries({ queryKey: documentosKeys.personal(), exact: true });
    return;
  }

  if (target.scope === 'empresa') {
    queryClient.invalidateQueries({ queryKey: documentosKeys.companyDocs(), exact: true });
    if (target.companyId) {
      queryClient.invalidateQueries({ queryKey: documentosKeys.company(target.companyId) });
    }
    return;
  }

  queryClient.invalidateQueries({ queryKey: documentosKeys.documents() });
};

export const useDocumentosBaseQueries = (activeTab: DocumentosQueryTab) => {
  const shouldLoadPersonalDocs = activeTab === 'meus' || activeTab === 'todos';
  const shouldLoadCompanyDocs = activeTab === 'empresas' || activeTab === 'todos';

  const settingsQuery = useQuery({
    queryKey: documentosKeys.settings(),
    queryFn: documentosService.getMeusDocumentos,
    staleTime: 5 * 60 * 1000,
  });

  const companiesQuery = useQuery({
    queryKey: documentosKeys.companies(),
    queryFn: documentosService.listCompanies,
    enabled: shouldLoadCompanyDocs,
    staleTime: 5 * 60 * 1000,
  });

  const personalDocsQuery = useQuery({
    queryKey: documentosKeys.personal(),
    queryFn: documentosService.listPersonalDocumentos,
    enabled: shouldLoadPersonalDocs,
    staleTime: 2 * 60 * 1000,
  });

  const companyDocsQuery = useQuery({
    queryKey: documentosKeys.companyDocs(),
    queryFn: documentosService.listCompanyDocumentos,
    enabled: shouldLoadCompanyDocs,
    staleTime: 2 * 60 * 1000,
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
    onSuccess: () => invalidateDocumentosQueries(queryClient, { scope: 'pessoal' }),
  });

  const uploadCompanyMutation = useMutation({
    mutationFn: (input: UploadCompanyDocumentInput) => documentosService.uploadCompanyDocument(input),
    onSuccess: (_data, variables) => invalidateDocumentosQueries(queryClient, {
      scope: 'empresa',
      companyId: variables.companyId,
    }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedData: MeusDocumentosData) => {
      documentosService.saveMeusDocumentos(updatedData);
      const reconciliation = await reconcileDocumentChanges(currentSettings.documentos || [], updatedData.documentos || []);
      return {
        settings: documentosService.getMeusDocumentos(),
        changedDocuments: reconciliation.changed,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentosKeys.settings(), data.settings);
      if (data.changedDocuments) {
        invalidateDocumentosQueries(queryClient, { scope: 'pessoal' });
      }
    },
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categories: DocumentCategory[]) => {
      const updatedData = { ...currentSettings, categorias: categories };
      documentosService.saveMeusDocumentos(updatedData);
      return documentosService.getMeusDocumentos();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentosKeys.settings(), data);
    },
  });

  const saveCompanyMutation = useMutation({
    mutationFn: async (updatedCompany: Company) => {
      const currentCompany = companies.find((company) => company.id === updatedCompany.id);
      const reconciliation = await reconcileDocumentChanges(currentCompany?.documentos || [], updatedCompany.documentos || []);
      await documentosService.updateCompanyDocumentSettings(updatedCompany.id, {
        pastasDocumentos: updatedCompany.pastasDocumentos || [],
        categoriasDocumentos: updatedCompany.categoriasDocumentos || [],
      });
      return {
        companies: await documentosService.listCompanies(),
        changedDocuments: reconciliation.changed,
        companyId: updatedCompany.id,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentosKeys.companies(), data.companies);
      if (data.changedDocuments) {
        invalidateDocumentosQueries(queryClient, {
          scope: 'empresa',
          companyId: data.companyId,
        });
      }
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
