import { CalendarClock, ClipboardList, Settings2 } from 'lucide-react';
import {
  OBRIGACAO_ORIGENS,
  OBRIGACAO_PERIODICIDADE_LABELS,
  OBRIGACAO_PERIODICIDADES,
  OBRIGACAO_REGIMES,
  type ObrigacaoModeloDraft,
  type ObrigacaoPeriodicidade,
  type ObrigacaoRegime,
} from '../obrigacoes.types';
import { EtapasEditor } from './EtapasEditor';
import { ObrigacaoPrazoFields } from './ObrigacaoPrazoFields';

const CATEGORIAS = [
  'Fiscal',
  'Contábil',
  'Trabalhista',
  'Financeiro',
  'Documentos',
  'NF-e',
  'NFC-e',
];

interface ObrigacaoEditorSectionsProps {
  draft: ObrigacaoModeloDraft;
  isSaving: boolean;
  etapasError: string;
  onPatch: (updates: Partial<ObrigacaoModeloDraft>) => void;
  onToggleRegime: (regime: ObrigacaoRegime, checked: boolean) => void;
  onEtapasChange: (etapas: string[]) => void;
}

export const ObrigacaoEditorSections = ({
  draft,
  isSaving,
  etapasError,
  onPatch,
  onToggleRegime,
  onEtapasChange,
}: ObrigacaoEditorSectionsProps) => {
  const categoryOptions = CATEGORIAS.includes(draft.categoria)
    ? CATEGORIAS
    : [draft.categoria, ...CATEGORIAS];

  return (
    <>
      <section className="obrigacao-form-section">
        <div className="obrigacao-form-section__heading">
          <Settings2 size={17} />
          <div>
            <h3>Identificação</h3>
            <p>Informações usadas nos cards e no acompanhamento.</p>
          </div>
        </div>
        <div className="obrigacao-form-grid two-columns">
          <label className="obrigacao-form-field">
            <span>Nome da obrigação *</span>
            <input
              type="text"
              value={draft.nome}
              maxLength={180}
              disabled={isSaving}
              autoFocus
              onChange={(event) => onPatch({ nome: event.target.value })}
            />
          </label>
          <label className="obrigacao-form-field">
            <span>Categoria *</span>
            <select
              value={draft.categoria}
              disabled={isSaving}
              onChange={(event) => onPatch({ categoria: event.target.value })}
            >
              {categoryOptions.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </label>
          <label className="obrigacao-form-field">
            <span>Órgão</span>
            <input
              type="text"
              value={draft.orgao}
              maxLength={80}
              disabled={isSaving}
              placeholder="Ex.: Receita Federal"
              onChange={(event) => onPatch({ orgao: event.target.value })}
            />
          </label>
          <label className="obrigacao-form-field">
            <span>Origem padrão</span>
            <select
              value={draft.origemPadrao}
              disabled={isSaving}
              onChange={(event) => onPatch({
                origemPadrao: event.target.value as ObrigacaoModeloDraft['origemPadrao'],
              })}
            >
              {OBRIGACAO_ORIGENS.map((origem) => (
                <option key={origem} value={origem}>{origem}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="obrigacao-form-field">
          <span>Descrição</span>
          <textarea
            value={draft.descricao}
            maxLength={600}
            rows={3}
            disabled={isSaving}
            onChange={(event) => onPatch({ descricao: event.target.value })}
          />
        </label>
      </section>

      <section className="obrigacao-form-section">
        <div className="obrigacao-form-section__heading split">
          <div className="obrigacao-form-section__title">
            <CalendarClock size={17} />
            <div>
              <h3>Prazo e período</h3>
              <p>O vencimento é opcional para fluxos sem data fiscal.</p>
            </div>
          </div>
          <label className="obrigacao-switch">
            <input
              type="checkbox"
              checked={draft.temVencimento}
              disabled={isSaving}
              onChange={(event) => onPatch({ temVencimento: event.target.checked })}
            />
            <span>Possui vencimento</span>
          </label>
        </div>

        <div className={`obrigacao-form-grid two-columns obrigacao-period-grid ${
          ['anual', 'quinzenal'].includes(draft.periodicidade) ? 'is-three-columns' : ''
        }`}>
          <label className="obrigacao-form-field">
            <span>Período</span>
            <select
              value={draft.periodicidade}
              disabled={isSaving}
              onChange={(event) => onPatch({
                periodicidade: event.target.value as ObrigacaoPeriodicidade,
              })}
            >
              {OBRIGACAO_PERIODICIDADES.map((periodicidade) => (
                <option key={periodicidade} value={periodicidade}>
                  {OBRIGACAO_PERIODICIDADE_LABELS[periodicidade]}
                </option>
              ))}
            </select>
          </label>
          <ObrigacaoPrazoFields draft={draft} isSaving={isSaving} onPatch={onPatch} />
        </div>
        {draft.temVencimento && ['quinzenal', 'mensal', 'trimestral', 'semestral']
          .includes(draft.periodicidade) ? (
          <label className="obrigacao-check-option">
            <input
              type="checkbox"
              checked={draft.referenciaMesAnterior}
              disabled={isSaving}
              onChange={(event) => onPatch({ referenciaMesAnterior: event.target.checked })}
            />
            <span>
              <strong>Competência do mês anterior</strong>
              <small>Ex.: vencimento em maio acompanha a competência de abril.</small>
            </span>
          </label>
        ) : !draft.temVencimento ? (
          <div className="obrigacao-form-note">
            O período organiza a rotina, sem definir um vencimento fixo.
          </div>
        ) : null}
      </section>

      <section className="obrigacao-form-section">
        <div className="obrigacao-form-section__heading">
          <ClipboardList size={17} />
          <div>
            <h3>Regimes aplicáveis</h3>
            <p>Selecione onde a obrigação poderá ser ativada.</p>
          </div>
        </div>
        <div className="obrigacao-regimes-grid">
          {OBRIGACAO_REGIMES.map((regime) => (
            <label key={regime} className={draft.regimes.includes(regime) ? 'is-selected' : ''}>
              <input
                type="checkbox"
                checked={draft.regimes.includes(regime)}
                disabled={isSaving}
                onChange={(event) => onToggleRegime(regime, event.target.checked)}
              />
              <span>{regime}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="obrigacao-form-section">
        <EtapasEditor
          etapas={draft.etapas}
          disabled={isSaving}
          error={etapasError}
          onChange={onEtapasChange}
        />
      </section>
    </>
  );
};
