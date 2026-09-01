import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardList, RotateCcw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ProtocoloEmpresaConfig } from '../../protocolos/services/protocolosService';
import type { ProtocoloTipoConfig } from '../../protocolos/services/protocolosCatalogoService';
import { OBRIGACAO_PERIODICIDADE_LABELS } from '../../parametrizacao/obrigacoes/obrigacoes.types';

interface ObrigacoesSelectionModalProps {
  catalogo: ProtocoloTipoConfig[];
  configs: ProtocoloEmpresaConfig[];
  hasConflict: boolean;
  isSaving: boolean;
  unitLabel: string;
  onCancel: () => void;
  onReloadConflict: () => void;
  onSave: (selectedIds: Set<string>) => void;
}

export const ObrigacoesSelectionModal = ({
  catalogo,
  configs,
  hasConflict,
  isSaving,
  unitLabel,
  onCancel,
  onReloadConflict,
  onSave,
}: ObrigacoesSelectionModalProps) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const isSavingRef = useRef(isSaving);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const availableIds = new Set(catalogo.map((item) => item.id));
    return new Set(configs
      .filter((item) => item.ativo && availableIds.has(item.entregaId))
      .map((item) => item.entregaId));
  });

  const groupedCatalogo = useMemo(() => catalogo.reduce<Record<string, ProtocoloTipoConfig[]>>(
    (groups, item) => ({
      ...groups,
      [item.categoria]: [...(groups[item.categoria] ?? []), item],
    }),
    {},
  ), [catalogo]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    const availableIds = new Set(catalogo.map((item) => item.id));
    setSelectedIds((current) => new Set(
      [...current].filter((id) => availableIds.has(id)),
    ));
  }, [catalogo]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
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

  const toggleObrigacao = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="protocolos-selection-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="protocolos-selection-modal"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={isSaving}
        aria-labelledby="protocolos-selection-title"
        aria-describedby="protocolos-selection-description"
      >
        <header className="protocolos-selection-header">
          <div>
            <span><ClipboardList size={15} /> {unitLabel}</span>
            <h2 id="protocolos-selection-title">Selecionar obrigações</h2>
            <p id="protocolos-selection-description">
              Marque somente as obrigações que devem compor as rotinas desta unidade.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="protocolos-selection-close"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Fechar seleção de obrigações"
          >
            <X size={19} />
          </button>
        </header>

        {hasConflict ? (
          <div className="protocolos-selection-conflict" role="alert">
            <span>A configuração desta unidade mudou em outra tela.</span>
            <button type="button" onClick={onReloadConflict} disabled={isSaving}>
              <RotateCcw size={14} /> Recarregar configuração
            </button>
          </div>
        ) : null}

        <div className="protocolos-selection-count" aria-live="polite">
          <CheckCircle2 size={16} />
          <strong>{selectedIds.size}</strong>
          {selectedIds.size === 1 ? ' obrigação selecionada' : ' obrigações selecionadas'}
        </div>

        <div className="protocolos-selection-body">
          {catalogo.length === 0 ? (
            <div className="protocolos-selection-empty">
              Nenhuma obrigação ativa está disponível para esta unidade.
            </div>
          ) : Object.entries(groupedCatalogo).map(([categoria, obrigacoes]) => (
            <fieldset key={categoria} className="protocolos-selection-group">
              <legend>{categoria}</legend>
              <div className="protocolos-selection-options">
                {obrigacoes.map((obrigacao) => {
                  const checkboxId = `selecionar-obrigacao-${obrigacao.id}`;
                  return (
                    <label key={obrigacao.id} htmlFor={checkboxId} className="protocolos-selection-option">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={selectedIds.has(obrigacao.id)}
                        disabled={isSaving || hasConflict}
                        onChange={() => toggleObrigacao(obrigacao.id)}
                      />
                      <span>
                        <strong>{obrigacao.nome}</strong>
                        <small>
                          {OBRIGACAO_PERIODICIDADE_LABELS[obrigacao.periodicidadePadrao]}
                          {obrigacao.orgao ? ` • ${obrigacao.orgao}` : ''}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <footer className="protocolos-selection-footer">
          <button type="button" className="protocolos-selection-cancel" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="button"
            className="protocolos-selection-save"
            onClick={() => onSave(selectedIds)}
            disabled={isSaving || hasConflict || catalogo.length === 0}
          >
            <CheckCircle2 size={16} />
            {isSaving ? 'Salvando...' : 'Salvar seleção'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
