import React from 'react';
import { Shield, BarChart3, Cloud } from 'lucide-react';
import loginLogoImg from '../../../../assets/camada-o.png';

export const LoginBanner: React.FC = () => {
  return (
    <div className="login-banner">
      {/* Overlay to give a premium dark-gold tint and ensure text legibility */}
      <div className="banner-overlay"></div>

      <div className="banner-content">
        {/* Brand Header */}
        <div className="brand-header animate-fade-in">
          <img src={loginLogoImg} alt="Logo ARKHEN Gestão Contábil" className="brand-logo" />
          <div className="brand-title-group">
            <span className="brand-name" style={{ fontSize: '1.8rem' }}>ARKHEN</span>
            <span className="brand-subtitle">Gestão Contábil</span>
          </div>
        </div>

        {/* Hero Slogan */}
        <h1 className="hero-slogan animate-slide-up">
          Gestão contábil que organiza <br />
          <span className="highlight-gold">rotinas, prazos e clientes.</span>
        </h1>

        <p className="hero-description animate-slide-up-delay-1">
          Controle tarefas, protocolos, documentos e faturamento em um só painel, com visão prática para você e sua equipe executarem sem perda de prazo.
        </p>

        {/* Feature List */}
        <div className="features-list animate-slide-up-delay-2">
          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <Shield className="feature-icon" size={20} />
            </div>
            <div className="feature-text">
              <h3 className="feature-title">Segurança avançada</h3>
              <p className="feature-desc">Proteção de dados e acesso seguro</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <BarChart3 className="feature-icon" size={20} />
            </div>
            <div className="feature-text">
              <h3 className="feature-title">Gestão inteligente</h3>
              <p className="feature-desc">Informações precisas para melhores decisões</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <Cloud className="feature-icon" size={20} />
            </div>
            <div className="feature-text">
              <h3 className="feature-title">Acesso em qualquer lugar</h3>
              <p className="feature-desc">Sistema 100% online e integrado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
