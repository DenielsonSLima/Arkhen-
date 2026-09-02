import { supabase } from '../../../../../lib/supabase';
import { cnpjLookupService } from '../../../gestao-empresarial/services/cnpjLookupService';

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
    const data = await cnpjLookupService.lookup(cnpj);

    return {
      cnpj: data.cnpj,
      razaoSocial: data.razaoSocial,
      nomeFantasia: data.nome,
      email: data.email || '',
      telefone: data.telefone || '',
      cep: data.cep || '',
      endereco: data.logradouro || data.endereco || '',
      numero: data.numero || '',
      cidade: data.cidade || '',
      estado: data.uf || '',
    };
  },
};
