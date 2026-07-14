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
            <span>Segurança Nível Bancário</span>
          </div>

          <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '20px', color: 'var(--color-text-white)' }}>
            Seus dados fiscais e de clientes <br />
            <span className="highlight-gold">totalmente blindados na nuvem</span>
          </h2>

          <p className="section-subtitle" style={{ textAlign: 'left', fontSize: '1.05rem', marginBottom: '32px', color: 'var(--color-text-muted)' }}>
            Na Arkhen, a segurança não é um detalhe — é a nossa fundação. Adotamos o princípio do isolamento estrito de dados e controles rígidos de acesso.
          </p>

          <div className="security-points">
            <div className="security-card">
              <Lock className="security-card-icon" size={24} />
              <h4>Isolamento RLS Obrigatório</h4>
              <p>Segurança a nível de linha (Row Level Security) no Supabase garante que os dados de uma empresa nunca vazem para outra.</p>
            </div>
            
            <div className="security-card">
              <Shield className="security-card-icon" size={24} />
              <h4>Criptografia de Ponta a Ponta</h4>
              <p>Tráfego criptografado por SSL/TLS e documentos em repouso armazenados com fortes chaves de segurança.</p>
            </div>

            <div className="security-card">
              <Server className="security-card-icon" size={24} />
              <h4>Backups Diários e Redundância</h4>
              <p>Cópias automáticas de segurança do banco de dados e arquivos para evitar perda de dados por falha física.</p>
            </div>

            <div className="security-card">
              <Database className="security-card-icon" size={24} />
              <h4>Trilha de Auditoria (Logs)</h4>
              <p>Acompanhe acessos, downloads de guias e ações realizadas na plataforma com registro de IP e carimbo de data/hora.</p>
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
            
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Isolamento Ativo</h3>
            <p style={{ fontSize: '0.82rem', color: '#a0a0a0', maxWidth: '280px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
              O sistema monitora conexões e bloqueia ativamente tentativas de acesso não autorizadas.
            </p>
            
            <span className="security-audit-tag">
              100% Compatível com a LGPD
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
