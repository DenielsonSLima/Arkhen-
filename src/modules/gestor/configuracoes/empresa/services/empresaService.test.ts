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
  razao_social: 'BARRETO & MACHADO ASSESSORIA E CONSULTORIA CONTABIL LTDA',
  nome_fantasia: 'B & M ASSESSORIA E CONSULTORIA CONTABIL',
  email: null,
  ddd_telefone_1: '7999468900',
  cep: '49500151',
  descricao_tipo_de_logradouro: 'RUA',
  logradouro: 'ANTONIO DULTRA',
  numero: '1169',
  municipio: 'ITABAIANA',
  uf: 'se',
};

describe('mapBrasilApiCnpjToEmpresa', () => {
  it('mapeia o endereço e o telefone no formato atual da BrasilAPI', () => {
    expect(mapBrasilApiCnpjToEmpresa(brasilApiFixture)).toEqual({
      razaoSocial: 'BARRETO & MACHADO ASSESSORIA E CONSULTORIA CONTABIL LTDA',
      nomeFantasia: 'B & M ASSESSORIA E CONSULTORIA CONTABIL',
      telefone: '(79) 9946-8900',
      cep: '49500-151',
      endereco: 'RUA ANTONIO DULTRA',
      numero: '1169',
      cidade: 'ITABAIANA',
      estado: 'SE',
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
    cnpj: '35.898.750/0001-07',
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

    const result = await empresaService.buscarCnpj('35.898.750/0001-07');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cnpj/v1/35898750000107',
      {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
    expect(result).toMatchObject({
      cep: '49500-151',
      endereco: 'RUA ANTONIO DULTRA',
      numero: '1169',
      cidade: 'ITABAIANA',
      estado: 'SE',
    });
  });
});
