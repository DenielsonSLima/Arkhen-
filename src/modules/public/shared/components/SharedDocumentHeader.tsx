import React from 'react';
import systemLogoImg from '../../../../assets/camada-o.png';

interface SharedDocumentHeaderProps {
  empresaLogo?: string | null;
  empresaNome: string;
}

export const SharedDocumentHeader: React.FC<SharedDocumentHeaderProps> = ({
  empresaLogo,
  empresaNome,
}) => {
  return (
    <header
      style={{
        maxWidth: '1440px',
        margin: '0 auto 16px',
        color: '#e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {empresaLogo ? (
          <img
            src={empresaLogo}
            alt={empresaNome}
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'contain',
              borderRadius: '8px',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))',
            }}
          />
        ) : (
          <img
            src={systemLogoImg}
            alt="Arkhen Logo"
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))',
            }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#cbd5e1' }}>
            Arkhen
          </p>
          <h2 style={{ margin: '2px 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            Gestão Contábil
          </h2>
        </div>
      </div>
      <div
        style={{
          fontSize: '0.74rem',
          color: '#dfb35e',
          background: 'rgba(197, 146, 53, 0.1)',
          border: '1px solid rgba(197, 146, 53, 0.35)',
          padding: '6px 14px',
          borderRadius: '999px',
          fontWeight: 700,
        }}
      >
        Acesso Temporário Seguro
      </div>
    </header>
  );
};
