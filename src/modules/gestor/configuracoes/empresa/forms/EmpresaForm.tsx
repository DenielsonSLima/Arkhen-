import React, { useRef, useState } from 'react';
import { Search, Upload } from 'lucide-react';
import type { EmpresaDados } from '../services/empresaService';

interface EmpresaFormProps {
  dados: EmpresaDados;
  isSaving: boolean;
  isSearchingCnpj: boolean;
  onInputChange: (field: keyof EmpresaDados, value: string | number | null) => void;
  onLookupCnpj: () => void;
  onLogoUpload: (file?: File) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EmpresaForm: React.FC<EmpresaFormProps> = ({
  dados,
  isSaving,
  isSearchingCnpj,
  onInputChange,
  onLookupCnpj,
  onLogoUpload,
  onSubmit,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <form onSubmit={onSubmit} className="config-form">
      
      {/* Brand Logo Uploader Section */}
      <div className="logo-uploader-section" style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
        <div 
          className="logo-preview-container"
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            borderRadius: '12px',
            border: isDragging ? '2px dashed #c59235' : '1px solid #e2e8f0',
            background: isDragging ? '#fffdf7' : '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              onLogoUpload(file);
            }
          }}
        >
          {dados.logoUrl ? (
            <img 
              src={dados.logoUrl} 
              alt="Logo da empresa" 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                height: `${dados.logoTamanho ?? 80}px`,
                width: 'auto', 
                objectFit: 'contain',
                transition: 'height 0.15s ease'
              }} 
            />
          ) : (
            <div className="logo-placeholder-text">Sem Logo</div>
          )}
          <button
            type="button"
            className="btn-upload-logo-overlay"
            onClick={() => logoInputRef.current?.click()}
            disabled={isSaving}
          >
            <Upload size={16} />
            <span>Alterar</span>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              onLogoUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </div>
        <div className="logo-uploader-info" style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Logotipo da Empresa</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Arraste um arquivo de imagem aqui ou clique para selecionar.
          </p>
          
          {dados.logoUrl && (
            <div style={{ marginTop: '12px', maxWidth: '280px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.78rem', display: 'block', marginBottom: '6px', color: '#475569' }}>
                Ajustar Altura do Logo ({dados.logoTamanho ?? 80}px)
              </label>
              <div className="opacity-slider-wrapper">
                <input
                  type="range"
                  min="30"
                  max="110"
                  value={dados.logoTamanho ?? 80}
                  onChange={(e) => onInputChange('logoTamanho', parseInt(e.target.value))}
                  disabled={isSaving}
                  className="opacity-slider"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="form-row-grid">
        {/* CNPJ Field with Inline Search Action */}
        <div className="form-item-group">
          <label>CNPJ da Empresa</label>
          <div className="input-group-search">
            <input
              type="text"
              value={dados.cnpj}
              onChange={(e) => onInputChange('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
              disabled={isSaving || isSearchingCnpj}
              className="input-cnpj-search"
            />
            <button
              type="button"
              className="btn-action-cnpj-search"
              onClick={onLookupCnpj}
              disabled={isSaving || isSearchingCnpj || !dados.cnpj}
            >
              {isSearchingCnpj ? (
                'Buscando...'
              ) : (
                <>
                  <Search size={16} />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="form-item-group">
          <label>Inscrição Estadual</label>
          <input
            type="text"
            value={dados.inscricaoEstadual}
            onChange={(e) => onInputChange('inscricaoEstadual', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Razão Social</label>
          <input
            type="text"
            value={dados.razaoSocial}
            onChange={(e) => onInputChange('razaoSocial', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
        <div className="form-item-group">
          <label>Nome Fantasia</label>
          <input
            type="text"
            value={dados.nomeFantasia}
            onChange={(e) => onInputChange('nomeFantasia', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>E-mail Corporativo</label>
          <input
            type="email"
            value={dados.email}
            onChange={(e) => onInputChange('email', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
        <div className="form-item-group">
          <label>Telefone</label>
          <input
            type="text"
            value={dados.telefone}
            onChange={(e) => onInputChange('telefone', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
      </div>

      <div className="form-divider-title">Endereço</div>

      <div className="form-row-grid address-grid">
        <div className="form-item-group">
          <label>CEP</label>
          <input
            type="text"
            value={dados.cep}
            onChange={(e) => onInputChange('cep', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
        <div className="form-item-group street">
          <label>Endereço / Logradouro</label>
          <input
            type="text"
            value={dados.endereco}
            onChange={(e) => onInputChange('endereco', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
        <div className="form-item-group number">
          <label>Nº</label>
          <input
            type="text"
            value={dados.numero}
            onChange={(e) => onInputChange('numero', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Cidade</label>
          <input
            type="text"
            value={dados.cidade}
            onChange={(e) => onInputChange('cidade', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
        <div className="form-item-group">
          <label>Estado</label>
          <input
            type="text"
            value={dados.estado}
            onChange={(e) => onInputChange('estado', e.target.value)}
            disabled={isSaving || isSearchingCnpj}
          />
        </div>
      </div>

      <div className="form-actions-row">
        <button type="submit" className="btn-save-settings" disabled={isSaving || isSearchingCnpj}>
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
};
