import { describe, expect, it } from 'vitest';
import type { CatalogoItem } from '../../parametrizacao/services/catalogosService';
import {
  getCompanyTypeIdByEnquadramento,
  getDefaultCompanyTypeId,
  getLegalNatureId,
  isPessoaFisicaCompanyType,
} from './clienteFormModel';

const item = (id: string, codigo: string, nome: string): CatalogoItem => ({
  id,
  codigo,
  nome,
  descricao: '',
  sistema: false,
  ativo: true,
  ordem: 10,
});

const companyTypes = [
  item('pf', 'pessoa_fisica', 'Pessoa Física'),
  item('mei', 'mei', 'MEI'),
  item('me', 'microempresa', 'ME'),
  item('epp', 'epp', 'EPP'),
  item('demais', 'demais', 'Demais'),
];

const legalNatures = [
  item('ei', 'empresario_individual', 'Empresário Individual (EI)'),
  item('ltda', 'sociedade_limitada', 'Sociedade Limitada (LTDA)'),
  item('slu', 'sociedade_limitada_unipessoal', 'Sociedade Limitada Unipessoal (SLU)'),
  item('association', 'associacao_privada', 'Associação'),
  item('sa', 'sociedade_anonima', 'Sociedade Anônima (S.A.)'),
];

describe('clienteFormModel classification mapping', () => {
  it.each([
    ['MEI', 'mei'],
    ['ME', 'me'],
    ['EPP', 'epp'],
    ['Demais', 'demais'],
  ] as const)('maps official %s enquadramento to the catalog', (enquadramento, expectedId) => {
    expect(getCompanyTypeIdByEnquadramento(companyTypes, enquadramento)).toBe(expectedId);
  });

  it('does not infer a company size from a tax regime', () => {
    expect(getDefaultCompanyTypeId(companyTypes, 'Simples Nacional')).toBe('');
    expect(getDefaultCompanyTypeId(companyTypes, 'Lucro Real')).toBe('');
  });

  it('recognizes canonical and legacy Pessoa Física items', () => {
    expect(isPessoaFisicaCompanyType(companyTypes[0])).toBe(true);
    expect(isPessoaFisicaCompanyType(item('legacy-pf', 'te-1', 'Pessoa Física'))).toBe(true);
    expect(isPessoaFisicaCompanyType(companyTypes[1])).toBe(false);
  });

  it('maps official legal nature codes without inferring SLU from LTDA', () => {
    expect(getLegalNatureId(legalNatures, '206-2', 'Sociedade Empresária Limitada')).toBe('ltda');
    expect(getLegalNatureId(legalNatures, '213-5', 'Empresário Individual')).toBe('ei');
    expect(getLegalNatureId(legalNatures, '206-2', 'Sociedade Limitada Unipessoal')).toBe('ltda');
  });

  it('leaves unknown legal natures unselected for explicit review', () => {
    expect(getLegalNatureId(legalNatures, '999-9', 'Natureza inédita')).toBe('');
  });
});
