import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Activity, History, CreditCard, FileText, ArrowLeft,
  UserCheck, Landmark, Calculator, Shield, ShieldCheck, FolderLock, User, Share2, FileCode2, Boxes
} from 'lucide-react';

// Import submodules
import { EmpresaConfig } from './empresa/EmpresaConfig';
import { UsuariosConfig } from './usuarios/UsuariosConfig';
import { ApiStatusConfig } from './api-status/ApiStatusConfig';
import { LogsEventosConfig } from './logs-eventos/LogsEventosConfig';
import { BancariaConfig } from './integracao-bancaria/BancariaConfig';
import { ContasBancariasConfig } from './contas-bancarias/ContasBancariasConfig';
import { MarcaDaguaConfig } from './marca-dagua/MarcaDaguaConfig';
import { ContadoresConfig } from './contadores/ContadoresConfig';
import { ArmazenamentoConfig } from './armazenamento/ArmazenamentoConfig';
import { CalculatorPrefsConfig } from './calculadora/CalculatorPrefsConfig';
import { FiscalConfig } from './integracao-fiscal/FiscalConfig';
import { PerfisConfig } from './perfis/PerfisConfig';
import { PermissoesConfig } from './permissoes/PermissoesConfig';
import { MeuPerfilConfig } from './meu-perfil/MeuPerfilConfig';
import { CompartilhamentoConfig } from './compartilhamento/CompartilhamentoConfig';
import { VisualizadoresXmlConfig } from './visualizadores-xml/VisualizadoresXmlConfig';
import { ModulosSistemaConfig } from './modulos-sistema/ModulosSistemaConfig';
import { supabase } from '../../../lib/supabase';

import './Configuracoes.css';

const ACTIVE_CONFIG_SUBTAB_KEY = 'contabil_config_active_subtab';

const CONFIG_CARD_PERMISSIONS: Record<string, string[]> = {
  'meu-perfil': ['meu-perfil:manage'],
  empresa: ['configuracoes:view', 'configuracoes:manage'],
  usuarios: ['usuarios:manage'],
  perfis: ['perfis:manage'],
  permissoes: ['perfis:manage'],
  'modulos-sistema': ['configuracoes:manage'],
  contadores: ['configuracoes:view', 'configuracoes:manage'],
  compartilhamento: ['documentos:manage'],
  'marca-dagua': ['documentos:manage'],
  'contas-bancarias': ['contas-bancarias:manage'],
  'integracao-bancaria': ['integracao-bancaria:manage'],
  'integracao-fiscal': ['integracao-fiscal:manage'],
  'visualizadores-xml': ['integracao-fiscal:manage'],
  'calculator-prefs': ['configuracoes:view'],
  'api-status': ['configuracoes:manage'],
  'logs-eventos': ['configuracoes:manage'],
};
interface ConfigError {
  hasError: boolean;
  message: string;
}

class ConfigSubmoduleErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  ConfigError
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Erro ao abrir este submódulo.' };
  }

  componentDidCatch(error: Error) {
    console.error('Erro no submódulo de configurações:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="submodule-content-card">
          <p style={{ margin: '0', fontWeight: 600, color: '#b91c1c' }}>
            Não foi possível abrir esse submódulo. Tente novamente em alguns instantes.
          </p>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.props.onReset}
            className="btn-save-settings"
            style={{ marginTop: '10px' }}
          >
            Voltar para Configurações
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ConfiguracoesPage: React.FC = () => {
  const permissaoConfigQuery = useQuery({
    queryKey: ['configuracoes', 'permissoes-atuais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_user_permissions');
      if (error) throw error;
      return Array.isArray(data) ? data as string[] : [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
  const permissoesAtuais = useMemo(
    () => permissaoConfigQuery.data || [],
    [permissaoConfigQuery.data],
  );
  const podeAcessarCard = useCallback((cardId: string) => {
    if (cardId === 'meu-perfil') return true;
    if (permissaoConfigQuery.isFetching || permissaoConfigQuery.isError) return false;
    if (permissoesAtuais.includes('*')) return true;
    return (CONFIG_CARD_PERMISSIONS[cardId] || []).some((permissao) => permissoesAtuais.includes(permissao));
  }, [permissaoConfigQuery.isError, permissaoConfigQuery.isFetching, permissoesAtuais]);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(() => {
    const initial = sessionStorage.getItem('contabil_config_initial_subtab');
    if (initial) {
      sessionStorage.removeItem('contabil_config_initial_subtab');
      return initial;
    }
    return sessionStorage.getItem(ACTIVE_CONFIG_SUBTAB_KEY);
  });

  useEffect(() => {
    if (activeSubTab) sessionStorage.setItem(ACTIVE_CONFIG_SUBTAB_KEY, activeSubTab);
    else sessionStorage.removeItem(ACTIVE_CONFIG_SUBTAB_KEY);
  }, [activeSubTab]);

  useEffect(() => {
    if (activeSubTab && !podeAcessarCard(activeSubTab)) {
      setActiveSubTab('meu-perfil');
    }
  }, [activeSubTab, podeAcessarCard]);

  useEffect(() => {
    const handleOpenSubTab = (event: Event) => {
      const subTab = (event as CustomEvent<{ subTab?: string }>).detail?.subTab;
      if (subTab) {
        setActiveSubTab(subTab);
      }
    };

    window.addEventListener('open_config_subtab', handleOpenSubTab);
    return () => window.removeEventListener('open_config_subtab', handleOpenSubTab);
  }, []);

  const cards = [
    {
      id: 'meu-perfil',
      title: 'Meu Perfil',
      desc: 'Altere sua foto de perfil, dados pessoais, e-mail, senha e conta Google.',
      icon: <User size={28} />,
    },
    {
      id: 'empresa',
      title: 'Dados da Empresa',
      desc: 'Razão social, CNPJ, dados de contato e endereço principal.',
      icon: <Building2 size={28} />,
    },
    {
      id: 'usuarios',
      title: 'Gestão de Usuários',
      desc: 'Níveis de acesso, convites para novos funcionários e controle de cargos.',
      icon: <Users size={28} />,
    },
    {
      id: 'perfis',
      title: 'Perfis de Acesso',
      desc: 'Crie e edite perfis de segurança (Administrador, Analista, Auxiliar, Cliente).',
      icon: <ShieldCheck size={28} />,
    },
    {
      id: 'permissoes',
      title: 'Permissões do Sistema',
      desc: 'Gerencie detalhadamente privilégios e recursos acessíveis por perfil.',
      icon: <FolderLock size={28} />,
    },
    {
      id: 'modulos-sistema',
      title: 'Módulos do Sistema',
      desc: 'Ative ou desative funcionalidades para toda a equipe do escritório.',
      icon: <Boxes size={28} />,
    },
    {
      id: 'contadores',
      title: 'Contadores Responsáveis',
      desc: 'Cadastre os contadores do escritório e defina quem assina os relatórios.',
      icon: <UserCheck size={28} />,
    },
    {
      id: 'compartilhamento',
      title: 'Compartilhamento de Docs',
      desc: 'Pré-configurações de expiração automática, senhas e links para compartilhamento externo.',
      icon: <Share2 size={28} />,
    },
    {
      id: 'marca-dagua',
      title: "Marca d'Água",
      desc: 'Carregue logotipos e gerencie a identidade visual de relatórios em PDF.',
      icon: <FileText size={28} />,
    },
    {
      id: 'contas-bancarias',
      title: 'Contas Bancárias',
      desc: 'Cadastre bancos, agências, contas e saldos do escritório.',
      icon: <Landmark size={28} />,
    },
    {
      id: 'integracao-bancaria',
      title: 'Integrações Bancárias',
      desc: 'Configure chaves de API, ambiente e webhooks de gateways financeiros.',
      icon: <CreditCard size={28} />,
    },
    {
      id: 'integracao-fiscal',
      title: 'Integração Fiscal (NFS-e)',
      desc: 'Configure o ambiente de emissão, provedores WebISS, certificados e credenciais.',
      icon: <Shield size={28} />,
    },
    {
      id: 'visualizadores-xml',
      title: 'Modelos de XML',
      desc: 'Configure visualizadores para NFS-e, NFC-e, NF-e, CT-e, MDF-e e arquivos cancelados.',
      icon: <FileCode2 size={28} />,
    },
    {
      id: 'calculator-prefs',
      title: 'Modelo da Calculadora',
      desc: 'Defina o modelo da calculadora padrão e gerencie preferências de abas.',
      icon: <Calculator size={28} />,
    },
    /*
    {
      id: 'armazenamento',
      title: 'Planos e Contratações',
      desc: 'Acompanhe limites de empresas, usuários, armazenamento contratado e opções de contratação.',
      icon: <HardDrive size={28} />,
    },
    */
    {
      id: 'api-status',
      title: 'Status das APIs',
      desc: 'Monitore latência, uptime e disponibilidade dos serviços integrados.',
      icon: <Activity size={28} />,
    },
    {
      id: 'logs-eventos',
      title: 'Logs e Eventos',
      desc: 'Auditoria de segurança e histórico detalhado de ações dos usuários.',
      icon: <History size={28} />,
    },
  ];
  const cardsVisiveis = cards.filter((card) => podeAcessarCard(card.id));

  const renderActiveSubModule = () => {
    if (activeSubTab && !podeAcessarCard(activeSubTab)) {
      return <MeuPerfilConfig />;
    }
    switch (activeSubTab) {
      case 'meu-perfil':
        return <MeuPerfilConfig />;
      case 'perfis':
        return <PerfisConfig />;
      case 'permissoes':
        return <PermissoesConfig />;
      case 'empresa':
        return <EmpresaConfig />;
      case 'usuarios':
        return <UsuariosConfig />;
      case 'contadores':
        return <ContadoresConfig />;
      case 'api-status':
        return <ApiStatusConfig />;
      case 'logs-eventos':
        return <LogsEventosConfig />;
      case 'contas-bancarias':
        return <ContasBancariasConfig />;
      case 'integracao-bancaria':
        return <BancariaConfig />;
      case 'marca-dagua':
        return <MarcaDaguaConfig />;
      case 'armazenamento':
        return <ArmazenamentoConfig />;
      case 'calculator-prefs':
        return <CalculatorPrefsConfig />;
      case 'integracao-fiscal':
        return <FiscalConfig />;
      case 'visualizadores-xml':
        return <VisualizadoresXmlConfig />;
      case 'compartilhamento':
        return <CompartilhamentoConfig />;
      case 'modulos-sistema':
        return <ModulosSistemaConfig />;
      default:
        return (
          <div className="submodule-content-card">
            <p style={{ margin: 0, color: '#64748b' }}>
              Selecione um submódulo de configurações para continuar.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="configuracoes-wrapper">
      {activeSubTab ? (
        <div className="submodule-container animate-fade-in">
          {/* Back button */}
          <button className="btn-back-to-grid" onClick={() => setActiveSubTab(null)}>
            <ArrowLeft size={16} /> Voltar para Configurações
          </button>
          
          {/* Render target config page */}
            <div className="submodule-viewport">
            <ConfigSubmoduleErrorBoundary
              key={activeSubTab ?? 'root'}
              onReset={() => setActiveSubTab(null)}
            >
              {renderActiveSubModule()}
            </ConfigSubmoduleErrorBoundary>
          </div>
        </div>
      ) : (
        <div className="config-grid-section">
          <div className="config-page-title">
            <h1>Configurações do Sistema</h1>
            <p>Gerencie as preferências, permissões e chaves de integrações do escritório.</p>
          </div>

          {/* Cards Grid */}
          <div className="config-cards-grid animate-slide-up">
            {cardsVisiveis.map((card) => (
              <button
                type="button"
                className="config-sub-card"
                key={card.id}
                onClick={() => setActiveSubTab(card.id)}
                style={{ textAlign: 'left' }}
              >
                <div className="config-sub-card-icon-wrapper">
                  {card.icon}
                </div>
                <div className="config-sub-card-info">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default ConfiguracoesPage;
