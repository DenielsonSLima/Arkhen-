/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteIdentificationFields } from './ClienteIdentificationFields';

const handler = () => vi.fn();

afterEach(cleanup);

const baseProps = {
  docType: 'CNPJ' as const,
  cnpj: '',
  cpf: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnae: '',
  tipo: 'Simples Nacional' as const,
  tipoParceiroId: 'partner-type',
  tipoEmpresaId: 'company-type',
  naturezaJuridicaId: 'legal-nature',
  categoria: 'Cliente Contábil',
  ieIm: '',
  partnerTypes: [{
    id: 'partner-type',
    codigo: 'tp-1',
    nome: 'CLIENTE CONTÁBIL',
    descricao: '',
    sistema: true,
    ativo: true,
    ordem: 10,
  }],
  companyTypes: [{
    id: 'company-type',
    codigo: 'te-3',
    nome: 'EMPRESA DE PEQUENO PORTE',
    descricao: '',
    sistema: true,
    ativo: true,
    ordem: 10,
  }],
  legalNatures: [{
    id: 'legal-nature',
    codigo: 'nj-2',
    nome: 'SOCIEDADE LIMITADA',
    descricao: '',
    sistema: true,
    ativo: true,
    ordem: 10,
  }],
  availableCategories: ['Cliente Contábil'],
  isClassificationsLoading: false,
  isSearching: false,
  onCnpjChange: handler(),
  onCpfChange: handler(),
  onRazaoSocialChange: handler(),
  onNomeFantasiaChange: handler(),
  onCnaeChange: handler(),
  onTipoChange: handler(),
  onTipoParceiroChange: handler(),
  onTipoEmpresaChange: handler(),
  onNaturezaJuridicaChange: handler(),
  onCategoriaChange: handler(),
  onIeImChange: handler(),
  onLookup: handler(),
  onOpenCategoryModal: handler(),
};

describe('ClienteIdentificationFields', () => {
  it('mantém o valor bruto e apresenta os catálogos em sentence case', () => {
    render(<ClienteIdentificationFields {...baseProps} />);

    const [, partnerSelect, companySelect, legalNatureSelect] = screen.getAllByRole('combobox');
    expect((within(partnerSelect).getByRole('option', { name: 'Cliente contábil' }) as HTMLOptionElement).value).toBe('partner-type');
    expect((within(companySelect).getByRole('option', { name: 'Empresa de pequeno porte' }) as HTMLOptionElement).value).toBe('company-type');
    expect((within(legalNatureSelect).getByRole('option', { name: 'Sociedade limitada' }) as HTMLOptionElement).value).toBe('legal-nature');
  });

  it('seleciona o nome normalizado quando a categoria criada chega pelo refetch', () => {
    const { rerender } = render(<ClienteIdentificationFields {...baseProps} />);

    rerender(
      <ClienteIdentificationFields
        {...baseProps}
        categoria="Nova categoria"
        availableCategories={['Cliente Contábil', 'Nova categoria']}
      />,
    );

    const categorySelect = screen.getByRole('combobox', { name: 'Categoria do parceiro' });
    expect((categorySelect as HTMLSelectElement).value).toBe('Nova categoria');
    expect((within(categorySelect).getByRole('option', { name: 'Nova categoria' }) as HTMLOptionElement).value).toBe('Nova categoria');
  });
});
