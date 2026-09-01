import {
  CalendarClock,
  CheckCircle2,
  CircleOff,
  ClipboardList,
  Copy,
  Edit3,
  Layers3,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { ObrigacaoModelo, ObrigacaoPeriodicidade } from '../obrigacoes.types';

const PERIODICIDADE_LABELS: Record<ObrigacaoPeriodicidade, string> = {
  mensal: 'Mensal',
  quinzenal: 'Quinzenal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
};

export interface ObrigacaoCardProps {
  obrigacao: ObrigacaoModelo;
  onEdit: (obrigacao: ObrigacaoModelo) => void;
  onDuplicate: (obrigacao: ObrigacaoModelo) => void;
  onToggleStatus: (obrigacao: ObrigacaoModelo) => void;
  isUpdating?: boolean;
}

const getScheduleLabel = (obrigacao: ObrigacaoModelo) => {
  if (!obrigacao.temVencimento) {
    return `${PERIODICIDADE_LABELS[obrigacao.periodicidade]} · sem vencimento fixo`;
  }
  if (obrigacao.periodicidade === 'quinzenal') {
    return `Quinzenal · dias ${obrigacao.diaPrimeiraQuinzena} e ${obrigacao.diaSegundaQuinzena}`;
  }
  return `${PERIODICIDADE_LABELS[obrigacao.periodicidade]} · vence dia ${obrigacao.diaVencimento}`;
};

export const ObrigacaoCard = ({
  obrigacao,
  onEdit,
  onDuplicate,
  onToggleStatus,
  isUpdating = false,
}: ObrigacaoCardProps) => (
  <article className={`obrigacao-card ${obrigacao.ativo ? '' : 'is-inactive'}`}>
    <header className="obrigacao-card__header">
      <div className="obrigacao-card__identity">
        <span className="obrigacao-card__icon"><ClipboardList size={18} /></span>
        <div>
          <span className="obrigacao-card__category">{obrigacao.categoria}</span>
          <h3>{obrigacao.nome}</h3>
        </div>
      </div>
      <span className={`obrigacao-status ${obrigacao.ativo ? 'is-active' : 'is-inactive'}`}>
        {obrigacao.ativo ? <CheckCircle2 size={13} /> : <CircleOff size={13} />}
        {obrigacao.ativo ? 'Disponível' : 'Inativa'}
      </span>
    </header>

    <p className="obrigacao-card__description">
      {obrigacao.descricao || 'Nenhuma descrição informada.'}
    </p>

    <div className="obrigacao-card__schedule">
      <CalendarClock size={16} />
      <div>
        <strong>{getScheduleLabel(obrigacao)}</strong>
        {obrigacao.temVencimento ? (
          <span>{obrigacao.referenciaMesAnterior ? 'Competência do mês anterior' : 'Competência do mês atual'}</span>
        ) : null}
      </div>
    </div>

    <div className="obrigacao-card__regimes" aria-label="Regimes aplicáveis">
      <Layers3 size={14} aria-hidden="true" />
      <div>
        {obrigacao.regimes.map((regime) => (
          <span key={regime}>{regime}</span>
        ))}
      </div>
    </div>

    <footer className="obrigacao-card__footer">
      <span className="obrigacao-card__steps">
        <ClipboardList size={14} />
        {obrigacao.etapas.length} {obrigacao.etapas.length === 1 ? 'etapa' : 'etapas'}
      </span>
      <div className="obrigacao-card__actions">
        <button
          type="button"
          onClick={() => onDuplicate(obrigacao)}
          disabled={isUpdating}
          title="Duplicar obrigação"
          aria-label={`Duplicar ${obrigacao.nome}`}
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(obrigacao)}
          disabled={isUpdating}
          title={obrigacao.ativo ? 'Desativar obrigação' : 'Ativar obrigação'}
          aria-label={`${obrigacao.ativo ? 'Desativar' : 'Ativar'} ${obrigacao.nome}`}
        >
          {obrigacao.ativo ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => onEdit(obrigacao)}
          disabled={isUpdating}
        >
          <Edit3 size={15} /> Editar
        </button>
      </div>
    </footer>
  </article>
);
