import React from 'react';
import { useMarcaDagua } from './hooks/useMarcaDagua';
import { UploadCloud } from 'lucide-react';

export const MarcaDaguaConfig: React.FC = () => {
  const {
    config,
    isLoading,
    isSaving,
    isUploadingLand,
    isUploadingPort,
    successMsg,
    errorMsg,
    handleToggle,
    handlePosChange,
    handleOpacityChange,
    handleUploadLandscape,
    handleUploadPortrait,
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
            {/* Landscape and Portrait Watermark Uploaders */}
            <div className="form-row-grid" style={{ marginBottom: '24px' }}>
              <div className="form-item-group">
                <label>Marca d'Água (Paisagem) - Relatórios Horizontais</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadLandscape(file);
                  }}
                  style={{ display: 'none' }}
                  id="watermark-landscape-file"
                  disabled={isSaving}
                />
                <label htmlFor="watermark-landscape-file" className="file-uploader-box" style={{ cursor: isSaving ? 'not-allowed' : 'pointer', minHeight: '130px' }}>
                  {config.fileUrlPaisagem ? (
                    <div className="watermark-preview-container" style={{ textAlign: 'center' }}>
                      <img src={config.fileUrlPaisagem} alt="Marca d'Água Paisagem" style={{ maxHeight: '90px', objectFit: 'contain', margin: '0 auto 8px' }} />
                      <span className="file-helper">Clique para alterar a imagem</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={28} className="upload-icon" />
                      <span>{isUploadingLand ? 'Enviando...' : 'Clique para selecionar a imagem Paisagem'}</span>
                      <span className="file-helper">PNG com fundo transparente</span>
                    </>
                  )}
                </label>
              </div>

              <div className="form-item-group">
                <label>Marca d'Água (Retrato) - Relatórios Verticais</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadPortrait(file);
                  }}
                  style={{ display: 'none' }}
                  id="watermark-portrait-file"
                  disabled={isSaving}
                />
                <label htmlFor="watermark-portrait-file" className="file-uploader-box" style={{ cursor: isSaving ? 'not-allowed' : 'pointer', minHeight: '130px' }}>
                  {config.fileUrlRetrato ? (
                    <div className="watermark-preview-container" style={{ textAlign: 'center' }}>
                      <img src={config.fileUrlRetrato} alt="Marca d'Água Retrato" style={{ maxHeight: '90px', objectFit: 'contain', margin: '0 auto 8px' }} />
                      <span className="file-helper">Clique para alterar a imagem</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={28} className="upload-icon" />
                      <span>{isUploadingPort ? 'Enviando...' : 'Clique para selecionar a imagem Retrato'}</span>
                      <span className="file-helper">PNG com fundo transparente</span>
                    </>
                  )}
                </label>
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
