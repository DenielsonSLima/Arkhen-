import React from 'react';
import { Play, Key, FileText, Sparkles, RefreshCw } from 'lucide-react';
import type { FiscalConfigData, NfsStats, NfsHistoryItem } from '../services/fiscalIntegrationService';

interface FiscalResumoProps {
  config: FiscalConfigData;
  stats: NfsStats;
  history: NfsHistoryItem[];
  syncing: boolean;
  testingConnection: boolean;
  testingCert: boolean;
  connectionResult: { success: boolean; message: string } | null;
  certResult: { success: boolean; message: string } | null;
  onTestConnection: () => void;
  onTestCert: () => void;
  onSyncData: () => void;
  onQueryLastNfse: () => void;
  onQueryNextNum: () => void;
  onSwitchTab: (tab: 'resumo' | 'ambiente' | 'certificado' | 'rps' | 'historico') => void;
}

export const FiscalResumo: React.FC<FiscalResumoProps> = ({
  config,
  stats,
  history,
  syncing,
  testingConnection,
  testingCert,
  connectionResult,
  certResult,
  onTestConnection,
  onTestCert,
  onSyncData,
  onQueryLastNfse,
  onQueryNextNum,
  onSwitchTab,
}) => {
  const certificadoDiasRestantes = config.certificadoDiasRestantes ?? 0;

  // Get recent 3 logs
  const recentLogs = history.slice(0, 3);

  const getDaysRemainingLabel = (days: number) => {
    if (days <= 0) return 'Expirado';
    return `${days} dias restantes`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Overview Grid – Status and Certificate info */}
      <div className="bancaria-summary-grid">
        <div className="bancaria-summary-card gold-border">
          <span className="summary-label">Status da Integração</span>
          <span className="summary-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', marginTop: '4px' }}>
            <span className={`status-dot ${certificadoDiasRestantes > 0 ? 'active' : 'inactive'}`}></span>
            {certificadoDiasRestantes > 0 ? 'Ativo / Em Produção' : 'Atenção / Inativo'}
          </span>
        </div>

        <div className="bancaria-summary-card">
          <span className="summary-label">Certificado Digital A1</span>
          <span className="summary-value" style={{ fontSize: '1.15rem', marginTop: '4px' }}>
            {config.certificadoNome ? (
              <span className={certificadoDiasRestantes < 30 ? 'danger-text font-bold' : 'gold-text'}>
                {getDaysRemainingLabel(certificadoDiasRestantes)}
              </span>
            ) : (
              'Não Configurado'
            )}
          </span>
        </div>

        <div className="bancaria-summary-card">
          <span className="summary-label">Provedor Municipal</span>
          <span className="summary-value" style={{ fontSize: '1.15rem', marginTop: '4px' }}>
            {config.provedor || 'Não Definido'}
          </span>
        </div>
      </div>

      {/* Integration Statistics Cards */}
      <div>
        <div className="table-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>Estatísticas de Emissão (NFS-e)</h3>
          <span className="input-helper-text" style={{ fontSize: '0.78rem', margin: 0 }}>
            Atualizado automaticamente pelo conector da prefeitura.
          </span>
        </div>

        <div className="fiscal-stats-grid">
          <div className="fiscal-stats-card">
            <span className="stat-value">{stats.emitidas}</span>
            <span className="stat-label">Emitidas</span>
          </div>
          <div className="fiscal-stats-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <span className="stat-value" style={{ color: '#ef4444' }}>{stats.canceladas}</span>
            <span className="stat-label">Canceladas</span>
          </div>
          <div className="fiscal-stats-card" style={{ borderLeft: '3px solid var(--color-gold-primary)' }}>
            <span className="stat-value" style={{ color: 'var(--color-gold-dark)' }}>{stats.rejeitadas}</span>
            <span className="stat-label">Rejeitadas</span>
          </div>
          <div className="fiscal-stats-card">
            <span className="stat-value" style={{ color: '#555555' }}>{stats.pendentes}</span>
            <span className="stat-label">Pendentes</span>
          </div>
        </div>
      </div>

      {/* Diagnostic Actions Panel */}
      <div className="fiscal-actions-card">
        <h3>Diagnósticos e Ações Rápidas</h3>
        <p className="input-helper-text" style={{ marginBottom: '12px' }}>Use as ferramentas de teste para validar conexão e homologação fiscal com o município selecionado.</p>
        
        <div className="fiscal-actions-grid">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testingConnection}
            className="btn-secondary-action"
          >
            <Play size={15} />
            <span>Testar Webservice</span>
          </button>

          <button
            type="button"
            onClick={onTestCert}
            disabled={testingCert}
            className="btn-secondary-action"
          >
            <Key size={15} />
            <span>Testar Assinatura A1</span>
          </button>

          <button
            type="button"
            onClick={onSyncData}
            disabled={syncing}
            className="btn-secondary-action"
          >
            <RefreshCw size={15} />
            <span>Sincronizar Lotes</span>
          </button>

          <button
            type="button"
            onClick={onQueryLastNfse}
            disabled={syncing}
            className="btn-secondary-action"
          >
            <FileText size={15} />
            <span>Consultar Última NFS-e</span>
          </button>

          <button
            type="button"
            onClick={onQueryNextNum}
            disabled={syncing}
            className="btn-secondary-action"
          >
            <Sparkles size={15} />
            <span>Consultar Próxima Numeração</span>
          </button>
        </div>

        {/* Action Results */}
        {(connectionResult || certResult) && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connectionResult && (
              <div className={connectionResult.success ? 'success-banner' : 'error-banner'} style={{ margin: 0, padding: '10px 14px' }}>
                <strong>Conexão:</strong> {connectionResult.message}
              </div>
            )}
            {certResult && (
              <div className="success-banner" style={{ margin: 0, padding: '10px 14px' }}>
                <strong>Certificado:</strong> {certResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Integration History Logs */}
      <div>
        <div className="table-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Atividades Recentes</h3>
          <button 
            className="btn-back-to-grid" 
            onClick={() => onSwitchTab('historico')}
            style={{ margin: 0 }}
          >
            Ver histórico completo &rarr;
          </button>
        </div>

        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th>Operação</th>
                <th>Mensagem / Detalhe</th>
                <th>Protocolo</th>
                <th>Usuário</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-dark-muted)' }}>
                    Nenhuma operação registrada recentemente.
                  </td>
                </tr>
              ) : (
                recentLogs.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.operacao}</strong></td>
                    <td>{item.mensagemPrefeitura}</td>
                    <td><span className="ip-code">{item.protocolo}</span></td>
                    <td>{item.usuario}</td>
                    <td>
                      <span className={`table-badge ${item.status === 'Sucesso' ? 'badge-green' : 'badge-orange'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
