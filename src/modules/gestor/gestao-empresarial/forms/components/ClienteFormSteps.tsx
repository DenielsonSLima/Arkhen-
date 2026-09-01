import React from 'react';
import { CLIENTE_FORM_STEPS, type ClienteFormStep } from '../clienteFormStepsModel';

interface ClienteFormStepsProps {
  currentStep: ClienteFormStep;
  currentStepIndex: number;
}

export const ClienteFormSteps: React.FC<ClienteFormStepsProps> = ({
  currentStep,
  currentStepIndex,
}) => (
  <div className="cliente-form-steps" aria-label="Etapas do cadastro">
    {CLIENTE_FORM_STEPS.map((item, index) => (
      <span
        key={item.id}
        className={currentStep === item.id ? 'active' : index < currentStepIndex ? 'done' : ''}
      >
        {item.label}
      </span>
    ))}
  </div>
);
