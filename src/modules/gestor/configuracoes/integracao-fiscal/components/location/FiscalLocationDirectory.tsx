import React from 'react';
import type { FiscalLocationGroup, FiscalMunicipalityContext } from '../../services/fiscalIntegrationTypes';

export const FiscalLocationDirectory: React.FC<{
  activeContextKey: string;
  groups: FiscalLocationGroup[];
  onSelectContext: (context: FiscalMunicipalityContext) => void;
}> = ({ activeContextKey, groups, onSelectContext }) => {
  const formatCompanyName = (name: string) => name || 'Empresa de emissão';

  return (
    <div className="fiscal-location-tree">
      <div className="form-divider-title">Locais de emissão por UF/Município</div>

      {groups.length === 0 ? (
        <div className="fiscal-location-tree-empty">
          Nenhum contexto cadastrado ainda. Abra a aba Contexto de Emissão para criar o primeiro registro.
        </div>
      ) : (
        groups.map((group) => {
          const totalContextos = group.municipios.reduce((acc, item) => acc + item.contexts.length, 0);

          return (
            <details key={group.uf} className="fiscal-location-folder" open>
              <summary className="fiscal-location-folder-summary">
                <span>UF {group.uf}</span>
                <span className="fiscal-location-summary-count">
                  {totalContextos} contexto{totalContextos === 1 ? '' : 's'}
                </span>
              </summary>

              <div className="fiscal-location-folder-content">
                {group.municipios.map((municipio) => (
                  <div key={`${group.uf}-${municipio.municipio}`} className="fiscal-location-city-card">
                    <div className="fiscal-location-city-name">{municipio.municipio}</div>

                    <div className="fiscal-location-city-list">
                      {municipio.contexts.map((context) => (
                        <button
                          key={context.key}
                          type="button"
                          onClick={() => onSelectContext(context)}
                          className={`fiscal-location-item ${activeContextKey === context.key ? 'active' : ''}`}
                        >
                          <span className="fiscal-location-item-company">{formatCompanyName(context.companyName)}</span>
                          <span className={`table-badge ${context.isActive ? 'badge-green' : 'badge-orange'}`}>
                            {context.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
};
