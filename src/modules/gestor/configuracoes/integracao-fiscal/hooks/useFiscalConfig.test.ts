/** @vitest-environment jsdom */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFiscalConfig } from './useFiscalConfig';

const state = vi.hoisted(() => ({
  companies: { isSuccess: true, data: [{ id: 'office', nome: 'Empresa teste', cidade: 'ITABAIANA', uf: 'SE' }] },
  contexts: { isSuccess: true, data: [{
    context: { key: 'office__SE__itabaiana', companyId: 'office', companyName: 'Empresa teste',
      municipio: 'ITABAIANA', uf: 'SE', isActive: false },
    config: { ambiente: 'homologacao', provedor: 'WebISS' }, stats: {}, history: [],
  }] },
  save: {}, certificate: {}, diagnostic: {},
}));
vi.mock('../queries/useFiscalQueries', () => ({ useFiscalQueries: () => state, useFiscalReadiness: () => ({}) }));
vi.mock('../services/fiscalCompanyService', () => ({ resolveCompanyName: () => 'Empresa teste' }));
vi.mock('../../../../../lib/supabase', () => ({ supabase: {} }));
afterEach(cleanup);

it('mostra apenas Itabaiana cadastrada, sem criar contexto de Aracaju a partir do catálogo', () => {
  const { result } = renderHook(useFiscalConfig);
  expect(result.current.locationTree.flatMap(group => group.municipios).map(city => city.municipio)).toEqual(['ITABAIANA']);
  expect(result.current.selectedMunicipio).toBe('ITABAIANA');
});
