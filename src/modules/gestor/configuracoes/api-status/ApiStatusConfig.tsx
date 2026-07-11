import React from 'react';
import { useApiStatus } from './hooks/useApiStatus';

export const ApiStatusConfig: React.FC = () => {
  const { endpoints, isLoading } = useApiStatus();

  if (isLoading) {
    return <div className="sub-loading">Carregando status dos serviços...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header">
        <h2>Status das APIs</h2>
        <p>Monitore a latência, disponibilidade e integridade das conexões e servidores integrados.</p>
      </div>

      <div className="api-status-grid">
        {endpoints.map((ep) => (
          <div className="api-status-card" key={ep.id}>
            <div className="api-info-row">
              <span className="api-name">{ep.nome}</span>
              <span
                className={`api-status-badge ${
                  ep.status === 'Online'
                    ? 'status-online'
                    : ep.status === 'Lento'
                    ? 'status-slow'
                    : 'status-offline'
                }`}
              >
                {ep.status}
              </span>
            </div>
            <div className="api-metrics-row">
              <div className="metric-box">
                <span className="metric-label">Latência</span>
                <span className="metric-value">{ep.latency} ms</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Uptime Global</span>
                <span className="metric-value">{ep.uptime}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
