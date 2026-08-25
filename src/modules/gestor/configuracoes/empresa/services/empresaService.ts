import { supabase } from '../../../../../lib/supabase';

export interface EmpresaDados {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  cidade: string;
  estado: string;
  logoUrl: string | null;
  logoTamanho: number; // logo size in pixels
}

interface EmpresaRow {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  cidade: string;
  estado: string;
  logo_url: string | null;
  logo_tamanho: number;
}

interface BrasilApiCnpjResponse {
  razao_social?: unknown;
  nome_fantasia?: unknown;
  email?: unknown;
  ddd_telefone_1?: unknown;
  ddd_telefone1?: unknown;
  cep?: unknown;
  descricao_tipo_de_logradouro?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  municipio?: unknown;
  uf?: unknown;
}

const emptyEmpresaDados: EmpresaDados = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  cidade: '',
  estado: '',
  logoUrl: null,
  logoTamanho: 80,
};

const fromRow = (row: EmpresaRow | null): EmpresaDados => {
  if (!row) return emptyEmpresaDados;

  return {
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    cnpj: row.cnpj,
    inscricaoEstadual: row.inscricao_estadual,
    email: row.email,
    telefone: row.telefone,
    cep: row.cep,
    endereco: row.endereco,
    numero: row.numero,
    cidade: row.cidade,
    estado: row.estado,
    logoUrl: row.logo_url,
    logoTamanho: row.logo_tamanho ?? 80,
  };
};

const toPayload = (dados: EmpresaDados) => ({
  razao_social: dados.razaoSocial,
  nome_fantasia: dados.nomeFantasia,
  cnpj: dados.cnpj,
  inscricao_estadual: dados.inscricaoEstadual,
  email: dados.email,
  telefone: dados.telefone,
  cep: dados.cep,
  endereco: dados.endereco,
  numero: dados.numero,
  cidade: dados.cidade,
  estado: dados.estado,
  logo_url: dados.logoUrl,
  logo_tamanho: dados.logoTamanho ?? 80,
});

const asText = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  return '';
};

const formatCep = (value: unknown) => {
  const digits = asText(value).replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : asText(value);
};

const formatPhone = (value: unknown) => {
  const digits = asText(value).replace(/\D/g, '');

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return asText(value);
};

const buildStreet = (data: BrasilApiCnpjResponse) => {
  const street = asText(data.logradouro);
  const streetType = asText(data.descricao_tipo_de_logradouro);
  const normalizedStreet = street.toLocaleUpperCase('pt-BR');
  const normalizedStreetType = streetType.toLocaleUpperCase('pt-BR');

  if (
    !street
    || !streetType
    || normalizedStreet === normalizedStreetType
    || normalizedStreet.startsWith(`${normalizedStreetType} `)
  ) {
    return street;
  }

  return `${streetType} ${street}`;
};

export const mapBrasilApiCnpjToEmpresa = (data: BrasilApiCnpjResponse): Partial<EmpresaDados> => {
  const mappedValues: Array<[keyof EmpresaDados, string]> = [
    ['razaoSocial', asText(data.razao_social)],
    ['nomeFantasia', asText(data.nome_fantasia)],
    ['email', asText(data.email)],
    ['telefone', formatPhone(data.ddd_telefone_1 ?? data.ddd_telefone1)],
    ['cep', formatCep(data.cep)],
    ['endereco', buildStreet(data)],
    ['numero', asText(data.numero)],
    ['cidade', asText(data.municipio)],
    ['estado', asText(data.uf).toLocaleUpperCase('pt-BR')],
  ];

  return mappedValues.reduce<Partial<EmpresaDados>>((result, [field, value]) => {
    if (value) {
      Object.assign(result, { [field]: value });
    }
    return result;
  }, {});
};

const emptyCompanyLookupFields: Pick<
  EmpresaDados,
  | 'razaoSocial'
  | 'nomeFantasia'
  | 'inscricaoEstadual'
  | 'email'
  | 'telefone'
  | 'cep'
  | 'endereco'
  | 'numero'
  | 'cidade'
  | 'estado'
> = {
  razaoSocial: '',
  nomeFantasia: '',
  inscricaoEstadual: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  cidade: '',
  estado: '',
};

export const mergeCnpjLookupIntoEmpresa = (
  current: EmpresaDados,
  lookup: Partial<EmpresaDados>,
  isDifferentCnpj: boolean,
): EmpresaDados => ({
  ...current,
  ...(isDifferentCnpj ? emptyCompanyLookupFields : {}),
  ...lookup,
});

export const empresaService = {
  async getDadosEmpresa(): Promise<EmpresaDados> {
    const { data, error } = await supabase
      .from('configuracoes_empresa')
      .select('razao_social,nome_fantasia,cnpj,inscricao_estadual,email,telefone,cep,endereco,numero,cidade,estado,logo_url,logo_tamanho')
      .maybeSingle<EmpresaRow>();

    if (error) throw error;
    return fromRow(data);
  },

  async updateDadosEmpresa(dados: EmpresaDados): Promise<EmpresaDados> {
    const { data, error } = await supabase.rpc('upsert_configuracoes_empresa', {
      p_payload: toPayload(dados),
    });

    if (error) throw error;
    return fromRow(data as EmpresaRow);
  },

  /**
   * Consulta a API pública do BrasilAPI para buscar dados cadastrais do CNPJ
   */
  async buscarCnpj(cnpj: string): Promise<Partial<EmpresaDados>> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      throw new Error('O CNPJ deve conter 14 dígitos.');
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Não foi possível encontrar dados para este CNPJ.');
    }

    const data = await response.json() as BrasilApiCnpjResponse;
    const mapped = mapBrasilApiCnpjToEmpresa(data);

    if (!mapped.razaoSocial && !mapped.endereco) {
      throw new Error('A consulta retornou dados incompletos para este CNPJ.');
    }

    return mapped;
  },
};
