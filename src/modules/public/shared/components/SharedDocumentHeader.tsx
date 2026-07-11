import React from 'react';
import loginLogoImg from '../../../../assets/camada-o.png';

interface SharedDocumentHeaderProps {
  empresaLogo?: string | null;
  empresaNome?: string;
  empresaCnpj?: string | null;
  isSingleFile?: boolean;
}

const formatCompanyCnpj = (cnpj: string | null) => {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;

  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const SharedDocumentHeader: React.FC<SharedDocumentHeaderProps> = ({
  empresaLogo,
  empresaNome,
  empresaCnpj,
  isSingleFile,
}) => {
  return (
    <header
      style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto 16px',
        color: '#e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      {/* Brand Header - Idêntico ao banner de login */}
      <div className="brand-header animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <img 
          src={loginLogoImg} 
          alt="Logo Arkhen" 
          className="brand-logo" 
          style={{ width: '48px', height: '48px', objectFit: 'contain', background: 'transparent' }} 
        />
        <div className="brand-title-group" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span className="brand-name" style={{ fontSize: '1.45rem', fontWeight: 700, color: '#ffffff', letterSpacing: '1px' }}>
            Arkhen
          </span>
          <span className="brand-subtitle" style={{ fontSize: '0.82rem', color: 'var(--color-gold-primary)', fontWeight: 600, letterSpacing: '1px' }}>
            Gestão Contábil
          </span>
        </div>
      </div>

      {/* Lado Direito */}
      {isSingleFile && empresaNome ? (
        /* Se for arquivo único, exibe os dados da empresa emitente no cabeçalho */
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '8px 16px',
            borderRadius: '10px'
          }}
        >
          {empresaLogo ? (
            <img
              src={empresaLogo}
              alt={empresaNome}
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                borderRadius: '4px',
                background: '#ffffff',
                padding: '1px'
              }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compartilhado por
            </span>
            <strong style={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: 750 }}>
              {empresaNome}
            </strong>
            {empresaCnpj && (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-gold-primary)', fontFamily: 'monospace', fontWeight: 650 }}>
                CNPJ {formatCompanyCnpj(empresaCnpj)}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Caso seja lote de múltiplos arquivos */
        <div
          style={{
            fontSize: '0.74rem',
            color: 'var(--color-gold-primary)',
            background: 'rgba(197, 146, 53, 0.1)',
            border: '1px solid rgba(197, 146, 53, 0.35)',
            padding: '6px 14px',
            borderRadius: '999px',
            fontWeight: 700,
          }}
        >
          Acesso Temporário Seguro
        </div>
      )}
    </header>
  );
};
