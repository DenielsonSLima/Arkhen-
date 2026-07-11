import React, { useState } from 'react';
import { useMarcaDagua } from './hooks/useMarcaDagua';
import { UploadCloud, Settings } from 'lucide-react';

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
    handleSizeChange,
    handleUploadLandscape,
    handleUploadPortrait,
    handleSave,
  } = useMarcaDagua();

  const [activeModeTab, setActiveModeTab] = useState<'landscape' | 'portrait'>('landscape');

  if (isLoading || !config) {
    return <div className="sub-loading">Carregando marca d'água...</div>;
  }

  const renderPreviewMockup = () => {
    const isLandscape = activeModeTab === 'landscape';
    const watermarkUrl = isLandscape ? config.fileUrlPaisagem : config.fileUrlRetrato;
    const sizeVal = config.tamanho ?? 35;
    
    // Position style mapping
    let positionStyle: React.CSSProperties = {};
    if (config.posicao === 'centro') {
      positionStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: `${sizeVal}%`,
        maxHeight: `${sizeVal}%`,
      };
    } else if (config.posicao === 'topo-esquerda') {
      positionStyle = {
        top: '12px',
        left: '12px',
        maxWidth: `${sizeVal * 0.6}%`,
        maxHeight: `${sizeVal * 0.6}%`,
      };
    } else if (config.posicao === 'topo-direita') {
      positionStyle = {
        top: '12px',
        right: '12px',
        maxWidth: `${sizeVal * 0.6}%`,
        maxHeight: `${sizeVal * 0.6}%`,
      };
    } else if (config.posicao === 'rodape-direita') {
      positionStyle = {
        bottom: '12px',
        right: '12px',
        maxWidth: `${sizeVal * 0.6}%`,
        maxHeight: `${sizeVal * 0.6}%`,
      };
    }

    return (
      <div 
        style={{
          width: '100%',
          maxWidth: isLandscape ? '520px' : '360px',
          aspectRatio: isLandscape ? '297 / 210' : '210 / 297',
          backgroundColor: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          userSelect: 'none',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Mockup Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.62rem', color: '#64748b' }}>
          <div>
            <strong style={{ color: '#1e293b' }}>SUPORTE AGRICOLA LTDA</strong>
            <div style={{ fontSize: '0.52rem' }}>CNPJ: 26.312.733/0001-55</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Relatório Contábil Anual</strong>
            <div style={{ fontSize: '0.52rem' }}>Página 1 de 1</div>
          </div>
        </div>

        {/* Mockup Body Content */}
        <div style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ width: '45%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}></div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
            {/* Table Header */}
            <div style={{ display: 'flex', backgroundColor: '#f8fafc', padding: '4px 6px', borderBottom: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
              <div style={{ width: '30%', height: '5px', backgroundColor: '#cbd5e1', borderRadius: '2px' }}></div>
              <div style={{ width: '20%', height: '5px', backgroundColor: '#cbd5e1', borderRadius: '2px' }}></div>
              <div style={{ width: '15%', height: '5px', backgroundColor: '#cbd5e1', borderRadius: '2px' }}></div>
            </div>
            {/* Table Rows */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', padding: '5px 6px', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none', justifyContent: 'space-between' }}>
                <div style={{ width: '45%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }}></div>
                <div style={{ width: '15%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }}></div>
                <div style={{ width: '20%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '0.52rem', color: '#94a3b8' }}>
          <span>Gerado em: 11/07/2026</span>
          <span>Arkhen Gestão Contábil</span>
        </div>

        {/* Real Watermark Image Overlay */}
        {watermarkUrl ? (
          <img 
            src={watermarkUrl} 
            alt="Watermark Preview" 
            style={{
              position: 'absolute',
              opacity: config.opacidade / 100,
              pointerEvents: 'none',
              objectFit: 'contain',
              mixBlendMode: 'multiply',
              transition: 'opacity 0.15s ease, all 0.2s ease',
              ...positionStyle
            }}
          />
        ) : (
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#94a3b8',
              fontSize: '0.66rem',
              fontWeight: 600,
              border: '1.5px dashed #cbd5e1',
              padding: '6px 14px',
              borderRadius: '4px',
              pointerEvents: 'none'
            }}
          >
            Sem Marca d'Água Carregada
          </div>
        )}
      </div>
    );
  };

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
          <div className="watermark-details-panel animate-fade-in" style={{ marginTop: '20px' }}>
            {/* Modo Tabs Navigation */}
            <div className="watermark-tabs-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #eef1f5', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveModeTab('landscape')}
                style={{
                  padding: '8px 18px',
                  background: activeModeTab === 'landscape' ? '#fffdf7' : 'transparent',
                  border: activeModeTab === 'landscape' ? '1.5px solid rgba(197, 146, 53, 0.4)' : '1.5px solid transparent',
                  borderBottom: activeModeTab === 'landscape' ? '3px solid #c59235' : '1.5px solid transparent',
                  color: activeModeTab === 'landscape' ? '#c59235' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Modo Paisagem (Horizontal)
              </button>
              <button
                type="button"
                onClick={() => setActiveModeTab('portrait')}
                style={{
                  padding: '8px 18px',
                  background: activeModeTab === 'portrait' ? '#fffdf7' : 'transparent',
                  border: activeModeTab === 'portrait' ? '1.5px solid rgba(197, 146, 53, 0.4)' : '1.5px solid transparent',
                  borderBottom: activeModeTab === 'portrait' ? '3px solid #c59235' : '1.5px solid transparent',
                  color: activeModeTab === 'portrait' ? '#c59235' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Modo Retrato (Vertical)
              </button>
            </div>

            {/* Split Grid: Controls Left / Preview Right */}
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              {/* Controls Column */}
              <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Active Mode Uploader */}
                {activeModeTab === 'landscape' ? (
                  <div className="form-item-group">
                    <label style={{ fontWeight: 600 }}>Logotipo Paisagem (Horizontal)</label>
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
                          <span>{isUploadingLand ? 'Enviando...' : 'Selecionar imagem Paisagem'}</span>
                          <span className="file-helper">PNG recomendada com fundo transparente</span>
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="form-item-group">
                    <label style={{ fontWeight: 600 }}>Logotipo Retrato (Vertical)</label>
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
                          <span>{isUploadingPort ? 'Enviando...' : 'Selecionar imagem Retrato'}</span>
                          <span className="file-helper">PNG recomendada com fundo transparente</span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* 3-Column Settings Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-item-group">
                    <label style={{ fontWeight: 600 }}>Posição da Marca</label>
                    <select
                      value={config.posicao}
                      onChange={(e) => handlePosChange(e.target.value as any)}
                      disabled={isSaving}
                    >
                      <option value="centro">Centralizado (Fundo)</option>
                      <option value="topo-esquerda">Topo Esquerda</option>
                      <option value="topo-direita">Topo Direita</option>
                      <option value="rodape-direita">Rodapé Direita</option>
                    </select>
                  </div>

                  <div className="form-item-group">
                    <label style={{ fontWeight: 600 }}>Opacidade ({config.opacidade}%)</label>
                    <div className="opacity-slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.opacidade}
                        onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                        disabled={isSaving}
                        className="opacity-slider"
                      />
                    </div>
                  </div>

                  <div className="form-item-group">
                    <label style={{ fontWeight: 600 }}>Tamanho ({config.tamanho ?? 35}%)</label>
                    <div className="opacity-slider-wrapper">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={config.tamanho ?? 35}
                        onChange={(e) => handleSizeChange(parseInt(e.target.value))}
                        disabled={isSaving}
                        className="opacity-slider"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Preview Column */}
              <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fafbfc', border: '1.5px solid #eef1f5', borderRadius: '8px', padding: '24px 20px', minHeight: '340px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={14} /> Preview Real do Relatório Contábil
                </span>
                {renderPreviewMockup()}
              </div>
            </div>

          </div>
        )}

        <div className="form-actions-row" style={{ marginTop: '24px' }}>
          <button type="submit" className="btn-save-settings" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Ocorrência'}
          </button>
        </div>
      </form>
    </div>
  );
};
