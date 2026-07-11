import React from 'react';
import type { HelpModule } from '../constants/helpData';

interface HelpModuleCardProps {
  module: HelpModule;
}

export const HelpModuleCard: React.FC<HelpModuleCardProps> = ({ module }) => {
  return (
    <article className="help-module-card">
      <header className="help-module-header">
        <h3>
          <span className="help-module-icon">{module.icone}</span>
          {module.titulo}
        </h3>
        <p>{module.descricao}</p>
      </header>
      <p><strong>Objetivo:</strong> {module.objetivo}</p>
      <p><strong>Como funciona:</strong> {module.comoUsa}</p>

      {module.submodulos?.length ? (
        <div className="help-submodule-list">
          <strong>Submódulos</strong>
          <ul>
            {module.submodulos.map((submodulo) => (
              <li key={submodulo.nome}>
                <span>{submodulo.nome}</span>
                <span>{submodulo.descricao}</span>
                <span><strong>Uso:</strong> {submodulo.comoUsar}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
};
