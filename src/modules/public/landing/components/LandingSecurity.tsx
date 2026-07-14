import React from 'react';
import { Shield, Lock, Server, Database } from 'lucide-react';

export const LandingSecurity: React.FC = () => {
  return (
    <section id="security" className="section bg-dark">
      <div className="container security-grid">
        {/* Left Column: Copywriting */}
        <div>
          <div className="security-badge">
            <Shield size={14} />
            <span>Controles de acesso</span>
          </div>

          <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '20px', color: 'var(--color-text-white)' }}>
            Seus dados fiscais e de clientes <br />
            <span className="highlight-gold">organizados com acesso controlado</span>
          </h2>

          <p className="section-subtitle" style={{ textAlign: 'left', fontSize: '1.05rem', marginBottom: '32px', color: 'var(--color-text-muted)' }}>
            O Arkhen aplica autenticação, separação de dados por empresa e registros operacionais para apoiar o uso responsável da plataforma.
          </p>

          <div className="security-points">
            <div className="security-card">
              <Lock className="security-card-icon" size={24} />
              <h4>Dados separados por escritório</h4>
              <p>As permissões limitam consultas e alterações à empresa vinculada ao usuário autenticado.</p>
            </div>
            
            <div className="security-card">
              <Shield className="security-card-icon" size={24} />
              <h4>Conexão protegida</h4>
              <p>O acesso à plataforma utiliza conexão HTTPS e autenticação de usuário.</p>
            </div>

            <div className="security-card">
              <Server className="security-card-icon" size={24} />
              <h4>Permissões por usuário</h4>
              <p>Perfis e permissões ajudam o escritório a controlar quem pode visualizar e alterar cada área.</p>
            </div>

            <div className="security-card">
              <Database className="security-card-icon" size={24} />
              <h4>Histórico operacional</h4>
              <p>Consulte registros disponíveis de ações, publicações e acessos para acompanhar a rotina.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Shield & Status */}
        <div className="hero-visual">
          <div className="security-visual-card">
            <div className="shield-pulse-container">
              <div className="shield-pulse-bg"></div>
              <Shield size={64} style={{ color: '#c59235', position: 'relative', zIndex: 2 }} />
            </div>
            
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Acesso controlado</h3>
            <p style={{ fontSize: '0.82rem', color: '#a0a0a0', maxWidth: '280px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
              Cada usuário acessa a plataforma por uma conta autenticada e pelas permissões configuradas para o escritório.
            </p>
            
            <span className="security-audit-tag">
              Privacidade e acesso responsável
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
