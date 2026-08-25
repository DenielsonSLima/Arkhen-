import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  empresaService,
  mapBrasilApiCnpjToEmpresa,
  mergeCnpjLookupIntoEmpresa,
  type EmpresaDados,
} from './empresaService';

const brasilApiFixture = {
  razao_social: 'EMPRESA EXEMPLO CONTABIL LTDA',
  nome_fantasia: 'EXEMPLO CONTABIL',
  email: null,
  ddd_telefone_1: '1198765432',
  cep: '01001000',
  descricao_tipo_de_logradouro: 'PRAÇA',
  logradouro: 'DA SÉ',
  numero: '100',
  municipio: 'SÃO PAULO',
  uf: 'sp',
};

describe('mapBrasilApiCnpjToEmpresa', () => {
  it('mapeia o endereço e o telefone no formato atual da BrasilAPI', () => {
    expect(mapBrasilApiCnpjToEmpresa(brasilApiFixture)).toEqual({
      razaoSocial: 'EMPRESA EXEMPLO CONTABIL LTDA',
      nomeFantasia: 'EXEMPLO CONTABIL',
      telefone: '(11) 9876-5432',
      cep: '01001-000',
      endereco: 'PRAÇA DA SÉ',
      numero: '100',
      cidade: 'SÃO PAULO',
      estado: 'SP',
    });
  });

  it('não devolve valores vazios que apagariam dados já digitados', () => {
    const current = { email: 'contato@empresa.com', telefone: '(79) 99999-9999' };
    const mapped = mapBrasilApiCnpjToEmpresa({
      razao_social: 'EMPRESA TESTE LTDA',
      email: null,
      ddd_telefone_1: '',
    });

    expect({ ...current, ...mapped }).toEqual({
      razaoSocial: 'EMPRESA TESTE LTDA',
      email: 'contato@empresa.com',
      telefone: '(79) 99999-9999',
    });
  });
});

describe('mergeCnpjLookupIntoEmpresa', () => {
  const currentEmpresa: EmpresaDados = {
    razaoSocial: 'EMPRESA ANTERIOR LTDA',
    nomeFantasia: 'Empresa Anterior',
    cnpj: '11.222.333/0001-81',
    inscricaoEstadual: '123',
    email: 'anterior@empresa.com',
    telefone: '(79) 99999-9999',
    cep: '49000-000',
    endereco: 'Rua Antiga',
    numero: '10',
    cidade: 'Aracaju',
    estado: 'SE',
    logoUrl: 'https://example.com/logo.png',
    logoTamanho: 110,
  };

  it('limpa os campos da empresa anterior ao consultar outro CNPJ', () => {
    const merged = mergeCnpjLookupIntoEmpresa(
      currentEmpresa,
      { razaoSocial: 'NOVA EMPRESA LTDA' },
      true,
    );

    expect(merged).toMatchObject({
      razaoSocial: 'NOVA EMPRESA LTDA',
      nomeFantasia: '',
      inscricaoEstadual: '',
      email: '',
      telefone: '',
      cep: '',
      endereco: '',
      numero: '',
      cidade: '',
      estado: '',
      logoUrl: 'https://example.com/logo.png',
      logoTamanho: 110,
    });
  });

  it('preserva campos manuais ausentes ao repetir a consulta do mesmo CNPJ', () => {
    const merged = mergeCnpjLookupIntoEmpresa(
      currentEmpresa,
      { razaoSocial: 'EMPRESA ANTERIOR ATUALIZADA LTDA' },
      false,
    );

    expect(merged.email).toBe('anterior@empresa.com');
    expect(merged.endereco).toBe('Rua Antiga');
  });
});

describe('empresaService.buscarCnpj', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta apenas os 14 dígitos e entrega todos os campos de endereço', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(brasilApiFixture),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await empresaService.buscarCnpj('11.222.333/0001-81');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cnpj/v1/11222333000181',
      {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
    expect(result).toMatchObject({
      cep: '01001-000',
      endereco: 'PRAÇA DA SÉ',
      numero: '100',
      cidade: 'SÃO PAULO',
      estado: 'SP',
    });
  });
});
