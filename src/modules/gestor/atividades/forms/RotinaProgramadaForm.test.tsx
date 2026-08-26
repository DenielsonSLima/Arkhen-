/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModeloAtividade } from '../services/atividadesService';
import type { ClienteRotina } from '../services/rotinasAtividadesService';
import { RotinaProgramadaForm } from './RotinaProgramadaForm';
import { blankRotinaProgramadaForm } from './rotinaProgramadaFormModel';

const MODELO_FISCAL_ID = '10000000-0000-4000-8000-000000000001';
const MODELO_FOLHA_ID = '10000000-0000-4000-8000-000000000002';
const CLIENTE_A_ID = '20000000-0000-4000-8000-000000000001';
const CLIENTE_B_ID = '20000000-0000-4000-8000-000000000002';

const modelos: ModeloAtividade[] = [
  { id: MODELO_FISCAL_ID, nome: 'Fiscal', descricao: '', etapas: ['Apurar impostos'] },
  { id: MODELO_FOLHA_ID, nome: 'Folha', descricao: '', etapas: ['Conferir folha'] },
];

const clientes: ClienteRotina[] = [
  { id: CLIENTE_A_ID, nome: 'Cliente A', modelosAtivos: [MODELO_FISCAL_ID] },
  { id: CLIENTE_B_ID, nome: 'Cliente B', modelosAtivos: [MODELO_FOLHA_ID] },
];

const Harness = () => {
  const [values, setValues] = useState(blankRotinaProgramadaForm);
  return (
    <>
      <RotinaProgramadaForm
        values={values}
        onChange={setValues}
        onSubmit={(event) => event.preventDefault()}
        onCancel={vi.fn()}
        modelos={modelos}
        usuarios={[]}
        clientes={clientes}
        isLoadingModelos={false}
        isModelosError={false}
        isSaving={false}
        formError=""
        onRetryModelos={vi.fn()}
      />
      <output data-testid="checklist-atual">{values.checklistText}</output>
    </>
  );
};

describe('RotinaProgramadaForm — vínculo do modelo', () => {
  afterEach(() => cleanup());

  it('exige o vínculo antes do modelo e mostra somente os modelos do cliente', () => {
    render(<Harness />);
    const vinculo = screen.getByLabelText(/1\. Cliente ou escritório/i) as HTMLSelectElement;
    const modelo = screen.getByLabelText(/2\. Modelo base/i) as HTMLSelectElement;

    expect(modelo.disabled).toBe(true);
    fireEvent.change(vinculo, { target: { value: CLIENTE_A_ID } });

    expect(modelo.disabled).toBe(false);
    expect(Array.from(modelo.options).map((option) => option.value)).toEqual(['', MODELO_FISCAL_ID]);
  });

  it('limpa modelo e checklist quando o novo cliente não possui aquele vínculo', () => {
    render(<Harness />);
    const vinculo = screen.getByLabelText(/1\. Cliente ou escritório/i) as HTMLSelectElement;
    const modelo = screen.getByLabelText(/2\. Modelo base/i) as HTMLSelectElement;

    fireEvent.change(vinculo, { target: { value: CLIENTE_A_ID } });
    fireEvent.change(modelo, { target: { value: MODELO_FISCAL_ID } });
    expect(modelo.value).toBe(MODELO_FISCAL_ID);
    expect(screen.getByTestId('checklist-atual').textContent).toBe('Apurar impostos');

    fireEvent.change(vinculo, { target: { value: CLIENTE_B_ID } });

    expect(modelo.value).toBe('');
    expect(screen.getByTestId('checklist-atual').textContent).toBe('');
    expect(Array.from(modelo.options).map((option) => option.value)).toEqual(['', MODELO_FOLHA_ID]);
  });
});
