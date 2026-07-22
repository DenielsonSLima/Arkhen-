import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InternalTabContext } from '../../../../stores/internalTabsStore';
import { documentosService } from '../../documentos/services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { isRouteEnabled } from '../../configuracoes/modulos-sistema/services/moduleAccess';
import type { SystemModuleId } from '../../configuracoes/modulos-sistema/services/modulosSistemaService';
import { TAB_INFOS } from '../gestorTabMetadata';

export type GlobalSearchResult = {
  id: string;
  label: string;
  description: string;
  type: 'Módulo' | 'Cliente' | 'Documento' | 'Configuração';
  moduleId: string;
  context?: InternalTabContext;
  configSubTab?: string;
};

export const useGestorGlobalSearch = (
  enabledModuleIds: Set<SystemModuleId>,
  modulesReady: boolean,
) => {
  const [term, setTerm] = useState('');
  const [focused, setFocused] = useState(false);
  const normalized = term.trim().toLowerCase();
  const query = useQuery({
    queryKey: ['gestor-global-search-index', [...enabledModuleIds].sort()],
    queryFn: async () => {
      const [companies, personalDocs, companyDocs] = await Promise.all([
        enabledModuleIds.has('clientes') ? documentosService.listCompanies() : Promise.resolve([]),
        enabledModuleIds.has('documentos') ? documentosService.listPersonalDocumentos() : Promise.resolve([]),
        enabledModuleIds.has('documentos') ? documentosService.listCompanyDocumentos() : Promise.resolve([]),
      ]);
      return { companies, personalDocs, companyDocs };
    },
    staleTime: 2 * 60 * 1000,
    enabled: modulesReady && normalized.length >= 2,
  });

  const results = useMemo<GlobalSearchResult[]>(() => {
    if (!modulesReady || normalized.length < 2) return [];
    const source = query.data;
    const search = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const includes = (value?: string | null) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(search);
    const documentResult = (doc: CompanyDocument, description: string): GlobalSearchResult => ({
      id: `doc-${doc.id}`,
      label: doc.nome,
      description,
      type: 'Documento',
      moduleId: 'documentos',
      context: { titleSuffix: 'Todos os Documentos', data: { activeTab: 'todos' } },
    });
    const moduleResults: GlobalSearchResult[] = Object.entries(TAB_INFOS)
      .filter(([, info]) => includes(info.title))
      .slice(0, 4)
      .map(([moduleId, info]) => ({
        id: `module-${moduleId}`,
        label: info.title,
        description: 'Abrir módulo do sistema',
        type: 'Módulo' as const,
        moduleId,
      }))
      .filter((item) => isRouteEnabled(item.moduleId, enabledModuleIds));
    const configResults: GlobalSearchResult[] = [
      ['integracao-bancaria', 'Integração Banco Inter', 'BolePix, Pix, boleto, certificado e webhooks'],
      ['contas-bancarias', 'Contas Bancárias', 'Bancos, agências, contas e saldos'],
      ['empresa', 'Dados da Empresa', 'CNPJ, endereço, logo e contato'],
      ['usuarios', 'Gestão de Usuários', 'Usuários, convites e perfis'],
      ['modulos-sistema', 'Módulos do Sistema', 'Ativar ou desativar funcionalidades do escritório'],
      ['compartilhamento', 'Compartilhamento de Docs', 'Links, senhas e expiração'],
    ]
      .filter(([, label, description]) => includes(label) || includes(description))
      .map(([configSubTab, label, description]) => ({
        id: `config-${configSubTab}`,
        label,
        description,
        type: 'Configuração',
        moduleId: 'configuracoes',
        configSubTab,
      }));
    const companyResults: GlobalSearchResult[] = (source?.companies || [])
      .filter((company: Company) => includes(company.nome) || includes(company.razaoSocial) || includes(company.cnpj))
      .slice(0, 5)
      .map((company: Company) => ({
        id: `company-${company.id}`,
        label: company.nome,
        description: `${company.cnpj} • ${company.status}`,
        type: 'Cliente',
        moduleId: 'clientes',
        context: { titleSuffix: company.nome, data: { selectedCompanyId: company.id } },
      }));
    const personalDocs = (source?.personalDocs || [])
      .filter((doc: CompanyDocument) => includes(doc.nome) || includes(doc.tipo) || includes(doc.pasta))
      .slice(0, 4)
      .map((doc: CompanyDocument) => documentResult(doc, `${doc.tipo || 'Documento'} • Biblioteca`));
    const companyDocs = (source?.companyDocs || [])
      .filter((doc: CompanyDocument) => includes(doc.nome) || includes(doc.tipo) || includes(doc.pasta))
      .slice(0, 4)
      .map((doc: CompanyDocument) => documentResult(doc, `${doc.tipo || 'Documento'} • Empresa`));
    return [...moduleResults, ...configResults, ...companyResults, ...personalDocs, ...companyDocs]
      .filter((item) => isRouteEnabled(item.moduleId, enabledModuleIds))
      .slice(0, 10);
  }, [enabledModuleIds, modulesReady, normalized, query.data]);

  return { term, setTerm, focused, setFocused, query, results };
};
