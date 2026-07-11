import React from 'react';
import { FormCard } from '../forms/FormCard';
import { OutrosDebitosForm } from './OutrosDebitosForm';

type NovoOutroDebito = {
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
};

type OutrosDebitosFormModalProps = {
  isOpen: boolean;
  onSubmit: (item: NovoOutroDebito) => void;
  onClose: () => void;
};

export const OutrosDebitosFormModal: React.FC<OutrosDebitosFormModalProps> = ({
  isOpen,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <FormCard title="Novo débito" onClose={onClose} containerMaxWidth="min(94vw, 760px)">
      <OutrosDebitosForm
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </FormCard>
  );
};
