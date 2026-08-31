import { describe, expect, it } from 'vitest';
import type { Company } from '../services/gestaoEmpresarialService';
import { filterCompanies } from './filterCompanies';

const company = (nome: string, cnpj: string): Company => ({
  id: nome,
  nome,
  razaoSocial: `${nome} LTDA`,
  cnpj,
  tipo: 'Lucro Real',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
});

describe('filterCompanies', () => {
  const companies = [company('Casa do Fazendeiro', '32.833.113/0001-64'), company('Amani Cosmetics', '28.354.599/0001-80')];

  it('does not turn an alphabetic search into an empty CNPJ match for every client', () => {
    expect(filterCompanies(companies, 'bel', 'Todos', 'Ativos')).toEqual([]);
  });

  it('filters by a partial client name or document', () => {
    expect(filterCompanies(companies, 'faz', 'Todos', 'Ativos').map((item) => item.nome)).toEqual(['Casa do Fazendeiro']);
    expect(filterCompanies(companies, '28354', 'Todos', 'Ativos').map((item) => item.nome)).toEqual(['Amani Cosmetics']);
  });
});
