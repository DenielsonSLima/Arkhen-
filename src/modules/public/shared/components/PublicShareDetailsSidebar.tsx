import React from 'react';
import { Building2, Calendar, Download, Info, Loader2, Shield, Timer } from 'lucide-react';
import type { PublicSharedDocumentPayload } from '../types';

interface PublicShareDetailsSidebarProps {
  shareData: PublicSharedDocumentPayload;
  isExpired: boolean;
  isSingleFile: boolean;
  remainingLabel: string;
  isBatchDownloading: boolean;
  canDownloadAll: boolean;
  onDownloadSelected: () => void;
  onDownloadAll: () => void;
}

export const PublicShareDetailsSidebar: React.FC<PublicShareDetailsSidebarProps> = ({
  shareData,
  isExpired,
  isSingleFile,
  remainingLabel,
  isBatchDownloading,
  canDownloadAll,
  onDownloadSelected,
  onDownloadAll,
}) => (
  <div className="public-shared-body-right">
    <div className="sidebar-scroll-content">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px', textAlign: 'left' }}>
        {shareData.empresaLogo ? (
          <img
            src={shareData.empresaLogo}
            alt={shareData.empresa}
            style={{
              width: '82px',
              height: '82px',
              objectFit: 'contain',
              borderRadius: '50%',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              minWidth: '82px',
            }}
          />
        ) : (
          <div
            style={{
              width: '82px',
              height: '82px',
              borderRadius: '50%',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              minWidth: '82px',
            }}
          >
            <Building2 size={40} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Empresa emissora
          </span>
          <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>
            {shareData.empresa}
          </strong>
          {shareData.empresaCnpj && (
            <span style={{ fontSize: '0.72rem', color: '#c59235', fontWeight: 700, marginTop: '1px' }}>
              CNPJ {shareData.empresaCnpj}
            </span>
          )}
          <span style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '4px', lineHeight: 1.3, fontWeight: 500 }}>
            A responsabilidade pelo conteúdo e integridade deste arquivo é exclusiva da empresa emissora.
          </span>
        </div>
      </div>

      <div className="info-row" style={{ marginBottom: '14px' }}>
        <div className="info-icon-wrapper"><Calendar size={18} /></div>
        <div className="info-text-group">
          <span className="info-title">Compartilhado em</span>
          <strong className="info-value" style={{ color: '#334155' }}>{shareData.dataGeracao}</strong>
        </div>
      </div>

      <div className="info-row" style={{ marginBottom: '14px' }}>
        <div className="info-icon-wrapper"><Timer size={18} /></div>
        <div className="info-text-group">
          <span className="info-title">Prazo de acesso</span>
          <strong className="info-value" style={{ color: '#334155' }}>{shareData.tempoLimite}</strong>
        </div>
      </div>

      <div className="info-row" style={{ marginBottom: '14px' }}>
        <div className="info-icon-wrapper"><Timer size={18} /></div>
        <div className="info-text-group">
          <span className="info-title">Tempo restante</span>
          <strong
            className="info-value"
            style={{
              color: isExpired ? '#ef4444' : (isSingleFile ? '#2563eb' : '#ef4444'),
              fontSize: '1.25rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              marginTop: '2px',
            }}
          >
            {remainingLabel || '...'}
          </strong>
        </div>
      </div>

      <div className="info-row" style={{ marginBottom: '20px' }}>
        <div className="info-icon-wrapper danger"><Calendar size={18} /></div>
        <div className="info-text-group">
          <span className="info-title">Expira em</span>
          <strong className="info-value" style={{ color: '#ef4444' }}>{shareData.dataExpiracao}</strong>
        </div>
      </div>
    </div>

    {isSingleFile ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
        <button
          type="button"
          className="btn-primary-blue"
          onClick={onDownloadSelected}
          disabled={isExpired || isBatchDownloading}
        >
          {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Baixar arquivo
        </button>
        <div className="sidebar-warning-box info" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <Info size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
          <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
            Após o vencimento, o link e o arquivo <strong style={{ color: '#2563eb' }}>não estarão mais disponíveis</strong>.
          </span>
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
        <button
          type="button"
          className="btn-primary-blue"
          onClick={onDownloadAll}
          disabled={isExpired || !canDownloadAll || isBatchDownloading}
        >
          {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Baixar todos os arquivos (.zip)
        </button>
        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '-6px', textAlign: 'center' }}>
          Todos os arquivos serão baixados compactados em um único arquivo .zip
        </span>
        <div className="sidebar-warning-box">
          <Shield size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
          <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
            <strong style={{ color: '#2563eb' }}>Compartilhamento seguro.</strong> Este link é seguro e não requer login. Não compartilhe com pessoas não autorizadas.
          </span>
        </div>
      </div>
    )}
  </div>
);
