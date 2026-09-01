/** @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { documentosService } from '../services/documentosService';
import { useDocumentosMutations } from './useDocumentosQueries';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const UPDATED_AT = '2026-09-01T21:30:00.000Z';

const documentFixture: CompanyDocument = {
  id: '22222222-2222-4222-8222-222222222222',
  companyId: COMPANY_ID,
  nome: 'Balancete.pdf',
  tipo: 'Fiscal',
  dataUpload: '01/09/2026',
  tamanho: '10 KB',
  pasta: 'Fiscal',
};

const companyFixture: Company = {
  id: COMPANY_ID,
  nome: 'Empresa Contábil',
  razaoSocial: 'Empresa Contábil Ltda.',
  cnpj: '12.345.678/0001-90',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  funcionarios: [],
  ferias: [],
  documentos: [documentFixture],
  pastasDocumentos: ['Fiscal'],
  categoriasDocumentos: ['Fiscal'],
  updatedAt: UPDATED_AT,
};

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const makeWrapper = (queryClient = makeQueryClient()) => (
  ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
);

const renderMutations = (queryClient = makeQueryClient()) => renderHook(
  () => useDocumentosMutations(
    { pastas: [], categorias: [], documentos: [] },
    [companyFixture],
  ),
  { wrapper: makeWrapper(queryClient) },
);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(documentosService, 'updateCompanyDocumentSettings').mockResolvedValue();
  vi.spyOn(documentosService, 'deleteDocuments').mockResolvedValue();
  vi.spyOn(documentosService, 'updateDocumentsMetadata').mockResolvedValue();
  vi.spyOn(documentosService, 'listCompanies').mockResolvedValue([companyFixture]);
});

afterEach(cleanup);

describe('useDocumentosMutations.saveCompanyMutation', () => {
  it.each([
    {
      operation: 'renomeia',
      updatedDocuments: [{ ...documentFixture, nome: 'Balancete revisado.pdf' }],
      expectedDeletes: [],
      expectedUpdates: [{ id: documentFixture.id, nome: 'Balancete revisado.pdf' }],
    },
    {
      operation: 'move',
      updatedDocuments: [{ ...documentFixture, pasta: 'Financeiro' }],
      expectedDeletes: [],
      expectedUpdates: [{ id: documentFixture.id, pasta: 'Financeiro' }],
    },
    {
      operation: 'apaga',
      updatedDocuments: [],
      expectedDeletes: [documentFixture.id],
      expectedUpdates: [],
    },
  ])('não salva preferências quando só $operation arquivo', async ({
    updatedDocuments,
    expectedDeletes,
    expectedUpdates,
  }) => {
    const { result } = renderMutations();

    await act(async () => {
      await result.current.saveCompanyMutation.mutateAsync({
        ...companyFixture,
        documentos: updatedDocuments,
      });
    });

    expect(documentosService.updateCompanyDocumentSettings).not.toHaveBeenCalled();
    expect(documentosService.deleteDocuments).toHaveBeenCalledWith(expectedDeletes);
    expect(documentosService.updateDocumentsMetadata).toHaveBeenCalledWith(expectedUpdates);
  });

  it('salva pastas com CAS antes de reconciliar documentos', async () => {
    const { result } = renderMutations();
    const updatedCompany: Company = {
      ...companyFixture,
      pastasDocumentos: ['Fiscal', 'Financeiro'],
      documentos: [{ ...documentFixture, pasta: 'Financeiro' }],
    };

    await act(async () => {
      await result.current.saveCompanyMutation.mutateAsync(updatedCompany);
    });

    expect(documentosService.updateCompanyDocumentSettings).toHaveBeenCalledWith(COMPANY_ID, {
      pastasDocumentos: ['Fiscal', 'Financeiro'],
      categoriasDocumentos: ['Fiscal'],
      updatedAt: UPDATED_AT,
    });
    expect(documentosService.updateDocumentsMetadata).toHaveBeenCalledWith([
      { id: documentFixture.id, pasta: 'Financeiro' },
    ]);
    const settingsOrder = vi.mocked(documentosService.updateCompanyDocumentSettings)
      .mock.invocationCallOrder[0];
    expect(settingsOrder).toBeLessThan(
      vi.mocked(documentosService.deleteDocuments).mock.invocationCallOrder[0],
    );
    expect(settingsOrder).toBeLessThan(
      vi.mocked(documentosService.updateDocumentsMetadata).mock.invocationCallOrder[0],
    );
  });

  it('salva categorias mesmo quando os documentos não mudam', async () => {
    const { result } = renderMutations();

    await act(async () => {
      await result.current.saveCompanyMutation.mutateAsync({
        ...companyFixture,
        categoriasDocumentos: ['Fiscal', 'Relatórios'],
      });
    });

    expect(documentosService.updateCompanyDocumentSettings).toHaveBeenCalledWith(COMPANY_ID, {
      pastasDocumentos: ['Fiscal'],
      categoriasDocumentos: ['Fiscal', 'Relatórios'],
      updatedAt: UPDATED_AT,
    });
  });

  it('aguarda a recarga do CAS antes de liberar uma nova tentativa', async () => {
    const queryClient = makeQueryClient();
    let releaseInvalidation: (() => void) | undefined;
    const invalidation = new Promise<void>((resolve) => {
      releaseInvalidation = resolve;
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidation);
    vi.mocked(documentosService.updateDocumentsMetadata)
      .mockRejectedValueOnce(new Error('falha após confirmar preferências'));
    const { result } = renderMutations(queryClient);
    let settled = false;

    const mutation = result.current.saveCompanyMutation.mutateAsync({
      ...companyFixture,
      pastasDocumentos: ['Fiscal', 'Financeiro'],
      documentos: [{ ...documentFixture, pasta: 'Financeiro' }],
    }).catch(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documentos', 'companies'] });
    });
    expect(settled).toBe(false);

    releaseInvalidation?.();
    await act(async () => mutation);
    expect(settled).toBe(true);
  });
});
