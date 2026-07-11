import React from 'react';
import { HELP_DATA } from './constants/helpData';
import { HelpModuleCard } from './components/HelpModuleCard';
import './styles/GuiaAjuda.css';

export const GuiaAjudaPage: React.FC = () => {
  return (
    <div className="submodule-content-card animate-fade-in">
      <div className="help-page-container">
        {/* Cabeçalho */}
        <div className="table-actions-row" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.15)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontFamily: 'var(--font-serif)' }}>Guia de Navegação do Sistema</h2>
            <p style={{ fontSize: '0.86rem', color: '#94a3b8', marginTop: '4px' }}>
              Manual rápido para o contador iniciar, usar os módulos e localizar funcionalidades.
            </p>
          </div>
        </div>

        {/* Introdução */}
        <section className="help-intro">
          <h3>Como usar no dia a dia</h3>
          <ol>
            <li>Comece no <strong>Início</strong> para mapear pendências do dia.</li>
            <li>Abra <strong>Clientes</strong> para validar empresa e situação fiscal.</li>
            <li>Depois use <strong>Atividades</strong> e <strong>Agenda</strong> para distribuir e acompanhar execução.</li>
            <li>Confirme progresso em <strong>Protocolos</strong>, <strong>Documentos</strong> e <strong>Faturamento/Financeiro</strong>.</li>
          </ol>
        </section>

        {/* Grid de Módulos */}
        <section className="help-grid">
          {HELP_DATA.map((module) => (
            <HelpModuleCard key={module.titulo} module={module} />
          ))}
        </section>
      </div>
    </div>
  );
};
