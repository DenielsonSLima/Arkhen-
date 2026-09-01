import {
  OBRIGACAO_DIAS_SEMANA,
  OBRIGACAO_MESES,
  type ObrigacaoModeloDraft,
} from '../obrigacoes.types';

interface ObrigacaoPrazoFieldsProps {
  draft: ObrigacaoModeloDraft;
  isSaving: boolean;
  onPatch: (updates: Partial<ObrigacaoModeloDraft>) => void;
}

export const ObrigacaoPrazoFields = ({
  draft,
  isSaving,
  onPatch,
}: ObrigacaoPrazoFieldsProps) => {
  if (draft.periodicidade === 'unica') {
    return (
      <label className="obrigacao-form-field">
        <span>Data da ocorrência *</span>
        <input
          type="date"
          value={draft.dataVencimento ?? ''}
          disabled={isSaving}
          onChange={(event) => onPatch({ dataVencimento: event.target.value })}
        />
        <small className="obrigacao-form-field__help">
          Obrigatória para posicionar a execução única, mesmo sem prazo fiscal.
        </small>
      </label>
    );
  }

  if (draft.periodicidade === 'semanal') {
    return (
      <label className="obrigacao-form-field">
        <span>Dia da execução *</span>
        <select
          value={draft.diaSemana ?? 1}
          disabled={isSaving}
          onChange={(event) => onPatch({ diaSemana: Number(event.target.value) })}
        >
          {OBRIGACAO_DIAS_SEMANA.map((dia) => (
            <option key={dia.value} value={dia.value}>{dia.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (draft.periodicidade === 'anual') {
    return (
      <div className="obrigacao-form-grid two-columns nested">
        <label className="obrigacao-form-field">
          <span>Mês da ocorrência *</span>
          <select
            value={draft.mesVencimento ?? 1}
            disabled={isSaving}
            onChange={(event) => onPatch({ mesVencimento: Number(event.target.value) })}
          >
            {OBRIGACAO_MESES.map((mes, index) => (
              <option key={mes} value={index + 1}>{mes}</option>
            ))}
          </select>
        </label>
        <label className="obrigacao-form-field">
          <span>Dia da ocorrência *</span>
          <input
            type="number"
            min={1}
            max={31}
            value={draft.diaVencimento}
            disabled={isSaving}
            onChange={(event) => onPatch({ diaVencimento: Number(event.target.value) })}
          />
        </label>
      </div>
    );
  }

  if (!draft.temVencimento) return null;

  if (draft.periodicidade === 'diaria') {
    return (
      <div className="obrigacao-form-note">
        A obrigação será executada todos os dias, sem outro campo de agenda.
      </div>
    );
  }

  if (draft.periodicidade === 'quinzenal') {
    return (
      <div className="obrigacao-form-grid two-columns nested">
        <label className="obrigacao-form-field">
          <span>1ª quinzena</span>
          <input
            type="number"
            min={1}
            max={31}
            value={draft.diaPrimeiraQuinzena}
            disabled={isSaving}
            onChange={(event) => onPatch({ diaPrimeiraQuinzena: Number(event.target.value) })}
          />
        </label>
        <label className="obrigacao-form-field">
          <span>2ª quinzena</span>
          <input
            type="number"
            min={1}
            max={31}
            value={draft.diaSegundaQuinzena}
            disabled={isSaving}
            onChange={(event) => onPatch({ diaSegundaQuinzena: Number(event.target.value) })}
          />
        </label>
      </div>
    );
  }

  return (
    <label className="obrigacao-form-field">
      <span>Dia do vencimento</span>
      <input
        type="number"
        min={1}
        max={31}
        value={draft.diaVencimento}
        disabled={isSaving}
        onChange={(event) => onPatch({ diaVencimento: Number(event.target.value) })}
      />
    </label>
  );
};
