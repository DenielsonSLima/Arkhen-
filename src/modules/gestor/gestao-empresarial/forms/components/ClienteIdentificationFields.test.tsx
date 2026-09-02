/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  cnaeDescricao: '',
  capitalSocial: '',
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
  onCnaeDescricaoChange: handler(),
  onCapitalSocialChange: handler(),
  onTipoChange: handler(),
  onTipoParceiroChange: handler(),
  onTipoEmpresaChange: handler(),
  onNaturezaJuridicaChange: handler(),
  onCategoriaChange: handler(),
  onIeImChange: handler(),
  onLookup: handler(),
  onOpenQuickCreate: handler(),
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

  it('oferece criação rápida para todos os catálogos editáveis', () => {
    render(<ClienteIdentificationFields {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Criar novo tipo de parceiro' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Criar novo enquadramento' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Criar nova natureza jurídica' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Criar nova categoria de cliente' })).not.toBeNull();
  });

  it('não oferece Pessoa Física como porte de CNPJ', () => {
    render(
      <ClienteIdentificationFields
        {...baseProps}
        companyTypes={[
          ...baseProps.companyTypes,
          { ...baseProps.companyTypes[0], id: 'pf', codigo: 'pessoa_fisica', nome: 'Pessoa Física' },
        ]}
      />,
    );

    const companySelect = screen.getByRole('combobox', { name: 'Porte / enquadramento' });
    expect(within(companySelect).queryByRole('option', { name: 'Pessoa física' })).toBeNull();
  });

  it('aguarda os catálogos antes de consultar o CNPJ', () => {
    render(
      <ClienteIdentificationFields
        {...baseProps}
        cnpj="12.345.678/0001-90"
        isClassificationsLoading
      />,
    );

    expect((screen.getByRole('button', { name: 'Buscar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('formata CNPJ alfanumérico e bloqueia sua edição durante a consulta', () => {
    const onCnpjChange = vi.fn();
    const { rerender } = render(
      <ClienteIdentificationFields {...baseProps} onCnpjChange={onCnpjChange} />,
    );

    fireEvent.change(screen.getByLabelText('CNPJ *'), {
      target: { value: '00000000e08g12' },
    });
    expect(onCnpjChange).toHaveBeenCalledWith('00.000.000/E08G-12');

    rerender(
      <ClienteIdentificationFields
        {...baseProps}
        cnpj="00.000.000/E08G-12"
        isSearching
        onCnpjChange={onCnpjChange}
      />,
    );

    expect((screen.getByLabelText('CNPJ *') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Buscar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('associa todos os rótulos visíveis aos respectivos campos', () => {
    render(<ClienteIdentificationFields {...baseProps} />);

    const labelsAndIds = [
      ['CNPJ *', 'cliente-cnpj'],
      ['Regime tributário', 'cliente-regime-tributario'],
      ['Razão social *', 'cliente-razao-social'],
      ['Nome fantasia *', 'cliente-nome-fantasia'],
      ['CNAE', 'cliente-cnae'],
      ['Descrição do CNAE principal', 'cliente-cnae-descricao'],
      ['Tipo de parceiro *', 'cliente-tipo-parceiro'],
      ['Porte / enquadramento *', 'cliente-porte-enquadramento'],
      ['Natureza jurídica *', 'cliente-natureza-juridica'],
      ['Categoria do cliente *', 'cliente-categoria'],
      ['IE / IM', 'cliente-ie-im'],
      ['Capital social', 'cliente-capital-social'],
    ];

    labelsAndIds.forEach(([label, id]) => {
      expect((screen.getByLabelText(label) as HTMLElement).id).toBe(id);
    });
  });
});
