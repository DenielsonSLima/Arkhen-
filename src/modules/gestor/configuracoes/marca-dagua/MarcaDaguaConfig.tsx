import React from 'react';
import { useMarcaDagua } from './hooks/useMarcaDagua';
import { UploadCloud } from 'lucide-react';

export const MarcaDaguaConfig: React.FC = () => {
  const {
    config,
    isLoading,
    isSaving,
    successMsg,
    errorMsg,
    handleToggle,
    handlePosChange,
    handleOpacityChange,
    handleSave,
  } = useMarcaDagua();

  if (isLoading || !config) {
    return <div className="sub-loading">Carregando marca d'água...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header">
        <h2>Marca d'Água para Relatórios</h2>
        <p>Defina um logotipo padrão a ser impresso ou anexado como fundo transparente de relatórios em PDF.</p>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <form onSubmit={handleSave} className="config-form">
        <div className="form-checkbox-group">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={config.habilitado}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={isSaving}
            />
            <span className="checkbox-checkmark"></span>
            Habilitar marca d'água em documentos e relatórios gerados
          </label>
        </div>

        {config.habilitado && (
          <div className="watermark-details-panel animate-fade-in">
            {/* File uploader placeholder */}
            <div className="form-item-group">
              <label>Logotipo da Marca d'Água</label>
              <div className="file-uploader-box">
                <UploadCloud size={32} className="upload-icon" />
                <span>Arraste seu arquivo de imagem (PNG ou JPG) aqui ou clique para selecionar</span>
                <span className="file-helper">Recomendado: Imagem PNG com fundo transparente (Max 2MB)</span>
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-item-group">
                <label>Posição da Marca</label>
                <select
                  value={config.posicao}
                  onChange={(e) => handlePosChange(e.target.value as any)}
                  disabled={isSaving}
                >
                  <option value="centro">Centralizado (Fundo do Documento)</option>
                  <option value="topo-esquerda">Cabeçalho - Superior Esquerdo</option>
                  <option value="topo-direita">Cabeçalho - Superior Direito</option>
                  <option value="rodape-direita">Rodapé - Inferior Direito</option>
                </select>
              </div>

              <div className="form-item-group">
                <label>Opacidade ({config.opacidade}%)</label>
                <div className="opacity-slider-wrapper">
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={config.opacidade}
                    onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                    disabled={isSaving}
                    className="opacity-slider"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions-row">
          <button type="submit" className="btn-save-settings" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Ocorrência'}
          </button>
        </div>
      </form>
    </div>
  );
};
