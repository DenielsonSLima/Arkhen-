export type CompanyEnquadramento = 'MEI' | 'ME' | 'EPP' | 'Demais';

import { isValidCnpj, normalizeCnpj } from './cnpjDocument';

export { isValidCnpj, normalizeCnpj } from './cnpjDocument';

export type CurrentCompanyTaxRegime = 'Simples Nacional';

export interface CompanyTaxRegimeHistoryItem {
  ano?: number;
  cnpjSCP?: string;
  formaTributacao: string;
  quantidadeEscrituracoes?: number;
}

export interface CompanySecondaryCnae {
  codigo: string;
  descricao?: string;
}

export interface CompanyQsaMember {
  nome: string;
  qualificacao?: string;
  codigoQualificacao?: string;
  dataEntradaSociedade?: string;
  tipoSocio?: string;
  tipoSocioCodigo?: string;
  pais?: string;
  codigoPais?: string;
  faixaEtaria?: string;
  codigoFaixaEtaria?: string;
  nomeRepresentanteLegal?: string;
  qualificacaoRepresentanteLegal?: string;
  codigoQualificacaoRepresentanteLegal?: string;
}

export interface CompanyLookupDraft {
  cnpj: string;
  razaoSocial: string;
  nome: string;
  cnae: string;
  cnaeDescricao?: string;
  cnaesSecundarios?: CompanySecondaryCnae[];
  qsa?: CompanyQsaMember[];
  email: string;
  telefone: string;
  telefoneAlternativo?: string;
  fax?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  enquadramento?: CompanyEnquadramento;
  porteOficial?: string;
  naturezaJuridica?: string;
  naturezaJuridicaCodigo?: string;
  regimeTributario?: CurrentCompanyTaxRegime;
  regimeTributarioHistorico?: CompanyTaxRegimeHistoryItem[];
  opcaoPeloSimples?: boolean;
  dataOpcaoPeloSimples?: string;
  dataExclusaoDoSimples?: string;
  opcaoPeloMei?: boolean;
  dataOpcaoPeloMei?: string;
  dataExclusaoDoMei?: string;
  capitalSocial?: number;
  situacaoCadastral?: string;
  situacaoCadastralCodigo?: string;
  dataSituacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  motivoSituacaoCadastralCodigo?: string;
  situacaoEspecial?: string;
  dataSituacaoEspecial?: string;
  dataInicioAtividade?: string;
  identificadorMatrizFilial?: string;
  identificadorMatrizFilialCodigo?: string;
  pais?: string;
  codigoPais?: string;
  nomeCidadeExterior?: string;
  codigoMunicipio?: string;
  codigoMunicipioIbge?: string;
  enteFederativoResponsavel?: string;
  qualificacaoResponsavelCodigo?: string;
  descricaoTipoLogradouro?: string;
}

type UnknownRecord = Record<string, unknown>;

export const CNPJ_LOOKUP_TIMEOUT_MS = 10_000;

const BRASIL_API_CNPJ_URL = 'https://brasilapi.com.br/api/cnpj/v1';

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function formatPhone(value: unknown): string {
  const raw = asText(value);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return raw;
}

function resolvePhones(data: UnknownRecord): { telefone: string; telefoneAlternativo?: string } {
  const phones = [formatPhone(data.ddd_telefone_1), formatPhone(data.ddd_telefone_2)]
    .filter((phone, index, values) => Boolean(phone) && values.indexOf(phone) === index);
  return {
    telefone: phones[0] || '',
    telefoneAlternativo: phones[1] || undefined,
  };
}

function resolveAddress(data: UnknownRecord): string {
  const logradouro = asText(data.logradouro);
  const numero = asText(data.numero);
  const complemento = asText(data.complemento);
  const mainAddress = [logradouro, numero].filter(Boolean).join(', ');
  return [mainAddress, complemento].filter(Boolean).join(' - ');
}

function normalizeCnaeCode(value: unknown): string {
  const code = asText(value);
  return /^\d+$/.test(code) ? code.padStart(7, '0') : code;
}

function resolveMainCnae(data: UnknownRecord): { codigo: string; descricao?: string } {
  const atividadePrincipal = Array.isArray(data.atividade_principal)
    ? asRecord(data.atividade_principal[0])
    : null;
  const codigo = normalizeCnaeCode(
    data.cnae_fiscal
      ?? data.cnae_principal
      ?? data.cnae
      ?? atividadePrincipal?.code
      ?? atividadePrincipal?.codigo,
  );
  const descricao = asText(
    data.cnae_fiscal_descricao
      ?? data.descricao_cnae
      ?? data.atividade_principal_texto
      ?? atividadePrincipal?.text
      ?? atividadePrincipal?.descricao,
  );
  return { codigo, descricao: descricao || undefined };
}

function resolveSecondaryCnaes(value: unknown): CompanySecondaryCnae[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seenCodes = new Set<string>();
  const result = value.slice(0, 50).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const codigo = normalizeCnaeCode(row.codigo ?? row.code ?? row.cnae);
    if (!codigo || seenCodes.has(codigo)) return [];
    seenCodes.add(codigo);
    const descricao = asText(row.descricao ?? row.text);
    return [{ codigo, descricao: descricao || undefined }];
  });
  return result.length ? result : undefined;
}

const QSA_MEMBER_TYPES: Record<string, string> = {
  '1': 'Pessoa jurídica',
  '2': 'Pessoa física',
  '3': 'Estrangeiro',
};

function resolveQsa(value: unknown): CompanyQsaMember[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const result = value.slice(0, 50).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const nome = asText(row.nome_socio);
    if (!nome) return [];
    const qualificacao = asText(row.qualificacao_socio);
    const dataEntradaSociedade = asText(row.data_entrada_sociedade);
    const deduplicationKey = `${nome}\u0000${qualificacao}\u0000${dataEntradaSociedade}`;
    if (seen.has(deduplicationKey)) return [];
    seen.add(deduplicationKey);
    const tipoSocioCodigo = asText(row.identificador_de_socio);
    return [{
      nome,
      qualificacao: qualificacao || undefined,
      codigoQualificacao: asText(row.codigo_qualificacao_socio) || undefined,
      dataEntradaSociedade: dataEntradaSociedade || undefined,
      tipoSocio: QSA_MEMBER_TYPES[tipoSocioCodigo] || undefined,
      tipoSocioCodigo: tipoSocioCodigo || undefined,
      pais: asText(row.pais) || undefined,
      codigoPais: asText(row.codigo_pais) || undefined,
      faixaEtaria: asText(row.faixa_etaria) || undefined,
      codigoFaixaEtaria: asText(row.codigo_faixa_etaria) || undefined,
      nomeRepresentanteLegal: asText(row.nome_representante_legal) || undefined,
      qualificacaoRepresentanteLegal:
        asText(row.qualificacao_representante_legal) || undefined,
      codigoQualificacaoRepresentanteLegal:
        asText(row.codigo_qualificacao_representante_legal) || undefined,
    }];
  });
  return result.length ? result : undefined;
}

function resolveEnquadramento(data: UnknownRecord): CompanyEnquadramento | undefined {
  if (data.opcao_pelo_mei === true) return 'MEI';
  const codigoPorte = Number.parseInt(asText(data.codigo_porte), 10);
  if (codigoPorte === 1) return 'ME';
  if (codigoPorte === 3) return 'EPP';
  if (codigoPorte === 5) return 'Demais';
  return undefined;
}

function resolveCurrentTaxRegime(data: UnknownRecord): CurrentCompanyTaxRegime | undefined {
  return data.opcao_pelo_mei === true || data.opcao_pelo_simples === true
    ? 'Simples Nacional'
    : undefined;
}

function resolveTaxRegimeHistory(value: unknown): CompanyTaxRegimeHistoryItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.slice(0, 20).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const formaTributacao = asText(row.forma_de_tributacao ?? row.formaTributacao);
    if (!formaTributacao) return [];
    const ano = asFiniteNumber(row.ano);
    const quantidadeEscrituracoes = asFiniteNumber(
      row.quantidade_de_escrituracoes ?? row.quantidadeEscrituracoes,
    );
    return [{
      formaTributacao,
      ano: ano === undefined ? undefined : Math.trunc(ano),
      cnpjSCP: asText(row.cnpj_da_scp ?? row.cnpjSCP) || undefined,
      quantidadeEscrituracoes: quantidadeEscrituracoes === undefined
        ? undefined
        : Math.trunc(quantidadeEscrituracoes),
    }];
  });
  return result.length ? result : undefined;
}

function mapBrasilApiResponse(data: UnknownRecord, cnpjRaw: string, expectedCnpj: string): CompanyLookupDraft {
  const responseCnpj = normalizeCnpj(asText(data.cnpj));
  if (!responseCnpj) {
    throw new Error('A BrasilAPI retornou uma resposta inválida. Tente novamente.');
  }
  if (responseCnpj !== expectedCnpj) {
    throw new Error('A consulta retornou dados de outro CNPJ. Tente novamente.');
  }

  const razaoSocial = asText(data.razao_social);
  if (!razaoSocial) {
    throw new Error('A BrasilAPI retornou uma resposta inválida. Tente novamente.');
  }
  const nomeFantasia = asText(data.nome_fantasia);
  const mainCnae = resolveMainCnae(data);
  const phones = resolvePhones(data);
  const naturezaJuridica = asText(data.natureza_juridica);
  const naturezaJuridicaCodigo = asText(data.codigo_natureza_juridica);
  const porteOficial = asText(data.descricao_porte) || asText(data.porte);
  const capitalSocial = asFiniteNumber(data.capital_social);
  const situacaoCadastral = asText(data.descricao_situacao_cadastral ?? data.situacao_cadastral);
  const situacaoCadastralCodigo = asText(data.situacao_cadastral);
  const identificadorMatrizFilial = asText(data.descricao_identificador_matriz_filial);
  const identificadorMatrizFilialCodigo = asText(data.identificador_matriz_filial);
  const opcaoPeloSimples = asBoolean(data.opcao_pelo_simples);
  const opcaoPeloMei = asBoolean(data.opcao_pelo_mei);

  return {
    cnpj: cnpjRaw,
    razaoSocial,
    nome: nomeFantasia || razaoSocial,
    cnae: mainCnae.codigo,
    cnaeDescricao: mainCnae.descricao,
    cnaesSecundarios: resolveSecondaryCnaes(data.cnaes_secundarios),
    qsa: resolveQsa(data.qsa),
    email: asText(data.email),
    ...phones,
    fax: formatPhone(data.ddd_fax) || undefined,
    logradouro: asText(data.logradouro) || undefined,
    numero: asText(data.numero) || undefined,
    complemento: asText(data.complemento) || undefined,
    endereco: resolveAddress(data),
    bairro: asText(data.bairro),
    cidade: asText(data.municipio),
    uf: asText(data.uf).toUpperCase(),
    cep: asText(data.cep),
    enquadramento: resolveEnquadramento(data),
    porteOficial: porteOficial || undefined,
    naturezaJuridica: naturezaJuridica || undefined,
    naturezaJuridicaCodigo: naturezaJuridicaCodigo || undefined,
    regimeTributario: resolveCurrentTaxRegime(data),
    regimeTributarioHistorico: resolveTaxRegimeHistory(data.regime_tributario),
    opcaoPeloSimples,
    dataOpcaoPeloSimples: asText(data.data_opcao_pelo_simples) || undefined,
    dataExclusaoDoSimples: asText(data.data_exclusao_do_simples) || undefined,
    opcaoPeloMei,
    dataOpcaoPeloMei: asText(data.data_opcao_pelo_mei) || undefined,
    dataExclusaoDoMei: asText(data.data_exclusao_do_mei) || undefined,
    capitalSocial,
    situacaoCadastral: situacaoCadastral || undefined,
    situacaoCadastralCodigo: situacaoCadastralCodigo || undefined,
    dataSituacaoCadastral: asText(data.data_situacao_cadastral) || undefined,
    motivoSituacaoCadastral: asText(data.descricao_motivo_situacao_cadastral) || undefined,
    motivoSituacaoCadastralCodigo: asText(data.motivo_situacao_cadastral) || undefined,
    situacaoEspecial: asText(data.situacao_especial) || undefined,
    dataSituacaoEspecial: asText(data.data_situacao_especial) || undefined,
    dataInicioAtividade: asText(data.data_inicio_atividade) || undefined,
    identificadorMatrizFilial: identificadorMatrizFilial || undefined,
    identificadorMatrizFilialCodigo: identificadorMatrizFilialCodigo || undefined,
    pais: asText(data.pais) || undefined,
    codigoPais: asText(data.codigo_pais) || undefined,
    nomeCidadeExterior: asText(data.nome_cidade_no_exterior) || undefined,
    codigoMunicipio: asText(data.codigo_municipio) || undefined,
    codigoMunicipioIbge: asText(data.codigo_municipio_ibge) || undefined,
    enteFederativoResponsavel: asText(data.ente_federativo_responsavel) || undefined,
    qualificacaoResponsavelCodigo: asText(data.qualificacao_do_responsavel) || undefined,
    descricaoTipoLogradouro: asText(data.descricao_tipo_de_logradouro) || undefined,
  };
}

function errorForHttpStatus(status: number): Error {
  if (status === 404) return new Error('CNPJ não encontrado na BrasilAPI. Confira os caracteres informados.');
  if (status === 400 || status === 422) return new Error('A BrasilAPI recusou o CNPJ informado. Confira os caracteres e tente novamente.');
  if (status === 429) return new Error('O serviço de consulta de CNPJ atingiu o limite temporário. Tente novamente em instantes.');
  return new Error('O serviço de consulta de CNPJ está temporariamente indisponível. Tente novamente.');
}

export const cnpjLookupService = {
  async lookup(cnpjRaw: string): Promise<CompanyLookupDraft> {
    const cnpj = normalizeCnpj(cnpjRaw);
    if (!isValidCnpj(cnpj)) throw new Error('CNPJ inválido. Confira os 14 caracteres informados.');

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), CNPJ_LOOKUP_TIMEOUT_MS);

    try {
      const response = await fetch(`${BRASIL_API_CNPJ_URL}/${cnpj}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw errorForHttpStatus(response.status);

      let rawData: unknown;
      try {
        rawData = await response.json();
      } catch {
        throw new Error('A BrasilAPI retornou uma resposta inválida. Tente novamente.');
      }
      const data = asRecord(rawData);
      if (!data) throw new Error('A BrasilAPI retornou uma resposta inválida. Tente novamente.');
      return mapBrasilApiResponse(data, cnpjRaw, cnpj);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('A consulta de CNPJ demorou demais. Tente novamente.');
      }
      if (error instanceof Error && (
        error.message.startsWith('CNPJ')
        || error.message.startsWith('A BrasilAPI')
        || error.message.startsWith('A consulta')
        || error.message.startsWith('O serviço')
      )) throw error;
      throw new Error('Não foi possível consultar o CNPJ agora. Verifique sua conexão e tente novamente.');
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  },
};
