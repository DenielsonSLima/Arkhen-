import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { FiscalConfigController } from '../hooks/useFiscalConfigController';
import { FiscalAmbiente } from './FiscalAmbiente';
import { FiscalCertificado } from './FiscalCertificado';
import { FiscalHistory } from './FiscalHistory';
import { FiscalResumo } from './FiscalResumo';
import { FiscalRps } from './FiscalRps';
import { FiscalLocationForm } from './cadastro/FiscalLocationForm';
import { FiscalConnectionPlaceholder } from './conexao/FiscalConnectionPlaceholder';
import { FiscalLocationDirectory } from './location/FiscalLocationDirectory';

const getCertBadge = (days: number) => {
  if (days <= 0) {
    return <span className="table-badge badge-orange">Expirado</span>;
  }
  if (days < 30) {
    return <span className="table-badge badge-orange">Expira em breve ({days} dias)</span>;
  }
  return <span className="table-badge badge-green">Válido ({days} dias)</span>;
};

export const FiscalConfigContent: React.FC<{ controller: FiscalConfigController }> = ({
  controller,
}) => {
  const {
    activeTab,
    setActiveTab,
    config,
    setConfig,
    stats,
    history,
    testingConnection,
    connectionResult,
    testingCert,
    certResult,
    syncing,
    syncResult,
    saving,
    saveSuccess,
    showCertModal,
    setShowCertModal,
    dragActive,
    filterPeriodoInicio,
    setFilterPeriodoInicio,
    filterPeriodoFim,
    setFilterPeriodoFim,
    filterStatus,
    setFilterStatus,
    filterNotaNum,
    setFilterNotaNum,
    filterOperacao,
    setFilterOperacao,
    searchQuery,
    setSearchQuery,
    companies,
    activeContext,
    selectedCompanyId,
    selectedUf,
    selectedMunicipio,
    isLoadingSelection,
    loadError,
    locationTree,
    selectedPrefeituraProfile,
    activePrefeituraProfile,
    availableUfs,
    availableMunicipios,
    filteredHistory,
    openContext,
    handleSelectCompany,
    handleSelectUf,
    handleSelectMunicipio,
    handleTestConnection,
    handleTestCert,
    handleSaveConfig,
    handleSyncData,
    handleQueryLastNfse,
    handleQueryNextNum,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleOpenDraftContext,
    handleToggleContextStatus,
  } = controller;

  const ambienteLabel = config.ambiente === 'producao' ? 'Produção' : 'Homologação';
  const ambienteConfig = activePrefeituraProfile?.ambientes?.[config.ambiente];

  return (
    <div className="submodule-content-card animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Integração Fiscal (NFS-e)</h2>
          <p>
            Defina aqui o contexto de emissão da NFS-e: empresa emitente (contabilidade) + município.
          </p>
        </div>
        {(activeTab === 'ambiente' || activeTab === 'certificado' || activeTab === 'rps') && (
          <button
            onClick={() => handleSaveConfig()}
            disabled={saving}
            className="btn-save-settings"
          >
            {saving ? 'Gravando...' : 'Salvar Configurações'}
          </button>
        )}
      </div>

      <div className="fiscal-context-status-row">
        <span className={`table-badge ${activeContext?.isActive ? 'badge-green' : 'badge-orange'}`}>
          {activeContext?.isActive ? 'Integração Ativa' : 'Integração Inativa'}
        </span>
        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
          {activeContext
            ? `${activeContext.companyName} • ${activeContext.uf}/${activeContext.municipio}`
            : 'Selecione um contexto de emissão'}
        </div>
        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
          {activePrefeituraProfile
            ? `Provedor: ${activePrefeituraProfile.providerLabel} • ${ambienteLabel} URL: ${ambienteConfig?.url || 'Não informado'}`
            : 'Município sem perfil pré-cadastrado.'}
        </div>
        {activeContext && (
          <button
            type="button"
            onClick={handleToggleContextStatus}
            className="btn-add-user"
            style={{ padding: '7px 12px', fontSize: '0.76rem' }}
          >
            <RefreshCw size={12} />
            {activeContext.isActive ? 'Desativar integração' : 'Ativar integração'}
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="success-banner animate-fade-in">
          Configurações gravadas para o contexto selecionado.
        </div>
      )}

      {syncResult && (
        <div className="success-banner animate-fade-in" style={{ backgroundColor: 'rgba(197, 146, 53, 0.08)', borderColor: 'var(--color-gold-primary)', color: 'var(--color-gold-dark)' }}>
          {syncResult}
        </div>
      )}

      {loadError && (
        <div className="error-banner animate-fade-in">
          {loadError}
        </div>
      )}

      <div className="fiscal-tabs-nav">
        <button onClick={() => setActiveTab('resumo')} className={`fiscal-tab-btn ${activeTab === 'resumo' ? 'active' : ''}`}>
          Resumo Geral
        </button>
        <button onClick={() => setActiveTab('ambiente')} className={`fiscal-tab-btn ${activeTab === 'ambiente' ? 'active' : ''}`}>
          Ambiente & Provedor
        </button>
        <button onClick={() => setActiveTab('certificado')} className={`fiscal-tab-btn ${activeTab === 'certificado' ? 'active' : ''}`}>
          Certificado Digital A1
        </button>
        <button onClick={() => setActiveTab('rps')} className={`fiscal-tab-btn ${activeTab === 'rps' ? 'active' : ''}`}>
          Configurações do RPS
        </button>
        <button onClick={() => setActiveTab('historico')} className={`fiscal-tab-btn ${activeTab === 'historico' ? 'active' : ''}`}>
          Histórico de Operações
        </button>
        <button onClick={() => setActiveTab('contexto')} className={`fiscal-tab-btn ${activeTab === 'contexto' ? 'active' : ''}`}>
          Contexto de Emissão
        </button>
      </div>

      <div className="tab-content animate-fade-in">
        {activeTab === 'contexto' && (
          <div className="fiscal-integration-layout">
            <div className="fiscal-integration-sidebar">
              <FiscalLocationDirectory
                activeContextKey={activeContext?.key || ''}
                groups={locationTree}
                onSelectContext={openContext}
              />
            </div>

            <div className="fiscal-integration-main">
              <div className="fiscal-location-form-wrapper">
                <div className="form-divider-title">Contexto de Emissão</div>
                <FiscalLocationForm
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  selectedUf={selectedUf}
                  selectedMunicipio={selectedMunicipio}
                  availableUfs={availableUfs}
                  availableMunicipios={availableMunicipios}
                  selectedProfile={selectedPrefeituraProfile}
                  loading={isLoadingSelection}
                  onSelectCompany={handleSelectCompany}
                  onSelectUf={handleSelectUf}
                  onSelectMunicipio={handleSelectMunicipio}
                  onOpenIntegration={handleOpenDraftContext}
                />
              </div>

              <FiscalConnectionPlaceholder />
            </div>
          </div>
        )}

        {activeTab === 'resumo' && (
          <FiscalResumo
            config={config}
            stats={stats}
            history={history}
            syncing={syncing}
            testingConnection={testingConnection}
            testingCert={testingCert}
            connectionResult={connectionResult}
            certResult={certResult}
            onTestConnection={handleTestConnection}
            onTestCert={handleTestCert}
            onSyncData={handleSyncData}
            onQueryLastNfse={handleQueryLastNfse}
            onQueryNextNum={handleQueryNextNum}
            onSwitchTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'ambiente' && (
          <FiscalAmbiente
            config={config}
            setConfig={setConfig}
            prefeituraProfile={activePrefeituraProfile}
            testingConnection={testingConnection}
            connectionResult={connectionResult}
            onTestConnection={handleTestConnection}
          />
        )}

        {activeTab === 'certificado' && (
          <FiscalCertificado
            config={config}
            setConfig={setConfig}
            dragActive={dragActive}
            testingCert={testingCert}
            certResult={certResult}
            showCertModal={showCertModal}
            setShowCertModal={setShowCertModal}
            onTestCert={handleTestCert}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
            getCertBadge={getCertBadge}
          />
        )}

        {activeTab === 'rps' && (
          <FiscalRps
            config={config}
            setConfig={setConfig}
            saving={saving}
            onSaveConfig={handleSaveConfig}
          />
        )}

        {activeTab === 'historico' && (
          <FiscalHistory
            filteredHistory={filteredHistory}
            filterPeriodoInicio={filterPeriodoInicio}
            setFilterPeriodoInicio={setFilterPeriodoInicio}
            filterPeriodoFim={filterPeriodoFim}
            setFilterPeriodoFim={setFilterPeriodoFim}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterOperacao={filterOperacao}
            setFilterOperacao={setFilterOperacao}
            filterNotaNum={filterNotaNum}
            setFilterNotaNum={setFilterNotaNum}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
      </div>
    </div>
  );
};
