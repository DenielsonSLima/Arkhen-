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
});

export const empresaService = {
  async getDadosEmpresa(): Promise<EmpresaDados> {
    const { data, error } = await supabase
      .from('configuracoes_empresa')
      .select('razao_social,nome_fantasia,cnpj,inscricao_estadual,email,telefone,cep,endereco,numero,cidade,estado,logo_url')
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

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!response.ok) {
      throw new Error('Não foi possível encontrar dados para este CNPJ.');
    }

    const data = await response.json();

    return {
      razaoSocial: data.razao_social || '',
      nomeFantasia: data.nome_fantasia || '',
      email: data.email || '',
      telefone: data.ddd_telefone1 
        ? `(${data.ddd_telefone1.substring(0, 2)}) ${data.ddd_telefone1.substring(2)}` 
        : '',
      cep: data.cep || '',
      endereco: data.logradouro || '',
      numero: data.numero || '',
      cidade: data.municipio || '',
      estado: data.uf || '',
    };
  },
};
