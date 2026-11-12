import React, { useState } from 'react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import './FiscalCertificado.css';
import { formatCpfOrCnpj } from '../../../../../lib/cnpj';
import type { FiscalConfigData } from '../services/fiscalIntegrationService';

interface FiscalCertificadoProps {
  config: FiscalConfigData;
  setConfig: React.Dispatch<React.SetStateAction<FiscalConfigData>>;
  dragActive: boolean;
  testingCert: boolean;
  certResult: { success: boolean; message: string } | null;
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
  onTestCert,
  onDrag,
  onDrop,
  onFileChange,
  getCertBadge,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const hasCertificate = Boolean(config.certificadoArquivoConfigured || config.certificadoNome);
  const validity = config.certificadoValidade?.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/, '$3/$2/$1');
  const days = config.certificadoDiasRestantes;

  return (
    <div className="config-form fiscal-certificate-form">
      
      <div className="form-divider-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Certificado Digital A1</span>
        {hasCertificate && days != null ? getCertBadge(days) : null}
      </div>

      <p className="input-helper-text">Para cadastrar ou substituir: digite a senha e selecione o arquivo. O envio valida o A1 e mostra a validade abaixo. O teste de assinatura usa o certificado já salvo.</p>
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
              {config.certificadoNome ? config.certificadoNome : 'Arraste seu certificado A1 (.pfx/.p12, até 3 MB) aqui'}
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
            <label htmlFor="fiscal-certificate-password">Senha do Certificado</label>
            <div className="fiscal-certificate-password">
            <input
              id="fiscal-certificate-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              spellCheck={false}
              aria-describedby="fiscal-certificate-password-help"
              value={config.certificadoSenha}
              onChange={(e) => setConfig(prev => ({ ...prev, certificadoSenha: e.target.value }))}
              placeholder="Senha do arquivo .pfx / .p12"
            />
            <button type="button" className="fiscal-certificate-visibility"
              aria-label={showPassword ? 'Ocultar senha do certificado' : 'Mostrar senha do certificado'}
              aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
            </div>
            <p id="fiscal-certificate-password-help" className="input-helper-text">O arquivo e a senha são enviados pela Edge Function e ficam protegidos no Supabase Vault.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onTestCert}
              disabled={testingCert || !hasCertificate}
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
        <div role="status" className={`${certResult.success ? 'success-banner' : 'error-banner'} animate-fade-in`} style={{ marginTop: '16px' }}>
          {certResult.message}
        </div>
      )}

      {hasCertificate && (
        <section className="watermark-details-panel animate-fade-in" aria-labelledby="certificado-dados-titulo">
          <div id="certificado-dados-titulo" className="form-divider-title" style={{ margin: 0, paddingBottom: '8px' }}>
            Dados do certificado cadastrado
          </div>
          <div className="form-item-group" style={{ marginTop: '12px' }}>
            <label htmlFor="certificado-empresa">Empresa / Titular do certificado</label>
            <input id="certificado-empresa" type="text" readOnly value={config.certificadoEmpresa || '-'} />
          </div>
          <div className="form-row-grid" style={{ gap: '12px', marginTop: '12px' }}>
            <div className="form-item-group">
              <label htmlFor="certificado-cnpj">CNPJ do certificado</label>
              <input id="certificado-cnpj" type="text" readOnly value={config.certificadoCNPJ ? formatCpfOrCnpj(config.certificadoCNPJ) : '-'} />
            </div>
            <div className="form-item-group">
              <label htmlFor="certificado-validade">Data de validade</label>
              <input id="certificado-validade" type="text" readOnly value={validity || '-'} />
            </div>
            <div className="form-item-group">
              <label htmlFor="certificado-dias">Dias restantes</label>
              <input id="certificado-dias" type="text" readOnly value={days == null ? '-' : days < 0 ? 'Expirado' : `${days} ${days === 1 ? 'dia' : 'dias'}`} />
            </div>
          </div>
        </section>
      )}

    </div>
  );
};
