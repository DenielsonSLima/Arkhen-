import React from 'react';
import { ArrowRight, Play, ShieldCheck } from 'lucide-react';
import { navigate } from '../../../../lib/navigation';
import screenDashboard from '../assets/screen-dashboard.png';
import heroBg from '../assets/hero-bg.png';

export const LandingHero: React.FC = () => {
  return (
    <section className="hero" style={{ backgroundImage: `url(${heroBg})` }}>
      {/* Dark overlay so text stays readable */}
      <div className="hero-bg-overlay"></div>

      <div className="container hero-grid">
        {/* Left column: copywriting and CTAs */}
        <div className="hero-content">
          <div className="hero-tag">
            <ShieldCheck size={14} />
            <span>Gestão operacional para escritórios contábeis</span>
          </div>

          <h1 className="hero-title">
            Sua operação contábil <br />
            <span className="highlight-gold">organizada do prazo ao recebimento.</span>
          </h1>

          <p className="hero-desc">
            Centralize clientes, tarefas, fechamentos, documentos, protocolos e cobranças em um só painel,
            com histórico para acompanhar a rotina da equipe.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn-gold"
              onClick={() => navigate('/signup')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Criar Conta Grátis
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn-outline-gold"
              onClick={() => navigate('/login')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={14} fill="currentColor" />
              Acessar Área do Gestor
            </button>
          </div>
        </div>

        {/* Right column: Real dashboard screenshot in laptop mockup */}
        <div className="hero-visual">
          <div className="laptop-mockup">
            {/* Laptop screen bezel */}
            <div className="laptop-screen-bezel">
              <div className="laptop-camera-dot"></div>
              <div className="laptop-inner-screen">
                {/* Browser-style bar */}
                <div className="laptop-browser-bar">
                  <div className="browser-dots-mini">
                    <span style={{ background: '#ef4444' }}></span>
                    <span style={{ background: '#f59e0b' }}></span>
                    <span style={{ background: '#10b981' }}></span>
                  </div>
                  <div className="laptop-url-bar">
                    arkhen.contabil/inicio
                  </div>
                </div>
                {/* Screenshot sem barra do browser */}
                <img
                  src={screenDashboard}
                  alt="Dashboard Arkhen Gestão Contábil"
                  className="laptop-screenshot"
                />
              </div>
            </div>
            {/* Laptop base/keyboard */}
            <div className="laptop-base">
              <div className="laptop-hinge"></div>
              <div className="laptop-keyboard-area"></div>
              <div className="laptop-trackpad"></div>
            </div>
          </div>

          {/* Floating notification cards */}
          <div className="hero-float-card hero-float-top">
            <div className="hero-float-dot" style={{ background: '#10b981' }}></div>
            <div>
              <div className="hero-float-title">Exemplo de NFS-e</div>
              <div className="hero-float-sub">Disponível em municípios homologados</div>
            </div>
          </div>

          <div className="hero-float-card hero-float-bottom">
            <div className="hero-float-dot" style={{ background: '#c59235' }}></div>
            <div>
              <div className="hero-float-title">Boleto Liquidado</div>
              <div className="hero-float-sub">R$ 750,00 via Banco Inter</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
