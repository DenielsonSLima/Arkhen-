import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CNPJ_LOOKUP_TIMEOUT_MS,
  cnpjLookupService,
  isValidCnpj,
} from './cnpjLookupService';

const VALID_CNPJ = '19131243000197';
const FORMATTED_CNPJ = '19.131.243/0001-97';
const ALPHANUMERIC_CNPJ = '00.000.000/E08G-12';

function responseWith(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('cnpjLookupService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    FORMATTED_CNPJ,
    VALID_CNPJ,
    ALPHANUMERIC_CNPJ,
  ])('valida CNPJ numérico ou alfanumérico: %s', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });

  it.each([
    '',
    '11.111.111/1111-11',
    '19.131.243/0001-98',
    '1913124300019',
  ])('rejeita CNPJ inválido antes de chamar a API: %s', async (cnpj) => {
    await expect(cnpjLookupService.lookup(cnpj)).rejects.toThrow('CNPJ inválido');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mapeia o máximo de dados oficiais e preserva zero no capital social', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: '  Empresa Exemplo LTDA  ',
      nome_fantasia: ' Empresa Exemplo ',
      cnae_fiscal: 6201501,
      cnae_fiscal_descricao: 'Desenvolvimento de programas de computador sob encomenda',
      cnaes_secundarios: [
        { codigo: 6202300, descricao: 'Desenvolvimento e licenciamento de programas customizáveis' },
        { codigo: '6202300', descricao: 'Duplicado' },
        { codigo: '', descricao: 'Sem código' },
      ],
      email: 'contato@exemplo.com',
      ddd_telefone_1: '4130607000',
      ddd_telefone_2: '41999998888',
      ddd_fax: '4133334444',
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Sala 4',
      bairro: 'Centro',
      municipio: 'Curitiba',
      uf: 'pr',
      cep: '80000000',
      codigo_porte: 3,
      descricao_porte: 'EMPRESA DE PEQUENO PORTE',
      opcao_pelo_mei: true,
      opcao_pelo_simples: true,
      data_opcao_pelo_mei: '2020-01-02',
      data_exclusao_do_mei: null,
      data_opcao_pelo_simples: '2019-02-03',
      data_exclusao_do_simples: null,
      natureza_juridica: 'Sociedade Empresária Limitada',
      codigo_natureza_juridica: 2062,
      regime_tributario: [
        {
          ano: 2024,
          cnpj_da_scp: '00.000.000/E08G-12',
          forma_de_tributacao: 'LUCRO PRESUMIDO',
          quantidade_de_escrituracoes: 2,
        },
        { ano: '2023', forma_de_tributacao: 'SIMPLES NACIONAL', quantidade_de_escrituracoes: '1' },
        { ano: 2022 },
      ],
      capital_social: 0,
      situacao_cadastral: 2,
      descricao_situacao_cadastral: 'ATIVA',
      data_situacao_cadastral: '2021-03-04',
      motivo_situacao_cadastral: 0,
      descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
      situacao_especial: 'EM INTERVENÇÃO',
      data_situacao_especial: '2022-04-05',
      data_inicio_atividade: '2010-05-21',
      identificador_matriz_filial: 1,
      descricao_identificador_matriz_filial: 'MATRIZ',
      pais: 'BRASIL',
      codigo_pais: 1058,
      nome_cidade_no_exterior: '',
      codigo_municipio: 7535,
      codigo_municipio_ibge: 4106902,
      ente_federativo_responsavel: 'UNIÃO',
      qualificacao_do_responsavel: 16,
      descricao_tipo_de_logradouro: 'RUA',
      qsa: [{
        nome_socio: 'Sócia Exemplo',
        qualificacao_socio: 'Sócio-Administrador',
        codigo_qualificacao_socio: 49,
        data_entrada_sociedade: '2018-06-07',
        identificador_de_socio: 2,
        pais: 'BRASIL',
        codigo_pais: 1058,
        faixa_etaria: 'Entre 31 a 40 anos',
        codigo_faixa_etaria: 4,
        nome_representante_legal: 'Representante Exemplo',
        qualificacao_representante_legal: 'Procurador',
        codigo_qualificacao_representante_legal: 5,
        cnpj_cpf_do_socio: '***123456**',
        cpf_representante_legal: '***987654**',
      }],
    }));

    const result = await cnpjLookupService.lookup(FORMATTED_CNPJ);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://brasilapi.com.br/api/cnpj/v1/${VALID_CNPJ}`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({
      cnpj: FORMATTED_CNPJ,
      razaoSocial: 'Empresa Exemplo LTDA',
      nome: 'Empresa Exemplo',
      cnae: '6201501',
      cnaeDescricao: 'Desenvolvimento de programas de computador sob encomenda',
      cnaesSecundarios: [{
        codigo: '6202300',
        descricao: 'Desenvolvimento e licenciamento de programas customizáveis',
      }],
      qsa: [{
        nome: 'Sócia Exemplo',
        qualificacao: 'Sócio-Administrador',
        codigoQualificacao: '49',
        dataEntradaSociedade: '2018-06-07',
        tipoSocio: 'Pessoa física',
        tipoSocioCodigo: '2',
        pais: 'BRASIL',
        codigoPais: '1058',
        faixaEtaria: 'Entre 31 a 40 anos',
        codigoFaixaEtaria: '4',
        nomeRepresentanteLegal: 'Representante Exemplo',
        qualificacaoRepresentanteLegal: 'Procurador',
        codigoQualificacaoRepresentanteLegal: '5',
      }],
      email: 'contato@exemplo.com',
      telefone: '(41) 3060-7000',
      telefoneAlternativo: '(41) 99999-8888',
      fax: '(41) 3333-4444',
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Sala 4',
      endereco: 'Rua das Flores, 123 - Sala 4',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '80000000',
      enquadramento: 'MEI',
      porteOficial: 'EMPRESA DE PEQUENO PORTE',
      naturezaJuridica: 'Sociedade Empresária Limitada',
      naturezaJuridicaCodigo: '2062',
      regimeTributario: 'Simples Nacional',
      regimeTributarioHistorico: [
        {
          ano: 2024,
          cnpjSCP: '00.000.000/E08G-12',
          formaTributacao: 'LUCRO PRESUMIDO',
          quantidadeEscrituracoes: 2,
        },
        { ano: 2023, formaTributacao: 'SIMPLES NACIONAL', quantidadeEscrituracoes: 1 },
      ],
      opcaoPeloSimples: true,
      dataOpcaoPeloSimples: '2019-02-03',
      dataExclusaoDoSimples: undefined,
      opcaoPeloMei: true,
      dataOpcaoPeloMei: '2020-01-02',
      dataExclusaoDoMei: undefined,
      capitalSocial: 0,
      situacaoCadastral: 'ATIVA',
      situacaoCadastralCodigo: '2',
      dataSituacaoCadastral: '2021-03-04',
      motivoSituacaoCadastral: 'SEM MOTIVO',
      motivoSituacaoCadastralCodigo: '0',
      situacaoEspecial: 'EM INTERVENÇÃO',
      dataSituacaoEspecial: '2022-04-05',
      dataInicioAtividade: '2010-05-21',
      identificadorMatrizFilial: 'MATRIZ',
      identificadorMatrizFilialCodigo: '1',
      pais: 'BRASIL',
      codigoPais: '1058',
      nomeCidadeExterior: undefined,
      codigoMunicipio: '7535',
      codigoMunicipioIbge: '4106902',
      enteFederativoResponsavel: 'UNIÃO',
      qualificacaoResponsavelCodigo: '16',
      descricaoTipoLogradouro: 'RUA',
    });
    expect(JSON.stringify(result.qsa)).not.toContain('***123456**');
    expect(JSON.stringify(result.qsa)).not.toContain('***987654**');
    expect(result.naturezaJuridica).not.toContain('SLU');
  });

  it.each([
    [1, 'ME'],
    ['03', 'EPP'],
    [5, 'Demais'],
  ] as const)('mapeia o código oficial de porte %s para %s', async (codigoPorte, expected) => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: 'Empresa',
      codigo_porte: codigoPorte,
      opcao_pelo_mei: false,
      opcao_pelo_simples: false,
    }));

    const result = await cnpjLookupService.lookup(VALID_CNPJ);

    expect(result.enquadramento).toBe(expected);
    expect(result.regimeTributario).toBeUndefined();
  });

  it('não inventa enquadramento ou regime para códigos e sinais inconclusivos', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: 'Empresa',
      codigo_porte: 2,
      descricao_porte: 'PORTE NÃO MAPEADO',
      opcao_pelo_mei: null,
      opcao_pelo_simples: false,
      regime_tributario: [{ ano: 2024, forma_de_tributacao: 'LUCRO REAL' }],
    }));

    const result = await cnpjLookupService.lookup(VALID_CNPJ);

    expect(result.enquadramento).toBeUndefined();
    expect(result.regimeTributario).toBeUndefined();
    expect(result.regimeTributarioHistorico).toEqual([
      { ano: 2024, formaTributacao: 'LUCRO REAL', quantidadeEscrituracoes: undefined },
    ]);
  });

  it('marca Simples Nacional apenas quando a opção atual é positiva', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: 'Empresa',
      opcao_pelo_mei: false,
      opcao_pelo_simples: true,
    }));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).resolves.toMatchObject({
      regimeTributario: 'Simples Nacional',
    });
  });

  it('consulta CNPJ alfanumérico sem remover letras', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: '00000000E08G12',
      razao_social: 'Empresa Alfanumérica',
    }));

    await expect(cnpjLookupService.lookup(ALPHANUMERIC_CNPJ)).resolves.toMatchObject({
      cnpj: ALPHANUMERIC_CNPJ,
      razaoSocial: 'Empresa Alfanumérica',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cnpj/v1/00000000E08G12',
      expect.any(Object),
    );
  });

  it('preserva o zero à esquerda nos códigos CNAE numéricos', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: 'Empresa',
      cnae_fiscal: 112304,
      cnaes_secundarios: [{ codigo: 12345, descricao: 'Atividade secundária' }],
    }));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).resolves.toMatchObject({
      cnae: '0112304',
      cnaesSecundarios: [{ codigo: '0012345', descricao: 'Atividade secundária' }],
    });
  });

  it('mantém compatibilidade com CNAE legado e usa o segundo telefone quando é o único disponível', async () => {
    fetchMock.mockResolvedValueOnce(responseWith({
      cnpj: VALID_CNPJ,
      razao_social: 'Empresa sem fantasia',
      atividade_principal: [{ code: '8630503', text: 'Atividade médica ambulatorial' }],
      ddd_telefone_2: '79999990000',
      numero: 'S/N',
      complemento: 'Anexo',
    }));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).resolves.toMatchObject({
      nome: 'Empresa sem fantasia',
      cnae: '8630503',
      cnaeDescricao: 'Atividade médica ambulatorial',
      telefone: '(79) 99999-0000',
      telefoneAlternativo: undefined,
      endereco: 'S/N - Anexo',
    });
  });

  it.each([
    [400, 'recusou o CNPJ'],
    [404, 'CNPJ não encontrado'],
    [429, 'limite temporário'],
    [503, 'temporariamente indisponível'],
  ])('traduz HTTP %s em erro claro', async (status, message) => {
    fetchMock.mockResolvedValueOnce(responseWith({}, status));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow(message);
  });

  it('rejeita JSON inválido retornado com sucesso HTTP', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('invalid json')),
    });

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow('resposta inválida');
  });

  it('rejeita payload não estruturado e resposta de outro CNPJ', async () => {
    fetchMock
      .mockResolvedValueOnce(responseWith([]))
      .mockResolvedValueOnce(responseWith({ cnpj: '32833113000164' }));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow('resposta inválida');
    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow('dados de outro CNPJ');
  });

  it('rejeita resposta HTTP 200 vazia ou sem razão social', async () => {
    fetchMock
      .mockResolvedValueOnce(responseWith({}))
      .mockResolvedValueOnce(responseWith({ cnpj: VALID_CNPJ }));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow('resposta inválida');
    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow('resposta inválida');
  });

  it('traduz falha de rede sem expor detalhes técnicos', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed: ECONNRESET'));

    await expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow(
      'Verifique sua conexão e tente novamente',
    );
  });

  it('aborta consulta que ultrapassa o timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    }));

    const expectation = expect(cnpjLookupService.lookup(VALID_CNPJ)).rejects.toThrow(
      'demorou demais',
    );
    await vi.advanceTimersByTimeAsync(CNPJ_LOOKUP_TIMEOUT_MS);
    await expectation;
  });
});
