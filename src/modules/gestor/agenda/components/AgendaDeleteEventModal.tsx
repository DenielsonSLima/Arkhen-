import React from 'react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import type { Evento } from '../services/agenda.service';

interface AgendaDeleteEventModalProps {
  isOpen: boolean;
  evento: Evento | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const AgendaDeleteEventModal: React.FC<AgendaDeleteEventModalProps> = ({
  isOpen,
  evento,
  onClose,
  onConfirm,
}) => {
  return (
    <SystemQuickModal
      isOpen={isOpen}
      title="Excluir Evento"
      message={`Deseja remover o evento "${evento?.titulo || 'selecionado'}"?`}
      confirmLabel="Confirmar"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onClose={onClose}
      danger
    />
  );
};
