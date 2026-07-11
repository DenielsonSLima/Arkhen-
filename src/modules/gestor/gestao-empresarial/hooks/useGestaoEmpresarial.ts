import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { gestaoEmpresarialService } from '../services/gestaoEmpresarialService';
import type { Company } from '../services/gestaoEmpresarialService';
import { cnpjLookupService } from '../services/cnpjLookupService';

export type EmpresaDetailTab = 'dados' | 'filiais' | 'protocolos';

interface UseGestaoEmpresarialOptions {
  initialCompanyId?: string;
  initialDetailTab?: EmpresaDetailTab;
}

export const clientesKeys = {
  all: ['clientes'] as const,
};

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
  const initialDetailTab = options.initialDetailTab === 'filiais' ? 'filiais' : 'dados';
  const [activeDetailTab, setActiveDetailTab] = useState<EmpresaDetailTab>(initialDetailTab);

  const companiesQuery = useQuery({
    queryKey: clientesKeys.all,
    queryFn: gestaoEmpresarialService.getCompanies,
    staleTime: 30_000,
  });

  const companies = companiesQuery.data || [];
  const isLoading = companiesQuery.isLoading;

  useEffect(() => {
    const channel = supabase
      .channel('clientes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        queryClient.invalidateQueries({ queryKey: clientesKeys.all });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch =
        company.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.cnpj.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, ''));

      const matchesRegime =
        selectedRegime === 'Todos' || company.tipo === selectedRegime;
      const matchesStatus = activeStatusTab === 'Ativos' ? company.status !== 'Inativa' : company.status === 'Inativa';

      return matchesSearch && matchesRegime && matchesStatus;
    });
  }, [activeStatusTab, companies, searchQuery, selectedRegime]);

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
      const savedCompany = await saveMutation.mutateAsync(company);
      setShowFormModal(false);
      setEditingCompany(null);
      setSuccessMsg(company.id ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (!company.id) setSelectedCompanyId(savedCompany.id);
    } finally {
      setIsSaving(false);
    }
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
    activeDetailTab,
    setActiveDetailTab,
    isLoading,
  };
};
