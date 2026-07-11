import React from 'react';
import { bytesToGb, formatBytes } from '../services/planosContratacaoService';
import type { FileTypeGroup } from '../utils/storagePresentation';

interface StorageAnalyticsProps {
  groups: FileTypeGroup[];
  totalBytes: number;
  limitBytes: number;
  usedPercent: number;
  fileCount: number;
  donut: {
    radius: number;
    slices: Array<FileTypeGroup & { dash: number; gap: number; offset: number; pct: number }>;
  };
}

export const StorageAnalytics: React.FC<StorageAnalyticsProps> = ({
  groups,
  totalBytes,
  limitBytes,
  usedPercent,
  fileCount,
  donut,
}) => (
  <div className="arm-analytics-row">
    <div className="arm-donut-card">
      <h2 className="arm-section-title">Por Tipo de Arquivo</h2>
      {groups.length === 0 ? (
        <div className="arm-empty-state">Nenhum arquivo enviado ainda.</div>
      ) : (
        <>
          <div className="arm-donut-center">
            <svg width="168" height="168" viewBox="0 0 168 168">
              <circle cx="84" cy="84" r={donut.radius} fill="none" stroke="#f1f5f9" strokeWidth="22" />
              {donut.slices.map((slice) => (
                <circle
                  key={slice.label}
                  cx="84"
                  cy="84"
                  r={donut.radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="22"
                  strokeDasharray={`${slice.dash} ${slice.gap}`}
                  strokeDashoffset={slice.offset}
                  transform="rotate(-90 84 84)"
                />
              ))}
              <text x="84" y="78" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">
                {usedPercent.toFixed(0)}%
              </text>
              <text x="84" y="96" textAnchor="middle" fontSize="10" fill="#94a3b8">utilizado</text>
            </svg>
          </div>
          <div className="arm-donut-legend">
            {groups.map((group) => (
              <div key={group.label} className="arm-legend-row">
                <span className="arm-legend-dot" style={{ backgroundColor: group.color }} />
                <span className="arm-legend-name">{group.label}</span>
                <span className="arm-legend-pct">{totalBytes > 0 ? ((group.totalBytes / totalBytes) * 100).toFixed(1) : '0'}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>

    <div className="arm-table-card">
      <h2 className="arm-section-title">Detalhe por Tipo</h2>
      <div className="arm-table-scroll">
        <table className="arm-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Arquivos</th>
              <th>Tamanho</th>
              <th>% do plano</th>
              <th>Uso</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum arquivo enviado para esta empresa.</td>
              </tr>
            ) : groups.map((group) => {
              const pct = limitBytes > 0 ? (group.totalBytes / limitBytes) * 100 : 0;
              return (
                <tr key={group.label}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: group.color }}>{group.icon}</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{group.label}</span>
                    </div>
                  </td>
                  <td>{group.count}</td>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>{formatBytes(group.totalBytes)}</td>
                  <td>{pct.toFixed(2)}%</td>
                  <td>
                    <div className="arm-table-bar-track">
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: group.color, borderRadius: '4px' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{fileCount}</td>
              <td>{formatBytes(totalBytes)}</td>
              <td>{bytesToGb(totalBytes).toFixed(3)} GB</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
);
