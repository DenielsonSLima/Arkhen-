import { describe, expect, it } from 'vitest';
import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatPhone,
  validateClienteIdentification,
} from './clienteFormModel';

describe('clienteFormModel', () => {
  it('preserva as máscaras usadas pelos formulários de cliente', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
    expect(formatCNPJ('12345678000199')).toBe('12.345.678/0001-99');
    expect(formatPhone('82999998888')).toBe('(82) 99999-8888');
    expect(formatPhone('8233334444')).toBe('(82) 3333-4444');
    expect(formatCEP('57000000')).toBe('57000-000');
  });

  it('mantém as mensagens de validação de CPF e CNPJ', () => {
    expect(validateClienteIdentification('CNPJ', '', 'Empresa', 'Fantasia'))
      .toBe('Por favor, informe o CNPJ.');
    expect(validateClienteIdentification('CNPJ', '12.345', 'Empresa', 'Fantasia'))
      .toBe('CNPJ incompleto.');
    expect(validateClienteIdentification('CPF', '123', 'Pessoa', 'Apelido'))
      .toBe('CPF incompleto.');
    expect(validateClienteIdentification('CPF', '123.456.789-01', '', 'Apelido'))
      .toBe('O Nome Completo é obrigatório.');
    expect(validateClienteIdentification('CNPJ', '12.345.678/0001-99', 'Empresa', ''))
      .toBe('O Nome Fantasia é obrigatório.');
  });

  it('aceita identificação completa para os dois tipos', () => {
    expect(validateClienteIdentification('CPF', '123.456.789-01', 'Pessoa', 'Apelido'))
      .toBeNull();
    expect(validateClienteIdentification('CNPJ', '12.345.678/0001-99', 'Empresa', 'Fantasia'))
      .toBeNull();
  });
});
