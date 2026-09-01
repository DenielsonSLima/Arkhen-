import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

export interface EtapasEditorProps {
  etapas: string[];
  onChange: (etapas: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export const EtapasEditor = ({
  etapas,
  onChange,
  disabled = false,
  error = '',
}: EtapasEditorProps) => {
  const normalizedEtapas = etapas.length ? etapas : [''];

  const updateEtapa = (index: number, value: string) => {
    const next = [...normalizedEtapas];
    next[index] = value;
    onChange(next);
  };

  const moveEtapa = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= normalizedEtapas.length) return;

    const next = [...normalizedEtapas];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;
    onChange(next);
  };

  const removeEtapa = (index: number) => {
    if (normalizedEtapas.length === 1) {
      onChange(['']);
      return;
    }
    onChange(normalizedEtapas.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="obrigacao-etapas-editor">
      <div className="obrigacao-etapas-editor__heading">
        <div>
          <h4>Etapas do fluxo</h4>
          <p>Descreva a execução na ordem em que o trabalho deve acontecer.</p>
        </div>
        <span>{normalizedEtapas.length} {normalizedEtapas.length === 1 ? 'etapa' : 'etapas'}</span>
      </div>

      <div className="obrigacao-etapas-editor__list">
        {normalizedEtapas.map((etapa, index) => (
          <div className="obrigacao-etapa-row" key={`etapa-${index}`}>
            <span className="obrigacao-etapa-row__order" aria-hidden="true">
              {index + 1}
            </span>
            <label className="obrigacao-etapa-row__field">
              <input
                type="text"
                value={etapa}
                maxLength={180}
                placeholder={`Descreva a etapa ${index + 1}`}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-label={`Etapa ${index + 1}`}
                onChange={(event) => updateEtapa(index, event.target.value)}
              />
            </label>
            <div className="obrigacao-etapa-row__actions">
              <button
                type="button"
                onClick={() => moveEtapa(index, -1)}
                disabled={disabled || index === 0}
                title="Mover etapa para cima"
                aria-label={`Mover etapa ${index + 1} para cima`}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => moveEtapa(index, 1)}
                disabled={disabled || index === normalizedEtapas.length - 1}
                title="Mover etapa para baixo"
                aria-label={`Mover etapa ${index + 1} para baixo`}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => removeEtapa(index)}
                disabled={disabled}
                title="Remover etapa"
                aria-label={`Remover etapa ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="obrigacao-field-error">{error}</p> : null}

      <button
        type="button"
        className="obrigacao-add-stage"
        disabled={disabled || normalizedEtapas.length >= 80}
        onClick={() => onChange([...normalizedEtapas, ''])}
      >
        <Plus size={15} /> {normalizedEtapas.length >= 80 ? 'Limite de 80 etapas' : 'Adicionar etapa'}
      </button>
    </div>
  );
};
