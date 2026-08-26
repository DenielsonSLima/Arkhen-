import React from 'react';
import { Settings, Users, Globe, ArrowRight } from 'lucide-react';
import { navigate } from '../../../../lib/navigation';

export const LandingCustomizations: React.FC = () => {
  return (
    <section id="customizations" className="section bg-dark">
      <div className="container">
        <div className="section-header">
          <span className="hero-tag" style={{ marginBottom: '16px' }}>Flexibilidade & Integração</span>
          <h2 className="section-title">
            Ecossistema Sob Medida & <span className="highlight-gold">Compartilhamento Seguro</span>
          </h2>
          <p className="section-subtitle">
            O Arkhen cresce com o seu escritório. Uma plataforma flexível feita para atender as particularidades da sua equipe e dos seus parceiros.
          </p>
        </div>

        <div className="customizations-grid">
          {/* Card 1: acesso externo */}
          <div className="custom-feature-card">
            <div className="custom-card-header">
              <div className="custom-icon-wrapper">
                <Users size={24} />
              </div>
              <div>
                <h3>Compartilhamento com o Cliente</h3>
                <span className="custom-card-badge">Links protegidos</span>
              </div>
            </div>
            <p className="custom-card-desc">
              Disponibilize arquivos por links temporários protegidos por senha, sem prometer um portal autenticado que ainda não está ativo.
            </p>
            <ul className="custom-card-list">
              <li>Download do arquivo compartilhado pelo escritório</li>
              <li>Senha e prazo de expiração configuráveis</li>
              <li>Registro de tentativas e downloads do link</li>
            </ul>
          </div>

          {/* Card 2: Website Institucional */}
          <div className="custom-feature-card">
            <div className="custom-card-header">
              <div className="custom-icon-wrapper">
                <Globe size={24} />
              </div>
              <div>
                <h3>Site Institucional</h3>
                <span className="custom-card-badge">Desenvolvimento Adicional</span>
              </div>
            </div>
            <p className="custom-card-desc">
              Além da plataforma interna de gestão, podemos projetar e publicar um site institucional completo e moderno para o seu escritório contábil atrair novos clientes, integrado aos canais de contato do escritório.
            </p>
            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn-outline-gold"
                onClick={() => navigate('/demo-publico')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', padding: '10px 16px' }}
              >
                Ver Exemplo de Site Demo
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Card 3: Custom Development */}
          <div className="custom-feature-card">
            <div className="custom-card-header">
              <div className="custom-icon-wrapper">
                <Settings size={24} />
              </div>
              <div>
                <h3>Desenvolvimento Sob Medida</h3>
                <span className="custom-card-badge">Customizações & Adaptações</span>
              </div>
            </div>
            <p className="custom-card-desc">
              Sua contabilidade possui fluxos específicos ou integrações exclusivas? Nossa equipe de engenharia pode desenvolver novas funcionalidades e realizar ajustes finos conforme a necessidade do seu modelo de negócio.
            </p>
            <div className="custom-card-note">
              <strong>Nota sobre custos:</strong> Dependendo do escopo e complexidade do ajuste, as novas funções podem ser desenvolvidas de forma gratuita ou sob um orçamento sob consulta prévia.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
