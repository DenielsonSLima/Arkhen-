import React from 'react';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { useBancaria } from './hooks/useBancaria';

export const BancariaConfig: React.FC = () => {
  const {
    asaasConfig,
    isLoadingAsaas,
    isSavingAsaas,
    successMsgAsaas,
    handleAsaasInputChange,
    handleAsaasSave,
  } = useBancaria();

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Integração Bancária</h2>
          <p>Configure gateways financeiros, chaves de API, ambiente de integração e webhooks.</p>
        </div>
        <CreditCard size={28} className="gold-text" />
      </div>

      {isLoadingAsaas || !asaasConfig ? (
        <div className="sub-loading">Carregando chaves Asaas...</div>
      ) : (
        <form onSubmit={handleAsaasSave} className="config-form">
          {successMsgAsaas && (
            <div className="success-banner">
              <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
              {successMsgAsaas}
            </div>
          )}

          <div className="form-item-group">
            <label>Chave de API (API Key)</label>
            <input
              type="password"
              value={asaasConfig.apiKey}
              onChange={(event) => handleAsaasInputChange('apiKey', event.target.value)}
              placeholder="Digite o Token do Asaas"
              disabled={isSavingAsaas}
            />
            <span className="input-helper-text">Token gerado no painel da sua conta Asaas.</span>
          </div>

          <div className="form-item-group">
            <label>Ambiente de Integração</label>
            <select
              value={asaasConfig.ambiente}
              onChange={(event) => handleAsaasInputChange('ambiente', event.target.value)}
              disabled={isSavingAsaas}
            >
              <option value="homologacao">Homologação (Sandbox de Testes)</option>
              <option value="producao">Produção (Valores Reais)</option>
            </select>
          </div>

          <div className="form-divider-title">Meios de Pagamento Aceitos (Asaas)</div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div className="form-checkbox-group" style={{ marginBottom: 0 }}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={asaasConfig.aceitaBoleto}
                  onChange={(event) => handleAsaasInputChange('aceitaBoleto', event.target.checked)}
                  disabled={isSavingAsaas}
                />
                <span className="checkbox-checkmark"></span>
                Boleto Bancário
              </label>
            </div>

            <div className="form-checkbox-group" style={{ marginBottom: 0 }}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={asaasConfig.aceitaPix}
                  onChange={(event) => handleAsaasInputChange('aceitaPix', event.target.checked)}
                  disabled={isSavingAsaas}
                />
                <span className="checkbox-checkmark"></span>
                Pix
              </label>
            </div>

            <div className="form-checkbox-group" style={{ marginBottom: 0 }}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={asaasConfig.aceitaCartao}
                  onChange={(event) => handleAsaasInputChange('aceitaCartao', event.target.checked)}
                  disabled={isSavingAsaas}
                />
                <span className="checkbox-checkmark"></span>
                Cartão de Crédito
              </label>
            </div>
          </div>

          <div className="form-item-group" style={{ maxWidth: '250px', marginBottom: '24px' }}>
            <label>Parcelamento Máximo (Cartão)</label>
            <select
              value={asaasConfig.maxParcelas}
              onChange={(event) => handleAsaasInputChange('maxParcelas', parseInt(event.target.value) || 1)}
              disabled={isSavingAsaas || !asaasConfig.aceitaCartao}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1f1f1f', backgroundColor: '#fff' }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <option key={n} value={n}>Até {n}x sem juros</option>
              ))}
            </select>
          </div>

          <div className="form-divider-title">Webhook de Notificações</div>

          <div className="form-row-grid">
            <div className="form-item-group">
              <label>URL do Webhook</label>
              <input
                type="text"
                value={asaasConfig.webhookUrl}
                onChange={(event) => handleAsaasInputChange('webhookUrl', event.target.value)}
                placeholder="https://sua-api.com/webhooks"
                disabled={isSavingAsaas}
              />
            </div>
            <div className="form-item-group">
              <label>Token de Validação do Webhook</label>
              <input
                type="password"
                value={asaasConfig.webhookToken}
                onChange={(event) => handleAsaasInputChange('webhookToken', event.target.value)}
                placeholder="Token de Assinatura"
                disabled={isSavingAsaas}
              />
            </div>
          </div>

          <div className="form-checkbox-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={asaasConfig.emailNotificacao}
                onChange={(event) => handleAsaasInputChange('emailNotificacao', event.target.checked)}
                disabled={isSavingAsaas}
              />
              <span className="checkbox-checkmark"></span>
              Enviar alertas automáticos de cobrança para o e-mail do cliente
            </label>
          </div>

          <div className="form-actions-row">
            <button type="submit" className="btn-save-settings" disabled={isSavingAsaas}>
              {isSavingAsaas ? 'Salvando...' : 'Salvar Integração'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
