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
  partnerCategories: [{ id: 'category-client', nome: 'Cliente Contábil' }],
  isClienteContabilPartner: true,
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
        partnerCategories={[
          { id: 'category-client', nome: 'Cliente Contábil' },
          { id: 'category-new', nome: 'Nova categoria' },
        ]}
      />,
    );

    const categorySelect = screen.getByRole('combobox', { name: 'Categoria do cliente' });
    expect((categorySelect as HTMLSelectElement).value).toBe('Nova categoria');
    expect((within(categorySelect).getByRole('option', { name: 'Nova categoria' }) as HTMLOptionElement).value).toBe('Nova categoria');
  });

  it('deduplica tipo e categoria dentro de suas próprias fontes sem perder a seleção', () => {
    render(
      <ClienteIdentificationFields
        {...baseProps}
        tipoParceiroId="partner-type-selected"
        categoria=" cliente  contábil "
        partnerTypes={[
          { ...baseProps.partnerTypes[0], id: 'partner-type-primary' },
          { ...baseProps.partnerTypes[0], id: 'partner-type-selected', nome: ' cliente  contábil ' },
          { ...baseProps.partnerTypes[0], id: 'partner-type-supplier', codigo: 'fornecedor', nome: 'Fornecedor' },
        ]}
        partnerCategories={[
          { id: 'category-primary', nome: 'Cliente Contábil' },
          { id: 'category-selected', nome: ' cliente  contábil ' },
          { id: 'category-premium', nome: 'Premium' },
        ]}
      />,
    );

    const [, partnerSelect] = screen.getAllByRole('combobox');
    const categorySelect = screen.getByRole('combobox', { name: 'Categoria do cliente' });

    expect((partnerSelect as HTMLSelectElement).value).toBe('partner-type-selected');
    expect((categorySelect as HTMLSelectElement).value).toBe(' cliente  contábil ');
    expect(within(partnerSelect).queryByRole('option', { name: 'Premium' })).toBeNull();
    expect(within(categorySelect).queryByRole('option', { name: 'Fornecedor' })).toBeNull();
    expect(within(partnerSelect).getAllByRole('option')).toHaveLength(3);
    expect(within(categorySelect).getAllByRole('option')).toHaveLength(3);
  });

  it('oculta a categoria de cliente para parceiros que não são clientes contábeis', () => {
    render(<ClienteIdentificationFields {...baseProps} isClienteContabilPartner={false} />);

    expect(screen.queryByRole('combobox', { name: 'Categoria do cliente' })).toBeNull();
  });
});
