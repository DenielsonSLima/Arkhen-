import { describe, expect, it } from 'vitest';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { empresaProtocolosKeys } from './empresaProtocolosQueries';

const company = {
  id: 'cliente-1',
  tipo: 'Simples Nacional',
  status: 'Ativa',
  tipoParceiroId: 'cliente-contabil',
} as Company;

describe('empresaProtocolosKeys', () => {
  it('isola o catálogo quando regime, status ou classificação mudam', () => {
    const base = empresaProtocolosKeys.detail(company);

    expect(empresaProtocolosKeys.detail({ ...company, tipo: 'Lucro Real' })).not.toEqual(base);
    expect(empresaProtocolosKeys.detail({ ...company, status: 'Inativa' })).not.toEqual(base);
    expect(empresaProtocolosKeys.detail({
      ...company,
      tipoParceiroId: 'fornecedor',
    })).not.toEqual(base);
  });
});
