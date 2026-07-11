import React from 'react';
import { Upload } from 'lucide-react';
import type { FiscalConfigData } from '../services/fiscalIntegrationService';

interface FiscalCertificadoProps {
  config: FiscalConfigData;
  setConfig: React.Dispatch<React.SetStateAction<FiscalConfigData>>;
  dragActive: boolean;
  testingCert: boolean;
  certResult: { success: boolean; message: string } | null;
  showCertModal: boolean;
  setShowCertModal: React.Dispatch<React.SetStateAction<boolean>>;
  onTestCert: () => void;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getCertBadge: (days: number) => React.ReactNode;
}

export const FiscalCertificado: React.FC<FiscalCertificadoProps> = ({
  config,
  setConfig,
  dragActive,
  testingCert,
  certResult,
  showCertModal,
  setShowCertModal,
  onTestCert,
  onDrag,
  onDrop,
  onFileChange,
  getCertBadge,
}) => {
  return (
    <div className="config-form">
      
      <div className="form-divider-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Certificado Digital A1</span>
        {config.certificadoDiasRestantes ? getCertBadge(config.certificadoDiasRestantes) : null}
      </div>

      <div className="cert-uploader-container">
        
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          className="file-uploader-box"
          style={dragActive ? { borderColor: 'var(--color-gold-primary)', backgroundColor: 'rgba(197, 146, 53, 0.03)' } : {}}
        >
          <input
            type="file"
            id="cert-file-input"
            accept=".pfx,.p12"
            onChange={onFileChange}
            className="hidden"
            style={{ display: 'none' }}
          />
          <label htmlFor="cert-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Upload className="upload-icon" size={28} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-dark)', marginTop: '8px' }}>
              {config.certificadoNome ? config.certificadoNome : 'Arraste seu certificado digital A1 aqui'}
            </span>
            <span className="file-helper">Formatos aceitos: .PFX ou .P12</span>
            <button 
              type="button" 
              className="btn-add-user" 
              style={{ marginTop: '12px', pointerEvents: 'none' }}
            >
              Selecionar Arquivo
            </button>
          </label>
        </div>

        {/* Password & Actions Column */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="form-item-group">
            <label>Senha do Certificado</label>
            <input
              type="password"
              value={config.certificadoSenha}
              onChange={(e) => setConfig(prev => ({ ...prev, certificadoSenha: e.target.value }))}
              placeholder="Senha do arquivo .pfx / .p12"
            />
            <p className="input-helper-text">Armazenamento local criptografado em AES-256 para máxima proteção das chaves.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowCertModal(true)}
              className="btn-add-user"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: 'var(--color-text-dark)',
                boxShadow: 'none',
                padding: '9px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Visualizar Dados
            </button>

            <button
              type="button"
              onClick={onTestCert}
              disabled={testingCert}
              className="btn-save-settings"
              style={{ 
                background: 'none', 
                border: '1px solid #cbd5e1', 
                color: 'var(--color-text-dark)', 
                boxShadow: 'none',
                padding: '9px 16px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              {testingCert ? 'Validando...' : 'Testar Assinatura'}
            </button>
          </div>
        </div>

      </div>

      {/* Success of Cert signature */}
      {certResult && (
        <div className="success-banner animate-fade-in" style={{ marginTop: '16px' }}>
          {certResult.message}
        </div>
      )}

      {/* Detailed Cert Information inside standard Arkhen box */}
      {showCertModal && (
        <div className="watermark-details-panel animate-fade-in" style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCertModal(false)}
            style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--color-text-dark-muted)', cursor: 'pointer' }}
          >
            &times;
          </button>
          
          <div className="form-divider-title" style={{ margin: 0, paddingBottom: '8px' }}>Informações Extraídas do Certificado</div>
          
          <div className="form-row-grid" style={{ gap: '12px' }}>
            <div className="form-item-group">
              <label>Nome do Arquivo</label>
              <input type="text" readOnly value={config.certificadoNome || 'Nenhum certificado carregado'} style={{ backgroundColor: '#fdfdfd' }} />
            </div>
            <div className="form-item-group">
              <label>CNPJ Cadastrado</label>
              <input type="text" readOnly value={config.certificadoCNPJ || '-'} style={{ backgroundColor: '#fdfdfd' }} />
            </div>
          </div>

          <div className="form-row-grid" style={{ gap: '12px', marginTop: '12px' }}>
            <div className="form-item-group">
              <label>Razão Social / Titular</label>
              <input type="text" readOnly value={config.certificadoEmpresa || '-'} style={{ backgroundColor: '#fdfdfd' }} />
            </div>
            <div className="form-item-group">
              <label>Vencimento</label>
              <input type="text" readOnly value={config.certificadoValidade || '-'} style={{ backgroundColor: '#fdfdfd' }} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
