import React from 'react';
import { Building2, Timer, Calendar, Clock } from 'lucide-react';
import type { PublicSharedDocumentPayload } from '../types';

interface SharedDocumentSidebarProps {
  shareData: PublicSharedDocumentPayload;
  remainingLabel: string | null;
  isExpired: boolean;
}

const formatCompanyCnpj = (cnpj: string | null) => {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;

  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const SharedDocumentSidebar: React.FC<SharedDocumentSidebarProps> = ({
  shareData,
  remainingLabel,
  isExpired,
}) => {
  const formattedCnpj = shareData.empresaCnpj ? formatCompanyCnpj(shareData.empresaCnpj) : '';

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Dados da Empresa */}
      <div 
        style={{ 
          border: '1px solid rgba(255, 255, 255, 0.15)', 
          borderRadius: '12px', 
          padding: '16px', 
          background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          {shareData.empresaLogo ? (
            <img
              src={shareData.empresaLogo}
              alt={shareData.empresa}
              style={{
                width: '42px',
                height: '42px',
                objectFit: 'contain',
                borderRadius: '6px',
                background: '#ffffff',
                padding: '2px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            />
          ) : (
            <div 
              style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '6px', 
                background: 'rgba(197, 146, 53, 0.15)', 
                border: '1px solid rgba(197, 146, 53, 0.35)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--color-gold-primary)' 
              }}
            >
              <Building2 size={20} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Empresa Emissora
            </span>
            <strong style={{ color: '#ffffff', fontSize: '0.94rem', fontWeight: 800 }}>
              {shareData.empresa}
            </strong>
          </div>
        </div>
        
        {formattedCnpj && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '0.74rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>CNPJ:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formattedCnpj}</span>
          </div>
        )}
      </div>

      {/* Painel de Expiração */}
      <div 
        style={{ 
          border: '1px solid rgba(255, 255, 255, 0.15)', 
          borderRadius: '12px', 
          padding: '16px', 
          background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#cbd5e1' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontWeight: 650 }}>
            <Clock size={14} /> Disponível por:
          </span>
          <strong style={{ color: '#ffffff' }}>{shareData.tempoLimite}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#cbd5e1' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontWeight: 650 }}>
            <Calendar size={14} /> Expira em:
          </span>
          <strong style={{ color: '#ffffff' }}>{shareData.dataExpiracao}</strong>
        </div>

        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontSize: '0.8rem', 
            color: '#cbd5e1',
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            paddingTop: '12px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontWeight: 650 }}>
            <Timer size={14} /> Restante:
          </span>
          <span 
            style={{ 
              color: isExpired ? '#f87171' : '#dfb35e', 
              fontSize: '1rem', 
              fontFamily: 'monospace', 
              fontWeight: 800,
              background: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(197, 146, 53, 0.1)',
              border: isExpired ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(197, 146, 53, 0.3)',
              padding: '2px 8px',
              borderRadius: '6px'
            }}
          >
            {remainingLabel || '...'}
          </span>
        </div>
      </div>

      {/* Detalhes de Geração */}
      <div 
        style={{ 
          border: '1px solid rgba(255, 255, 255, 0.15)', 
          borderRadius: '12px', 
          padding: '16px', 
          background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          fontSize: '0.78rem'
        }}
      >
        <span style={{ color: '#94a3b8', fontWeight: 650, display: 'block', marginBottom: '4px' }}>Gerado em</span>
        <strong style={{ color: '#ffffff' }}>{shareData.dataGeracao}</strong>
      </div>
    </aside>
  );
};
