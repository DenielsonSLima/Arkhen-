import { describe, expect, it } from 'vitest';
import { parseFilialForm } from './filialFormModel';

const validInput = {
  nome: 'Filial Aracaju',
  cnpj: '12.345.678/0002-00',
  email: 'filial@example.com',
  telefone: '(79) 99999-0000',
  contato: 'Maria',
  endereco: 'Rua A, 10',
  bairro: 'Centro',
  cep: '49000-000',
  cidade: 'Aracaju',
  uf: 'se',
};

describe('filialFormModel', () => {
  it('normaliza textos e valida a identificação da filial', () => {
    expect(parseFilialForm({ ...validInput, nome: '  Filial Aracaju  ' })).toMatchObject({
      nome: 'Filial Aracaju',
      uf: 'SE',
    });
  });

  it('rejeita CNPJ e e-mail inválidos antes de chamar a RPC', () => {
    expect(() => parseFilialForm({ ...validInput, cnpj: '123' })).toThrow('14 dígitos');
    expect(() => parseFilialForm({ ...validInput, email: 'email-invalido' })).toThrow('e-mail válido');
  });
});
