import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { gestaoEmpresarialService } from '../services/gestaoEmpresarialService';
import type { Company } from '../services/gestaoEmpresarialService';
import { cnpjLookupService } from '../services/cnpjLookupService';
import { filterCompanies } from '../utils/filterCompanies';

export type EmpresaDetailTab = 'dados' | 'filiais' | 'protocolos';

interface UseGestaoEmpresarialOptions {
  initialCompanyId?: string;
  initialDetailTab?: EmpresaDetailTab;
}

export const clientesKeys = {
  all: ['clientes'] as const,
};

const EMPTY_COMPANIES: Company[] = [];

export const useGestaoEmpresarial = (options: UseGestaoEmpresarialOptions = {}) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegime, setSelectedRegime] = useState<string>('Todos');
  const [activeStatusTab, setActiveStatusTab] = useState<'Ativos' | 'Inativos'>('Ativos');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(options.initialCompanyId || null);
  const initialDetailTab: EmpresaDetailTab = ['dados', 'filiais', 'protocolos'].includes(options.initialDetailTab || '')
    ? options.initialDetailTab as EmpresaDetailTab
    : 'dados';
  const [activeDetailTab, setActiveDetailTab] = useState<EmpresaDetailTab>(initialDetailTab);

  const companiesQuery = useQuery({
    queryKey: clientesKeys.all,
    queryFn: gestaoEmpresarialService.getCompanies,
    staleTime: 30_000,
  });

  const companies = companiesQuery.data || EMPTY_COMPANIES;
  const isLoading = companiesQuery.isLoading;

  useEffect(() => {
    const channel = subscribeRealtimeChannel('clientes-realtime', (ch) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        queryClient.invalidateQueries({ queryKey: clientesKeys.all });
      })
    );

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const filteredCompanies = useMemo(() => filterCompanies(
    companies,
    searchQuery,
    selectedRegime,
    activeStatusTab,
  ), [activeStatusTab, companies, searchQuery, selectedRegime]);

  const handleSelectCompany = (id: string | null) => {
    setSelectedCompanyId(id);
    setActiveDetailTab('dados');
  };

  const saveMutation = useMutation({
    mutationFn: gestaoEmpresarialService.saveCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: gestaoEmpresarialService.deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.all });
    },
  });

  const inativarMutation = useMutation({
    mutationFn: gestaoEmpresarialService.inativarCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.all });
    },
  });

  const reativarMutation = useMutation({
    mutationFn: gestaoEmpresarialService.reativarCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.all });
    },
  });

  const handleUpdateCompany = async (updatedCompany: Company) => {
    await saveMutation.mutateAsync(updatedCompany);
  };

  const handleSaveCompany = async (company: Company) => {
    setIsSaving(true);
    try {
      const hasCnpj = company.tipo !== 'PF' && company.cnpj.replace(/\D/g, '').length === 14;
      const shouldFillCnae = hasCnpj && !company.cnae;
      let payload = company;

      if (shouldFillCnae) {
        try {
          const lookup = await handleSearchCNPJ(company.cnpj);
          payload = {
            ...company,
            cnae: company.cnae || lookup.cnae,
            cnaeDescricao: company.cnaeDescricao || lookup.cnaeDescricao,
          };
        } catch {
          // Mantém o fluxo de salvamento sem bloquear caso a consulta CNPJ esteja indisponível.
        }
      }

      const savedCompany = await saveMutation.mutateAsync(payload);
      setShowFormModal(false);
      setEditingCompany(null);
      setSuccessMsg(company.id
        ? 'Cliente atualizado com sucesso!'
        : 'Cliente cadastrado. Agora configure as obrigações aplicáveis.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (!company.id) {
        setActiveDetailTab('protocolos');
        setSelectedCompanyId(savedCompany.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const syncCompanyCnae = async (company: Company) => {
    if (company.tipo === 'PF') {
      throw new Error('Cliente PF não possui CNAE.');
    }

    const cnpj = company.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      throw new Error('CNPJ inválido para sincronização de CNAE.');
    }

    const lookup = await handleSearchCNPJ(company.cnpj);
    if (!lookup.cnae && !lookup.cnaeDescricao) {
      throw new Error('Não foi possível localizar o CNAE para este CNPJ.');
    }

    const updatedCompany: Company = {
      ...company,
      cnae: company.cnae || lookup.cnae,
      cnaeDescricao: company.cnaeDescricao || lookup.cnaeDescricao,
    };

    await handleUpdateCompany(updatedCompany);
  };

  const handleInativarCompany = async (id: string) => {
    await inativarMutation.mutateAsync(id);
  };

  const handleReativarCompany = async (id: string) => {
    await reativarMutation.mutateAsync(id);
  };

  const handleDeleteCompany = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setSelectedCompanyId(null);
  };

  const getCompanyDocumentCount = (id: string) => gestaoEmpresarialService.getCompanyDocumentCount(id);

  const handleSearchCNPJ = (cnpj: string) => cnpjLookupService.lookup(cnpj);

  return {
    companies,
    filteredCompanies,
    searchQuery,
    setSearchQuery,
    selectedRegime,
    setSelectedRegime,
    activeStatusTab,
    setActiveStatusTab,
    viewMode,
    setViewMode,
    showFormModal,
    setShowFormModal,
    editingCompany,
    setEditingCompany,
    isSaving,
    successMsg,
    selectedCompany,
    setSelectedCompanyId: handleSelectCompany,
    updateCompany: handleUpdateCompany,
    saveCompany: handleSaveCompany,
    inativarCompany: handleInativarCompany,
    reativarCompany: handleReativarCompany,
    deleteCompany: handleDeleteCompany,
    getCompanyDocumentCount,
    searchCNPJ: handleSearchCNPJ,
    syncCompanyCnae,
    activeDetailTab,
    setActiveDetailTab,
    isLoading,
  };
};
