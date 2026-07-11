import React from 'react';
import { FormCard } from '../forms/FormCard';
import { OutrosCreditosForm } from './OutrosCreditosForm';

type NovoOutroCredito = {
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
};

type OutrosCreditosFormModalProps = {
  isOpen: boolean;
  onSubmit: (item: NovoOutroCredito) => void;
  onClose: () => void;
};

export const OutrosCreditosFormModal: React.FC<OutrosCreditosFormModalProps> = ({
  isOpen,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <FormCard title="Novo crédito" onClose={onClose} containerMaxWidth="min(94vw, 760px)">
      <OutrosCreditosForm
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </FormCard>
  );
};
