import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface PrazosAutomaticosProps {
  compacto?: boolean;
}

export const PrazosAutomaticos: React.FC<PrazosAutomaticosProps> = ({ compacto = false }) => {
  const conteudo = (
    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>
      Nenhum prazo fiscal cadastrado no Supabase.
    </p>
  );

  if (compacto) {
    return (
      <div className="agenda-subsection">
        <strong>Calendário fixo do mês</strong>
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
