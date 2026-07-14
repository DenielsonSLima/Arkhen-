import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import loginLogoImg from '../../../../assets/camada-o.png';
import { navigate } from '../../../../lib/navigation';

export const LandingNavbar: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="landing-navbar">
      <div className="container navbar-container">
        {/* Brand/Logo */}
        <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src={loginLogoImg} alt="Logo Arkhen" className="nav-logo" />
          <div className="brand-title-group">
            <span className="brand-name">Arkhen</span>
            <span className="brand-subtitle">Gestão Contábil</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="nav-links">
          <span className="nav-link" onClick={() => scrollToSection('features')}>
            Funcionalidades
          </span>
          <span className="nav-link" onClick={() => scrollToSection('security')}>
            Segurança
          </span>
          <span className="nav-link" onClick={() => scrollToSection('faq')}>
            FAQs
          </span>
          <span className="nav-link" onClick={() => navigate('/demo-publico')} style={{ color: 'var(--color-gold-light)', fontWeight: 700 }}>
            Ver Site Demo
          </span>
        </div>

        {/* CTA Actions */}
        <div className="nav-actions">
          <button 
            type="button" 
            className="btn-outline-gold" 
            onClick={() => navigate('/login')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogIn size={16} />
            Entrar
          </button>
          <button 
            type="button" 
            className="btn-gold" 
            onClick={() => navigate('/signup')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus size={16} />
            Criar Conta
          </button>
        </div>
      </div>
    </nav>
  );
};
