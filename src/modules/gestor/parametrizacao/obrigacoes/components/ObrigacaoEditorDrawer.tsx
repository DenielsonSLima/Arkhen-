import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, Save, X } from 'lucide-react';
import {
  OBRIGACAO_REGIMES,
  type ObrigacaoModeloDraft,
  type ObrigacaoRegime,
} from '../obrigacoes.types';
import { ObrigacaoEditorSections } from './ObrigacaoEditorSections';
import './ObrigacaoEditorDrawer.css';

export interface ObrigacaoEditorDrawerProps {
  initialValue: ObrigacaoModeloDraft;
  isSaving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (draft: ObrigacaoModeloDraft) => void | Promise<void>;
}

const cloneDraft = (value: ObrigacaoModeloDraft): ObrigacaoModeloDraft => ({
  ...value,
  regimes: [...value.regimes],
  etapas: value.etapas.length ? [...value.etapas] : [''],
});

const isValidDay = (value: number) => Number.isInteger(value) && value >= 1 && value <= 31;

export const ObrigacaoEditorDrawer = ({
  initialValue,
  isSaving,
  error = '',
  onClose,
  onSave,
}: ObrigacaoEditorDrawerProps) => {
  const [draft, setDraft] = useState<ObrigacaoModeloDraft>(() => cloneDraft(initialValue));
  const [validationError, setValidationError] = useState('');
  const [etapasError, setEtapasError] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const isSavingRef = useRef(isSaving);
  const isEditing = Boolean(initialValue.id);

  useEffect(() => {
    setDraft(cloneDraft(initialValue));
    setValidationError('');
    setEtapasError('');
  }, [initialValue]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) {
        event.preventDefault();
        drawerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const patchDraft = (updates: Partial<ObrigacaoModeloDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setValidationError('');
  };

  const toggleRegime = (regime: ObrigacaoRegime, checked: boolean) => {
    patchDraft({
      regimes: checked
        ? OBRIGACAO_REGIMES.filter((item) => item === regime || draft.regimes.includes(item))
        : draft.regimes.filter((item) => item !== regime),
    });
  };

  const validateDraft = (): ObrigacaoModeloDraft | null => {
    const etapas = draft.etapas.map((etapa) => etapa.trim()).filter(Boolean);
    if (draft.nome.trim().length < 2) {
      setValidationError('Informe um nome com pelo menos 2 caracteres.');
      return null;
    }
    if (!draft.categoria.trim()) {
      setValidationError('Selecione uma categoria.');
      return null;
    }
    if (!draft.regimes.length) {
      setValidationError('Selecione ao menos um regime aplicável.');
      return null;
    }
    if (!etapas.length) {
      setEtapasError('Adicione ao menos uma etapa válida ao fluxo.');
      return null;
    }
    if (draft.temVencimento && draft.periodicidade === 'quinzenal') {
      if (!isValidDay(draft.diaPrimeiraQuinzena) || !isValidDay(draft.diaSegundaQuinzena)) {
        setValidationError('Os vencimentos quinzenais devem estar entre os dias 1 e 31.');
        return null;
      }
      if (draft.diaPrimeiraQuinzena >= draft.diaSegundaQuinzena) {
        setValidationError('O vencimento da 1ª quinzena deve anteceder o da 2ª quinzena.');
        return null;
      }
    } else if (draft.temVencimento && !isValidDay(draft.diaVencimento)) {
      setValidationError('O dia do vencimento deve estar entre 1 e 31.');
      return null;
    }

    setEtapasError('');
    return {
      ...draft,
      nome: draft.nome.trim(),
      categoria: draft.categoria.trim(),
      orgao: draft.orgao.trim(),
      descricao: draft.descricao.trim(),
      diaVencimento: draft.periodicidade === 'quinzenal'
        ? draft.diaSegundaQuinzena
        : draft.diaVencimento,
      etapas,
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationError('');
    const validDraft = validateDraft();
    if (!validDraft) return;

    try {
      await onSave(validDraft);
    } catch (saveError) {
      setValidationError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar a obrigação.',
      );
    }
  };

  if (typeof document === 'undefined') return null;

  const visibleError = validationError || error;

  return createPortal(
    <div className="obrigacao-drawer-backdrop">
      <aside
        ref={drawerRef}
        className="obrigacao-drawer"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={isSaving}
        aria-labelledby="obrigacao-editor-title"
      >
        <header className="obrigacao-drawer__header">
          <div>
            <span className="obrigacao-drawer__eyebrow">
              <ClipboardList size={14} /> Fluxo da obrigação
            </span>
            <h2 id="obrigacao-editor-title">{isEditing ? 'Editar obrigação' : 'Nova obrigação'}</h2>
            <p>Defina identificação, agenda, regimes e o fluxo operacional.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="obrigacao-drawer__close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Fechar editor de obrigação"
          >
            <X size={19} />
          </button>
        </header>

        <form className="obrigacao-drawer__form" onSubmit={handleSubmit}>
          <div className="obrigacao-drawer__body">
            {visibleError ? (
              <div className="obrigacao-form-alert" role="alert">{visibleError}</div>
            ) : null}
            <ObrigacaoEditorSections
              draft={draft}
              isSaving={isSaving}
              etapasError={etapasError}
              onPatch={patchDraft}
              onToggleRegime={toggleRegime}
              onEtapasChange={(etapas) => {
                setEtapasError('');
                patchDraft({ etapas });
              }}
            />
          </div>

          <footer className="obrigacao-drawer__footer">
            <button
              type="button"
              className="obrigacoes-secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button type="submit" className="obrigacoes-primary-button" disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar obrigação'}
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
};
