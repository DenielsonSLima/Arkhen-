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
              Um caminho direto para configurar o escritório, organizar a carteira e executar a rotina.
            </p>
          </div>
        </div>

        {/* Introdução */}
        <section className="help-intro">
          <h3>Como usar no dia a dia</h3>
          <ol>
            <li>Conclua os <strong>Primeiros passos</strong> no Início e revise atrasos e vencimentos de hoje.</li>
            <li>Cadastre e confira a carteira em <strong>Clientes</strong>.</li>
            <li>Crie o checklist em <strong>Parametrização › Modelos de fechamento</strong> e vincule-o em <strong>Atividades › Rotinas programadas</strong>.</li>
            <li>Execute o dia pela <strong>Minha Fila</strong> e acompanhe a equipe no <strong>Painel Operacional</strong>.</li>
            <li>Use <strong>Documentos</strong>, <strong>Protocolos</strong> e <strong>Faturamento</strong> conforme a etapa do atendimento.</li>
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
