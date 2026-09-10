/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiscalLocationForm } from './FiscalLocationForm';

afterEach(cleanup);
const props = {
  companies: [], selectedCompanyId: 'office', selectedUf: 'SE', selectedMunicipio: 'ITABAIANA',
  availableUfs: ['SE'], availableMunicipios: ['Aracaju', 'Itabaiana'],
  onSelectCompany: vi.fn(), onSelectUf: vi.fn(), onSelectMunicipio: vi.fn(), onOpenIntegration: vi.fn(),
};
describe('Município efetivamente exibido no contexto fiscal', () => {
  it('seleciona Itabaiana quando o cadastro retorna ITABAIANA, inclusive após trocar de contexto', () => {
    const screen = render(<FiscalLocationForm {...props} selectedMunicipio="Aracaju" />);
    screen.rerender(<FiscalLocationForm {...props} />);
    const select = screen.getByLabelText('Município de emissão') as HTMLSelectElement;
    expect(select.value).toBe('Itabaiana');
    expect(select.selectedOptions[0].textContent).toBe('Itabaiana');
    fireEvent.change(select, { target: { value: 'Aracaju' } });
    expect(props.onSelectMunicipio).toHaveBeenCalledWith('Aracaju');
  });
  it('preserva município cadastrado fora do catálogo, sem exibir a primeira cidade', () => {
    const screen = render(<FiscalLocationForm {...props} selectedMunicipio="Campo do Brito" />);
    expect((screen.getByLabelText('Município de emissão') as HTMLSelectElement).value).toBe('Campo do Brito');
  });
  it('não apresenta Aracaju como selecionado quando não existe município escolhido', () => {
    const screen = render(<FiscalLocationForm {...props} selectedMunicipio="" />);
    expect((screen.getByLabelText('Município de emissão') as HTMLSelectElement).value).toBe('');
  });
});
