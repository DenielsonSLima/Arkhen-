import React from 'react';
import { CalendarCog, CalendarDays, UsersRound } from 'lucide-react';

export type AgendaAba = 'calendario' | 'equipe' | 'padroes';

interface AgendaModuleTabsProps {
  abaAtual: AgendaAba;
  podeGerenciarPadroes: boolean;
  onChange: (aba: AgendaAba) => void;
}

export const AgendaModuleTabs: React.FC<AgendaModuleTabsProps> = ({
  abaAtual,
  podeGerenciarPadroes,
  onChange,
}) => (
  <div className="agenda-module-tabs">
    <button
      type="button"
      className={abaAtual === 'calendario' ? 'active' : ''}
      onClick={() => onChange('calendario')}
    >
      <CalendarDays size={15} />
      Calendário
    </button>
    {podeGerenciarPadroes && (
      <button
        type="button"
        className={abaAtual === 'equipe' ? 'active' : ''}
        onClick={() => onChange('equipe')}
      >
        <UsersRound size={15} />
        Equipe
      </button>
    )}
    {podeGerenciarPadroes && (
      <button
        type="button"
        className={abaAtual === 'padroes' ? 'active' : ''}
        onClick={() => onChange('padroes')}
      >
        <CalendarCog size={15} />
        Padrões
      </button>
    )}
  </div>
);
