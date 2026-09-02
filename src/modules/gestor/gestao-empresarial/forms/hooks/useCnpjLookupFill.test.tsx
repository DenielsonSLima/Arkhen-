// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { CatalogoItem } from '../../../parametrizacao/services/catalogosService';
import type { CompanyLookupDraft } from '../../services/cnpjLookupService';
import type { RegimeClienteForm } from '../clienteFormModel';
import { useCnpjLookupFill } from './useCnpjLookupFill';

const companyTypes: CatalogoItem[] = [{
  id: 'mei-id', codigo: 'mei', nome: 'MEI', descricao: '', sistema: true, ativo: true, ordem: 1,
}];
const legalNatures: CatalogoItem[] = [{
  id: 'ltda-id', codigo: 'sociedade_limitada', nome: 'Sociedade Limitada (LTDA)',
  descricao: '', sistema: true, ativo: true, ordem: 1,
}];

const emptyLookup = (cnpj: string): CompanyLookupDraft => ({
  cnpj,
  razaoSocial: 'Empresa Nova',
  nome: 'Empresa Nova',
  cnae: '',
  email: '',
  telefone: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
});

const useHarness = ({
  currentCnpj,
  knownCnpj,
  lookup,
}: {
  currentCnpj: string;
  knownCnpj?: string;
  lookup: (cnpj: string) => Promise<CompanyLookupDraft>;
}) => {
  const [razaoSocial, setRazaoSocial] = useState('Razão antiga');
  const [nomeFantasia, setNomeFantasia] = useState('Nome antigo');
  const [cnae, setCnae] = useState('1234567');
  const [cnaeDescricao, setCnaeDescricao] = useState('Descrição antiga');
  const [email, setEmail] = useState('antigo@empresa.com');
  const [telefone, setTelefone] = useState('(00) 0000-0000');
  const [endereco, setEndereco] = useState('Rua antiga');
  const [bairro, setBairro] = useState('Bairro antigo');
  const [cep, setCep] = useState('00000-000');
  const [cidade, setCidade] = useState('Cidade antiga');
  const [uf, setUf] = useState('SE');
  const [capitalSocial, setCapitalSocial] = useState('100');
  const [tipo, setTipo] = useState<RegimeClienteForm>('Lucro Real');
  const [tipoEmpresaId, setTipoEmpresaId] = useState('porte-antigo');
  const [naturezaJuridicaId, setNaturezaJuridicaId] = useState('natureza-antiga');
  const [snapshot, setSnapshot] = useState<CompanyLookupDraft>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const result = useCnpjLookupFill({
    cnpj: currentCnpj,
    knownCnpj,
    companyTypes,
    legalNatures,
    onSearchCNPJ: lookup,
    successText: 'Dados atualizados',
    setters: {
      razaoSocial: setRazaoSocial,
      nomeFantasia: setNomeFantasia,
      cnae: setCnae,
      cnaeDescricao: setCnaeDescricao,
      email: setEmail,
      telefone: setTelefone,
      endereco: setEndereco,
      bairro: setBairro,
      cep: setCep,
      cidade: setCidade,
      uf: setUf,
      capitalSocial: setCapitalSocial,
      tipo: setTipo,
      tipoEmpresaId: setTipoEmpresaId,
      naturezaJuridicaId: setNaturezaJuridicaId,
      snapshot: setSnapshot,
      error: setError,
      success: setSuccess,
    },
  });

  return {
    ...result,
    values: {
      razaoSocial, nomeFantasia, cnae, cnaeDescricao, email, telefone, endereco,
      bairro, cep, cidade, uf, capitalSocial, tipo, tipoEmpresaId,
      naturezaJuridicaId, snapshot, error, success,
    },
  };
};

describe('useCnpjLookupFill', () => {
  afterEach(cleanup);

  it('clears fields from a prior CNPJ when the new response has no value', async () => {
    const lookup = vi.fn().mockResolvedValue(emptyLookup('19.131.243/0001-97'));
    const hook = renderHook(() => useHarness({
      currentCnpj: '19.131.243/0001-97',
      knownCnpj: '27.865.757/0001-02',
      lookup,
    }));

    await act(async () => { await hook.result.current.handleLookup(); });

    expect(hook.result.current.values).toMatchObject({
      razaoSocial: 'Empresa Nova',
      email: '',
      cnae: '',
      capitalSocial: '',
      tipo: '',
      tipoEmpresaId: '',
      naturezaJuridicaId: '',
    });
  });

  it('preserves manual values omitted by the API for the same CNPJ', async () => {
    const lookup = vi.fn().mockResolvedValue(emptyLookup('19.131.243/0001-97'));
    const hook = renderHook(() => useHarness({
      currentCnpj: '19.131.243/0001-97',
      knownCnpj: '19.131.243/0001-97',
      lookup,
    }));

    await act(async () => { await hook.result.current.handleLookup(); });

    expect(hook.result.current.values.email).toBe('antigo@empresa.com');
    expect(hook.result.current.values.tipo).toBe('Lucro Real');
    expect(hook.result.current.values.tipoEmpresaId).toBe('porte-antigo');
  });

  it('maps official MEI and LTDA data without treating MEI as a tax regime', async () => {
    const lookup = vi.fn().mockResolvedValue({
      ...emptyLookup('00.000.000/E08G-12'),
      enquadramento: 'MEI',
      regimeTributario: 'Simples Nacional',
      naturezaJuridicaCodigo: '2062',
      naturezaJuridica: 'Sociedade Empresária Limitada',
    } satisfies CompanyLookupDraft);
    const hook = renderHook(() => useHarness({
      currentCnpj: '00.000.000/E08G-12',
      lookup,
    }));

    await act(async () => { await hook.result.current.handleLookup(); });

    expect(hook.result.current.values.tipo).toBe('Simples Nacional');
    expect(hook.result.current.values.tipoEmpresaId).toBe('mei-id');
    expect(hook.result.current.values.naturezaJuridicaId).toBe('ltda-id');
  });
});
