import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProtocoloEntrega, ProtocoloStatus, ProtocoloUpdate } from '../services/protocolosService';
import { protocolosKeys, protocolosQueries } from '../queries/protocolosQueries';

export type ProtocoloTab = 'pendentes' | 'concluidos' | 'todos';
export type ProtocoloEmpresaStatusTab = 'todas' | 'ativas' | 'inativas';
export interface EmpresaProtocolosGrupo {
  groupId: string;
  empresaId: string;
  empresaNome: string;
  empresaCnpj: string;
  empresaStatus: ProtocoloEntrega['empresaStatus'];
  empresaTipo: ProtocoloEntrega['empresaTipo'];
  empresaTipoEstabelecimento: ProtocoloEntrega['empresaTipoEstabelecimento'];
  empresaEmail: string;
  empresaTelefone: string;
  empresaLogo?: string;
  competencia: string;
  items: ProtocoloEntrega[];
}

export const useProtocolos = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProtocoloTab>('pendentes');
  const [activeEmpresaTab, setActiveEmpresaTab] = useState<ProtocoloEmpresaStatusTab>('ativas');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');

  const protocolosQuery = useQuery(protocolosQueries.list());
  const protocolos = protocolosQuery.data || [];

  const invalidateProtocolos = () => {
    queryClient.invalidateQueries({ queryKey: protocolosKeys.all });
  };

  const updateProtocoloMutation = useMutation({
    mutationFn: protocolosQueries.update,
    onSuccess: invalidateProtocolos,
  });

  const updateEntregasEmpresaMutation = useMutation({
    mutationFn: protocolosQueries.saveEntregasEmpresa,
    onSuccess: invalidateProtocolos,
  });

  const filteredProtocolos = useMemo(() => {
    return protocolos.filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        item.empresaNome.toLowerCase().includes(term) ||
        item.empresaCnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
        item.entregaNome.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term);

      const matchesTab =
        activeTab === 'todos' ||
        (activeTab === 'pendentes' && item.status === 'Pendente') ||
        (activeTab === 'concluidos' && item.status === 'Concluído');

      const matchesEmpresaTab =
        activeEmpresaTab === 'todas' ||
        (activeEmpresaTab === 'ativas' && item.empresaStatus === 'Ativa') ||
        (activeEmpresaTab === 'inativas' && item.empresaStatus === 'Inativa');

      const matchesInitial = !dataInicial || item.prazo >= dataInicial;
      const matchesFinal = !dataFinal || item.prazo <= dataFinal;

      return matchesSearch && matchesTab && matchesEmpresaTab && matchesInitial && matchesFinal;
    });
  }, [activeEmpresaTab, dataFinal, dataInicial, activeTab, protocolos, searchTerm]);

  const companyGroups = useMemo<EmpresaProtocolosGrupo[]>(() => {
    const groups = new Map<string, EmpresaProtocolosGrupo>();
    filteredProtocolos.forEach((item) => {
      const groupId = `${item.empresaId}::${item.competencia}`;
      const current = groups.get(groupId);
      if (!current) {
        groups.set(groupId, {
          groupId,
          empresaId: item.empresaId,
          empresaNome: item.empresaNome,
          empresaCnpj: item.empresaCnpj,
          empresaStatus: item.empresaStatus,
          empresaTipo: item.empresaTipo,
          empresaTipoEstabelecimento: item.empresaTipoEstabelecimento,
          empresaEmail: item.empresaEmail,
          empresaTelefone: item.empresaTelefone,
          empresaLogo: item.empresaLogo,
          competencia: item.competencia,
          items: [item],
        });
        return;
      }
      current.items.push(item);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.competencia.localeCompare(a.competencia) || a.prazo.localeCompare(b.prazo)),
      }))
      .sort((a, b) => b.competencia.localeCompare(a.competencia) || a.empresaNome.localeCompare(b.empresaNome));
  }, [filteredProtocolos]);

  const counters = useMemo(() => {
    const protocolosPorEmpresa = protocolos.filter((item) => (
      ((activeEmpresaTab === 'todas') ||
        (activeEmpresaTab === 'ativas' && item.empresaStatus === 'Ativa') ||
        (activeEmpresaTab === 'inativas' && item.empresaStatus === 'Inativa'))
      && (!dataInicial || item.prazo >= dataInicial)
      && (!dataFinal || item.prazo <= dataFinal)
      && (() => {
        const term = searchTerm.trim().toLowerCase();
        return !term ||
          item.empresaNome.toLowerCase().includes(term) ||
          item.empresaCnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
          item.entregaNome.toLowerCase().includes(term) ||
          item.categoria.toLowerCase().includes(term);
      })()
    ));

    return {
      pendentes: protocolosPorEmpresa.filter((item) => item.status === 'Pendente').length,
      concluidos: protocolosPorEmpresa.filter((item) => item.status === 'Concluído').length,
      todos: protocolosPorEmpresa.length,
      ativos: protocolosPorEmpresa.filter((item) => item.empresaStatus === 'Ativa').length,
      inativos: protocolosPorEmpresa.filter((item) => item.empresaStatus === 'Inativa').length,
    };
  }, [activeEmpresaTab, dataFinal, dataInicial, protocolos, searchTerm]);

  const updateProtocolo = async (id: string, updates: ProtocoloUpdate) => {
    await updateProtocoloMutation.mutateAsync({ id, updates });
  };

  const updateStatus = (id: string, status: ProtocoloStatus) => updateProtocolo(id, { status });

  const updateEntregasEmpresa = async (empresaId: string, entregaIds: string[]) => {
    await updateEntregasEmpresaMutation.mutateAsync({ empresaId, entregaIds });
  };

  return {
    protocolos,
    filteredProtocolos,
    companyGroups,
    counters,
    activeEmpresaTab,
    setActiveEmpresaTab,
    isLoading: protocolosQuery.isLoading,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    dataInicial,
    setDataInicial,
    dataFinal,
    setDataFinal,
    updateProtocolo,
    updateStatus,
    updateEntregasEmpresa,
    reload: invalidateProtocolos,
  };
};
