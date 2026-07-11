import React from 'react';
import { Play, RefreshCw } from 'lucide-react';
import type { FiscalConfigData, FiscalPrefeituraProfile } from '../services/fiscalIntegrationService';
import { fiscalIntegrationService } from '../services/fiscalIntegrationService';

interface FiscalAmbienteProps {
  config: FiscalConfigData;
  setConfig: React.Dispatch<React.SetStateAction<FiscalConfigData>>;
  testingConnection: boolean;
  connectionResult: { success: boolean; message: string } | null;
  onTestConnection: () => void;
  prefeituraProfile?: FiscalPrefeituraProfile | null;
}

export const FiscalAmbiente: React.FC<FiscalAmbienteProps> = ({
  config,
  setConfig,
  testingConnection,
  connectionResult,
  onTestConnection,
  prefeituraProfile,
}) => {
  const ambienteUrl = prefeituraProfile
    ? (config.ambiente === 'homologacao'
      ? prefeituraProfile.ambientes?.homologacao?.url
      : prefeituraProfile.ambientes?.producao?.url)
    : '';

  return (
    <div className="config-form">
      
      {/* 1. Ambiente & Provedor Setup */}
      <div className="form-divider-title">Ambiente & Provedor</div>
      
      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Ambiente de Emissão</label>
          <select
            value={config.ambiente}
            onChange={(e) => setConfig(prev => ({ ...prev, ambiente: e.target.value as 'homologacao' | 'producao' }))}
          >
            <option value="homologacao">Homologação (Testes sem valor fiscal)</option>
            <option value="producao">Produção (Notas reais com valor fiscal)</option>
          </select>
          <p className="input-helper-text">
            {config.ambiente === 'homologacao' 
              ? 'As notas emitidas em Homologação possuem apenas finalidade de testes e não recolhem impostos.' 
              : 'ATENÇÃO: As notas emitidas em Produção possuem validade fiscal real perante a Receita Federal.'}
          </p>
          {prefeituraProfile && (
            <p className="input-helper-text" style={{ marginTop: '6px' }}>
              Ambiente definido pelo contexto selecionado: <strong>{config.ambiente === 'homologacao' ? 'Homologação' : 'Produção'}</strong> • URL:
              <code style={{ marginLeft: '4px', fontSize: '0.76rem' }}>{ambienteUrl || 'Não informado'}</code>
            </p>
          )}
        </div>

        <div className="form-item-group">
          <label>Provedor da NFS-e (WebService)</label>
          <select
            value={config.provedor}
            onChange={(e) => setConfig(prev => ({ ...prev, provedor: e.target.value }))}
          >
            {fiscalIntegrationService.getProviders().map(prov => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>
          <p className="input-helper-text">
              {prefeituraProfile ? (
              `Provedor sugerido para esse município: ${prefeituraProfile.providerLabel}`
            ) : (
              'A arquitetura de adapters suporta múltiplos municípios simultaneamente.'
            )}
          </p>
        </div>
      </div>

      {/* 2. Credenciais de Conexão */}
      <div className="form-divider-title">Credenciais do WebService</div>
      
      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Usuário de Integração</label>
          <input
            type="text"
            value={config.usuarioWebService}
            onChange={(e) => setConfig(prev => ({ ...prev, usuarioWebService: e.target.value }))}
            placeholder="Digite o login, usuário ou CNPJ cadastrado"
          />
        </div>

        <div className="form-item-group">
            <label>Senha do WebService</label>
          <input
            type="password"
            value={config.senhaWebService}
            onChange={(e) => setConfig(prev => ({ ...prev, senhaWebService: e.target.value }))}
            placeholder="Digite a senha ou chave de acesso do provedor"
          />
        </div>
      </div>

      {/* Diagnostic Connection Section */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #f4f6f9', paddingTop: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testingConnection}
            className="btn-save-settings"
            style={{ 
              background: 'none', 
              border: '1px solid #e0e0e0', 
              color: 'var(--color-text-dark)', 
              boxShadow: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {testingConnection ? (
              <RefreshCw size={14} className="animate-spin text-amber-600" />
            ) : (
              <Play size={14} className="text-amber-600" />
            )}
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Testar Conectividade</span>
          </button>

          {connectionResult && (
            <div className={connectionResult.success ? 'success-banner' : 'error-banner'} style={{ margin: 0, padding: '8px 16px', flex: 1, textAlign: 'right' }}>
              <strong>Resultado:</strong> {connectionResult.message}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
