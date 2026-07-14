import React from 'react';
import {
  Users, Calendar, FileText, Calculator,
  CreditCard, Building2, FolderLock, ShieldCheck,
  Activity, Briefcase, Link2, AlertTriangle,
} from 'lucide-react';

interface ModuleCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
}

const modules: ModuleCard[] = [
  {
    icon: <Users size={26} />,
    title: 'Gestão de Clientes',
    desc: 'Cadastro completo de empresas com CNPJ, regime tributário, contatos e histórico de atividades.',
  },
  {
    icon: <Calendar size={26} />,
    title: 'Atividades e Prazos',
    desc: 'Controle de rotinas mensais, tarefas internas, fechamentos e auditoria por competência.',
  },
  {
    icon: <FileText size={26} />,
    title: 'Protocolos Digitais',
    desc: 'Rastro auditado de data, hora e IP para cada documento enviado ao cliente. Comprovante jurídico.',
  },
  {
    icon: <Calculator size={26} />,
    title: 'Simulações e Cálculos',
    desc: 'Calculadora de rescisão, férias, pró-labore e simulação comparativa de regimes tributários.',
  },
  {
    icon: <CreditCard size={26} />,
    title: 'Faturamento Asaas',
    desc: 'Boletos, Pix e cartão integrados. Régua de cobrança automática por e-mail e WhatsApp.',
    badge: 'Integração Asaas',
    badgeColor: '#c59235',
  },
  {
    icon: <Building2 size={26} />,
    title: 'Emissão de NFS-e',
    desc: 'Nota Fiscal automática após recebimento, com homologação via API da prefeitura municipal.',
    badge: 'Homologação Obrigatória',
    badgeColor: '#d97706',
  },
  {
    icon: <FolderLock size={26} />,
    title: 'Documentos com Senha',
    desc: 'Links temporários protegidos por senha e data de expiração para compartilhamento seguro.',
  },
  {
    icon: <Link2 size={26} />,
    title: 'Portal Público do Cliente',
    desc: 'Página de download exclusiva sem login. Contador regressivo de expiração e identificação da empresa.',
  },
  {
    icon: <ShieldCheck size={26} />,
    title: 'Conformidade e RLS',
    desc: 'Segurança multi-empresa com RLS absoluto. Dados completamente isolados entre escritórios.',
  },
  {
    icon: <Activity size={26} />,
    title: 'Financeiro',
    desc: 'Controle de contas a pagar e receber, inadimplência e conciliação bancária integrada.',
  },
  {
    icon: <Briefcase size={26} />,
    title: 'Agenda',
    desc: 'Calendário de reuniões, compromissos e lembretes vinculados ao cliente ou obrigação.',
  },
  {
    icon: <AlertTriangle size={26} />,
    title: 'Parametrização',
    desc: 'Configure regimes, modelos de cobranças, usuários, permissões e integrações da conta.',
  },
];

export const LandingModules: React.FC = () => {
  return (
    <section id="modules" className="section bg-light modules-section">
      <div className="container">
        <div className="section-header">
          <span
            className="hero-tag"
            style={{
              marginBottom: '16px',
              backgroundColor: 'rgba(197, 146, 53, 0.1)',
              color: '#a0720d',
              border: '1px solid rgba(197, 146, 53, 0.3)',
            }}
          >
            Módulos do Sistema
          </span>
          <h2 className="section-title">
            Tudo que um Escritório Contábil Precisa
          </h2>
          <p className="section-subtitle">
            Cada módulo foi pensado para resolver uma dor real da rotina contábil.
            Da parametrização à entrega de documentos — tudo integrado e auditado.
          </p>
        </div>

        <div className="modules-grid">
          {modules.map((mod, i) => (
            <div key={i} className="module-card">
              <div className="module-icon">{mod.icon}</div>
              <div className="module-info">
                <h4 className="module-title">{mod.title}</h4>
                {mod.badge && (
                  <span
                    className="module-badge"
                    style={{ backgroundColor: `${mod.badgeColor}18`, color: mod.badgeColor, border: `1px solid ${mod.badgeColor}40` }}
                  >
                    {mod.badge}
                  </span>
                )}
                <p className="module-desc">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
