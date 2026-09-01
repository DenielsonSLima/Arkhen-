import { describe, expect, it } from 'vitest';
import { normalizeCatalogLabel } from './catalogLabel';

describe('normalizeCatalogLabel', () => {
  it.each([
    ['AGROPECUÁRIA', 'Agropecuária'],
    ['clínica', 'Clínica'],
    ['POSTO DE COMBUSTÍVEL', 'Posto de combustível'],
    ['cliente contábil', 'Cliente contábil'],
    ['SOCIEDADE LIMITADA UNIPESSOAL', 'Sociedade limitada unipessoal'],
  ])('normaliza %s para sentence case', (input, expected) => {
    expect(normalizeCatalogLabel(input)).toBe(expected);
  });

  it.each([
    ['MEI', 'MEI'],
    ['CNPJ PARA MEI', 'CNPJ para MEI'],
    ['cnae 62.01-5-01', 'CNAE 62.01-5-01'],
    ['pf', 'PF'],
    ['SOCIEDADE LTDA', 'Sociedade LTDA'],
    ['SOCIEDADE LTDA.', 'Sociedade LTDA.'],
    ['EMPRESA EIRELI / SLU', 'Empresa EIRELI / SLU'],
    ['PARCEIRO S/A B2B', 'Parceiro S/A B2B'],
    ['microempresa me', 'Microempresa ME'],
    ['me/epp', 'ME/EPP'],
    ['cnpj/cpf', 'CNPJ/CPF'],
    ['empresa s.a.', 'Empresa S.A.'],
  ])('preserva siglas em %s', (input, expected) => {
    expect(normalizeCatalogLabel(input)).toBe(expected);
  });

  it.each([
    ['SIMPLES NACIONAL', 'Simples Nacional'],
    ['lucro presumido', 'Lucro Presumido'],
    ['Lucro Real', 'Lucro Real'],
  ])('preserva o nome oficial %s', (input, expected) => {
    expect(normalizeCatalogLabel(input)).toBe(expected);
  });

  it('preserva caixa mista intencional', () => {
    expect(normalizeCatalogLabel('e-Commerce B2B')).toBe('e-Commerce B2B');
  });

  it('remove espaços excedentes e aceita valores vazios', () => {
    expect(normalizeCatalogLabel('  nova   categoria  ')).toBe('Nova categoria');
    expect(normalizeCatalogLabel(undefined)).toBe('');
  });
});
