import { describe, expect, it } from 'vitest';
import type { ClienteEmpresa } from '../services/atividadesService';
import type { RotinaCompanyGroup } from './rotinasWorkspace';
import {
  filterRotinaCompanyGroups,
  getVisiblePageNumbers,
  paginateRotinaCompanyGroups,
} from './rotinasCompanyDirectory';

const makeGroup = (
  id: string,
  overrides: Partial<ClienteEmpresa> = {},
): RotinaCompanyGroup<ClienteEmpresa> => ({
  cliente: {
    id,
    nome: `Empresa ${id}`,
    cnpj: `12.345.678/000${id}-90`,
    regime: 'Simples Nacional',
    tipoParceiroId: 'cliente-contabil',
    tipoParceiroNome: 'Cliente Contábil',
    tipoEstabelecimento: 'Matriz',
    modelosAtivos: [],
    ...overrides,
  },
  rotinas: [],
  totalRotinas: 0,
  semResponsavel: 0,
});

describe('filterRotinaCompanyGroups', () => {
  const groups = [
    makeGroup('1', { nome: 'Ágata Assessoria', regime: 'Lucro Real' }),
    makeGroup('2', {
      nome: 'Parceiro Comercial',
      tipoParceiroId: 'parceiro-comercial',
      tipoParceiroNome: 'Parceiro Comercial',
    }),
  ];

  it('busca sem acentos e sem pontuação no CNPJ', () => {
    expect(filterRotinaCompanyGroups(groups, {
      search: 'agata',
      partnerTypeId: '',
      taxRegime: '',
    }).map(({ cliente }) => cliente.id)).toEqual(['1']);

    expect(filterRotinaCompanyGroups(groups, {
      search: '12345678000290',
      partnerTypeId: '',
      taxRegime: '',
    }).map(({ cliente }) => cliente.id)).toEqual(['2']);
  });

  it('combina tipo de parceiro e regime tributário', () => {
    expect(filterRotinaCompanyGroups(groups, {
      search: '',
      partnerTypeId: 'cliente-contabil',
      taxRegime: 'Lucro Real',
    }).map(({ cliente }) => cliente.id)).toEqual(['1']);
  });
});

describe('paginação de empresas', () => {
  it('mantém 12 cards por página e corrige páginas fora do intervalo', () => {
    const groups = Array.from({ length: 25 }, (_, index) => makeGroup(String(index + 1)));

    expect(paginateRotinaCompanyGroups(groups, 2)).toMatchObject({
      currentPage: 2,
      totalPages: 3,
      rangeStart: 13,
      rangeEnd: 24,
    });
    expect(paginateRotinaCompanyGroups(groups, 99).items).toHaveLength(1);
    expect(getVisiblePageNumbers(6, 10)).toEqual([4, 5, 6, 7, 8]);
  });
});
