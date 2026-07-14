import React from 'react';
import loginLogoImg from '../../../../assets/camada-o.png';
import { navigate } from '../../../../lib/navigation';

export const LandingFooter: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand">
            <div className="nav-brand" style={{ marginBottom: '12px' }}>
              <img src={loginLogoImg} alt="Logo Arkhen" className="nav-logo" style={{ width: '38px', height: '38px' }} />
              <div className="brand-title-group">
                <span className="brand-name" style={{ fontSize: '1.2rem' }}>Arkhen</span>
                <span className="brand-subtitle" style={{ fontSize: '0.7rem' }}>Gestão Contábil</span>
              </div>
            </div>
            <p>
              A plataforma inteligente que organiza as rotinas, prazos e documentos de escritórios de contabilidade e seus clientes.
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h5>Navegação</h5>
            <div className="footer-links">
              <span className="footer-link-item" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Início
              </span>
              <span className="footer-link-item" onClick={() => scrollToSection('features')}>
                Funcionalidades
              </span>
              <span className="footer-link-item" onClick={() => scrollToSection('security')}>
                Segurança
              </span>
              <span className="footer-link-item" onClick={() => scrollToSection('faq')}>
                Perguntas Frequentes
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div className="footer-links-col">
            <h5>Comece Agora</h5>
            <div className="footer-links">
              <span className="footer-link-item" onClick={() => navigate('/login')}>
                Acessar Área do Gestor
              </span>
              <span className="footer-link-item" onClick={() => navigate('/signup')}>
                Cadastrar Novo Escritório
              </span>
              <span className="footer-link-item" onClick={() => navigate('/login')}>
                Esqueci Minha Senha
              </span>
            </div>
          </div>
        </div>

        {/* Footer Bottom copyright */}
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Arkhen Gestão Contábil. Todos os direitos reservados.</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>Desenvolvido com Tecnologia RLS Multi-Tenant</span>
        </div>
      </div>
    </footer>
  );
};
