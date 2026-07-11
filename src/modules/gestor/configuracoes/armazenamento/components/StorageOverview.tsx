import React from 'react';
import { Building2 } from 'lucide-react';
import { formatBytes, type PlanoContratacao } from '../services/planosContratacaoService';
import { formatCurrency, type FileTypeGroup } from '../utils/storagePresentation';

interface StorageOverviewProps {
  planoAtual: PlanoContratacao;
  totalBytes: number;
  freeBytes: number;
  fileCount: number;
  companyCount: number;
  usedPercent: number;
  companiesPercent: number;
  usageState: { color: string; tone: 'ok' | 'warning' | 'critical' };
  groups: FileTypeGroup[];
  loading: boolean;
}

export const StorageOverview: React.FC<StorageOverviewProps> = ({
  planoAtual,
  totalBytes,
  freeBytes,
  fileCount,
  companyCount,
  usedPercent,
  companiesPercent,
  usageState,
  groups,
  loading,
}) => (
  <>
    <div className="arm-current-plan-card">
      <div>
        <span className="arm-stat-label">Plano atual</span>
        <h2>{planoAtual.nome}</h2>
        <p>{planoAtual.selo}</p>
      </div>
      <div className="arm-current-plan-metrics">
        <span>{planoAtual.armazenamentoGb} GB</span>
        <small>armazenamento</small>
      </div>
      <div className="arm-current-plan-metrics">
        <span>{planoAtual.empresas}</span>
        <small>empresas</small>
      </div>
      <div className="arm-current-plan-price">
        <span>{formatCurrency(planoAtual.precoMensal)}</span>
        <small>{planoAtual.precoMensal === 0 ? 'teste' : '/mês'}</small>
      </div>
    </div>

    <div className="arm-top-row">
      <div className="arm-stat-card">
        <span className="arm-stat-label">Espaço total</span>
        <span className="arm-stat-value">{planoAtual.armazenamentoGb} GB</span>
        <span className="arm-stat-desc">{planoAtual.nome}</span>
      </div>
      <div className={`arm-stat-card ${usageState.tone === 'critical' ? 'critical' : 'used'}`}>
        <span className="arm-stat-label">Em uso</span>
        <span className="arm-stat-value" style={{ color: usageState.tone === 'critical' ? '#ef4444' : undefined }}>
          {loading ? '...' : formatBytes(totalBytes)}
        </span>
        <span className="arm-stat-desc">{fileCount} arquivos - {usedPercent.toFixed(1)}% utilizado</span>
      </div>
      <div className="arm-stat-card free">
        <span className="arm-stat-label">Disponível</span>
        <span className="arm-stat-value">{formatBytes(freeBytes)}</span>
        <span className="arm-stat-desc">{Math.max(100 - usedPercent, 0).toFixed(1)}% livre</span>
      </div>

      <div className="arm-progress-card">
        <div className="arm-progress-labels">
          <span className="arm-progress-title">Uso do Armazenamento</span>
          <span className="arm-progress-val">{formatBytes(totalBytes)} de {planoAtual.armazenamentoGb} GB</span>
        </div>
        <div className="arm-progress-track">
          <div className="arm-progress-fill" style={{ width: `${usedPercent}%`, background: usageState.color }} />
        </div>
        <div className="arm-progress-legend">
          {groups.length === 0 ? (
            <div className="arm-legend-chip">Nenhum arquivo enviado</div>
          ) : groups.map((group) => (
            <div key={group.label} className="arm-legend-chip">
              <span className="arm-legend-chip-dot" style={{ backgroundColor: group.color }} />
              {group.label}
            </div>
          ))}
        </div>
      </div>

      <div className="arm-progress-card">
        <div className="arm-progress-labels">
          <span className="arm-progress-title">Empresas cadastradas</span>
          <span className="arm-progress-val">{companyCount} de {planoAtual.empresas}</span>
        </div>
        <div className="arm-progress-track">
          <div className="arm-progress-fill" style={{ width: `${companiesPercent}%`, background: companiesPercent >= 100 ? '#dc2626' : '#16a34a' }} />
        </div>
        <div className="arm-progress-legend">
          <div className="arm-legend-chip">
            <Building2 size={14} /> Limite isolado desta empresa
          </div>
        </div>
      </div>
    </div>
  </>
);
