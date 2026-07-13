import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Evento } from '../services/agenda.service';

interface PrazosAutomaticosProps {
  compacto?: boolean;
  prazos: Evento[];
  titulo?: string;
}

export const PrazosAutomaticos: React.FC<PrazosAutomaticosProps> = ({ compacto = false, prazos, titulo = 'Calendário fixo do mês' }) => {
  const conteudo = (
    <div className="agenda-prazos-default-list">
      {prazos.map((prazo) => (
        <div key={prazo.id} className="agenda-prazo-default-item">
          <span>{prazo.data.slice(8, 10)}</span>
          <strong>{prazo.titulo}</strong>
        </div>
      ))}
      {prazos.length === 0 && <div className="sem-eventos">Nenhuma rotina fixa neste mês.</div>}
    </div>
  );

  if (compacto) {
    return (
      <div className="agenda-subsection agenda-prazos-fixed-subsection">
        <strong>{titulo}</strong>
        {conteudo}
      </div>
    );
  }

  return (
    <div className="agenda-painel-section">
      <h3>
        <ShieldAlert size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#ef4444' }} />
        Prazos Fiscais Recorrentes
      </h3>
      {conteudo}
    </div>
  );
};
