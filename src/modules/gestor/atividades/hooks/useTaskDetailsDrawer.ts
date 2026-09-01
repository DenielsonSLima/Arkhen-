import { useEffect, useRef, useState } from 'react';
import type {
  TarefaGestor,
  TarefaProgressoPatch,
} from '../services/rotinasAtividadesService';
import { isTarefaReadOnly } from '../utils/minhaFilaPresentation';

interface UseTaskDetailsDrawerParams {
  selectedTask: TarefaGestor;
  remainingItems: number;
  onClose: () => void;
  updateTarefa: (id: string, updates: TarefaProgressoPatch) => Promise<unknown>;
  toggleChecklist: (
    id: string,
    idx: number,
    checked: boolean,
    evidencia?: string,
    justificativa?: string,
  ) => Promise<unknown>;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const focusableSelector = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const useTaskDetailsDrawer = ({
  selectedTask,
  remainingItems,
  onClose,
  updateTarefa,
  toggleChecklist,
}: UseTaskDetailsDrawerParams) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const selectedTaskRef = useRef(selectedTask);
  const observationLockRef = useRef(false);
  const checklistLockRef = useRef(false);
  const initialObservation = selectedTask.observacaoFalta || selectedTask.notas || '';
  const [observationDraft, setObservationDraft] = useState(initialObservation);
  const [savedObservation, setSavedObservation] = useState(initialObservation);
  const [completionNote, setCompletionNote] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSavingObservation, setIsSavingObservation] = useState(false);
  const [pendingChecklistIndex, setPendingChecklistIndex] = useState<number | null>(null);
  const isReadOnly = isTarefaReadOnly(selectedTask.status);
  const observationDirty = observationDraft !== savedObservation;
  selectedTaskRef.current = selectedTask;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
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
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const activeTask = selectedTaskRef.current;
    const nextObservation = activeTask.observacaoFalta || activeTask.notas || '';
    setObservationDraft(nextObservation);
    setSavedObservation(nextObservation);
    setCompletionNote('');
    setCompletionError('');
    setActionError('');
    observationLockRef.current = false;
    checklistLockRef.current = false;
    setIsSavingObservation(false);
    setPendingChecklistIndex(null);
  }, [selectedTask.id]);

  const changeObservation = (value: string) => {
    setObservationDraft(value);
    setActionError('');
  };

  const saveObservation = async () => {
    if (isReadOnly || !observationDirty || observationLockRef.current) return;
    observationLockRef.current = true;
    setIsSavingObservation(true);
    setActionError('');
    try {
      await updateTarefa(selectedTask.id, { observacaoFalta: observationDraft });
      setSavedObservation(observationDraft);
    } catch (error) {
      setActionError(getErrorMessage(
        error,
        'Não foi possível salvar a observação. Tente novamente.',
      ));
    } finally {
      observationLockRef.current = false;
      setIsSavingObservation(false);
    }
  };

  const changeCompletionNote = (value: string) => {
    setCompletionNote(value);
    if (value.trim()) setCompletionError('');
  };

  const changeChecklist = async (idx: number, checked: boolean) => {
    if (isReadOnly || checklistLockRef.current) return;
    const isFinalStep = checked && remainingItems === 1;
    const justification = completionNote.trim();
    if (isFinalStep && !justification) {
      setCompletionError('Informe a evidência ou justificativa para concluir a tarefa.');
      return;
    }

    checklistLockRef.current = true;
    setPendingChecklistIndex(idx);
    setCompletionError('');
    setActionError('');
    try {
      await toggleChecklist(
        selectedTask.id,
        idx,
        checked,
        undefined,
        isFinalStep ? justification : undefined,
      );
    } catch (error) {
      setActionError(getErrorMessage(
        error,
        'Não foi possível atualizar o checklist. Tente novamente.',
      ));
    } finally {
      checklistLockRef.current = false;
      setPendingChecklistIndex(null);
    }
  };

  return {
    actionError,
    changeChecklist,
    changeCompletionNote,
    changeObservation,
    closeButtonRef,
    completionError,
    completionNote,
    dialogRef,
    isReadOnly,
    isSavingObservation,
    observationDirty,
    observationDraft,
    pendingChecklistIndex,
    saveObservation,
  };
};
