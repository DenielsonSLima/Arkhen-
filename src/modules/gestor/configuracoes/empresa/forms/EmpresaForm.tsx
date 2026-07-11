import React, { useRef } from 'react';
import { Search, Upload } from 'lucide-react';
import type { EmpresaDados } from '../services/empresaService';

interface EmpresaFormProps {
  dados: EmpresaDados;
  isSaving: boolean;
  isSearchingCnpj: boolean;
  onInputChange: (field: keyof EmpresaDados, value: string | null) => void;
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

  return (
    <form onSubmit={onSubmit} className="config-form">
      
      {/* Brand Logo Uploader Section */}
      <div className="logo-uploader-section">
        <div className="logo-preview-container">
          {dados.logoUrl ? (
            <img src={dados.logoUrl} alt="Logo da empresa" className="logo-preview-img" />
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
        <div className="logo-uploader-info">
          <h4>Logotipo da Empresa</h4>
          <p>Selecione a identidade visual do seu escritório para relatórios e faturas.</p>
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
