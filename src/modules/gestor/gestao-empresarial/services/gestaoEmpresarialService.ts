import { supabase } from '../../../../lib/supabase';
import { planosContratacaoService } from '../../configuracoes/armazenamento/services/planosContratacaoService';

export interface SalaryHistoryEntry {
  data: string;
  motivo: string;
  valor: number;
}

export interface AdmissionDocumentCheck {
  nome: string;
  status: 'Entregue' | 'Pendente';
}

export interface Employee {
  id: string;
  nome: string;
  cargo: string;
  dataAdmissao: string;
  salario: number;
  status: 'Ativo' | 'Afastado' | 'Desligado';
  cpf: string;
  rg: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  filhosCount: number;
  historicoSalario: SalaryHistoryEntry[];
  documentosAdmissao: AdmissionDocumentCheck[];
}

export interface CompanyDocument {
  id: string;
  nome: string;
  tipo: string;
  dataUpload: string;
  tamanho: string;
  url?: string;
  pasta?: string;
  descricao?: string;
  dataValidade?: string;
  storagePath?: string;
  mimeType?: string;
  tamanhoBytes?: number;
  scope?: 'pessoal' | 'empresa';
  companyId?: string;
}

export interface CertificadoDigital {
  id: string;
  tipo: 'e-CNPJ Empresa' | 'e-CNPJ Filial' | 'e-CPF Sócio' | 'NF-e/NFC-e' | 'Outros';
  descricao: string;
  titular: string;
  dataEnvio: string;
  dataValidade: string;
  senha: string;
  arquivoNome: string;
}

export interface Partner {
  id: string;
  nome: string;
  participacao: number; // Percentagem (ex: 60)
  capital: number; // Capital integralizado em R$
  cargo: 'Sócio-Administrador' | 'Sócio Quotista';
}

export interface ClientBranch {
  id: string;
  companyId: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  bairro?: string;
  contato?: string;
  ativo: boolean;
  endereco?: string;
  cep?: string;
}

export interface CorporateEvent {
  id: string;
  data: string;
  titulo: string;
  descricao: string;
  documentoAssociado?: string;
}

export interface Company {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  tipo: 'PF' | 'MEI' | 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'Isenta';
  categoriaCliente?: string;
  tipoEstabelecimento: 'Matriz' | 'Filial';
  logo?: string;
  funcionariosCount: number;
  status: 'Ativa' | 'Inativa';
  email: string;
  telefone: string;
  endereco: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  bairro?: string;
  contato?: string;
  inscricaoEstadual?: string;
  funcionarios: Employee[];
  ferias: Vacation[];
  documentos: CompanyDocument[];
  pastasDocumentos?: string[];
  categoriasDocumentos?: string[];
  capitalSocial?: number;
  socios?: Partner[];
  historicoCorporativo?: CorporateEvent[];
  certificados?: CertificadoDigital[];
  polos?: ClientBranch[];
}

export interface Vacation {
  id: string;
  funcionarioNome: string;
  cargo: string;
  dataInicio: string;
  dataFim: string;
  status: 'Agendada' | 'Gozando' | 'Gozada';
  dias: number;
}

type CompanyType = Company['tipo'];
type CompanyStatus = Company['status'];
type CompanyEstablishmentType = Company['tipoEstabelecimento'];

interface ClienteRow {
  id: string;
  nome: string | null;
  razao_social: string | null;
  cnpj: string | null;
  tipo: CompanyType | null;
  categoria_cliente: string | null;
  tipo_estabelecimento: CompanyEstablishmentType | null;
  logo: string | null;
  funcionarios_count: number | null;
  status: CompanyStatus | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  bairro: string | null;
  contato: string | null;
  inscricao_estadual: string | null;
  funcionarios: Employee[] | null;
  ferias: Vacation[] | null;
  documentos: CompanyDocument[] | null;
  pastas_documentos: string[] | null;
  categorias_documentos: string[] | null;
  capital_social: number | null;
  socios: Partner[] | null;
  historico_corporativo: CorporateEvent[] | null;
  certificados: CertificadoDigital[] | null;
  polos: ClientBranch[] | null;
}

const extractLocationFromAddress = (endereco = '') => {
  const match = endereco.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})\s*$/);
  return {
    cidade: match?.[1]?.trim() || '',
    uf: match?.[2]?.trim() || '',
  };
};

const normalizeCompany = (company: Company): Company => {
  const location = extractLocationFromAddress(company.endereco);
  return {
    ...company,
    cidade: company.cidade || location.cidade,
    uf: company.uf || location.uf,
    cep: company.cep || '',
    bairro: company.bairro || '',
    contato: company.contato || '',
    inscricaoEstadual: company.inscricaoEstadual || '',
    polos: (company.polos || []).map(p => ({
      ...p,
      bairro: p.bairro || '',
      contato: p.contato || '',
    })),
  };
};

const mapRowToCompany = (row: ClienteRow): Company => normalizeCompany({
  id: row.id,
  nome: row.nome || '',
  razaoSocial: row.razao_social || row.nome || '',
  cnpj: row.cnpj || '',
  tipo: row.tipo || 'Simples Nacional',
  categoriaCliente: row.categoria_cliente || undefined,
  tipoEstabelecimento: row.tipo_estabelecimento || 'Matriz',
  logo: row.logo || undefined,
  funcionariosCount: row.funcionarios_count || row.funcionarios?.length || 0,
  status: row.status || 'Ativa',
  email: row.email || '',
  telefone: row.telefone || '',
  endereco: row.endereco || '',
  cidade: row.cidade || '',
  uf: row.uf || '',
  cep: row.cep || '',
  bairro: row.bairro || '',
  contato: row.contato || '',
  inscricaoEstadual: row.inscricao_estadual || '',
  funcionarios: row.funcionarios || [],
  ferias: row.ferias || [],
  documentos: row.documentos || [],
  pastasDocumentos: row.pastas_documentos || [],
  categoriasDocumentos: row.categorias_documentos || [],
  capitalSocial: row.capital_social || undefined,
  socios: row.socios || [],
  historicoCorporativo: row.historico_corporativo || [],
  certificados: row.certificados || [],
  polos: row.polos || [],
});

const mapCompanyToPayload = (company: Company) => ({
  nome: company.nome || '',
  razao_social: company.razaoSocial || company.nome || '',
  cnpj: company.cnpj || '',
  tipo: company.tipo || 'Simples Nacional',
  categoria_cliente: company.categoriaCliente || null,
  tipo_estabelecimento: company.tipoEstabelecimento || 'Matriz',
  logo: company.logo || null,
  funcionarios_count: company.funcionarios?.length || company.funcionariosCount || 0,
  status: company.status || 'Ativa',
  email: company.email || '',
  telefone: company.telefone || '',
  endereco: company.endereco || '',
  cidade: company.cidade || null,
  uf: company.uf || null,
  cep: company.cep || null,
  bairro: company.bairro || null,
  contato: company.contato || null,
  inscricao_estadual: company.inscricaoEstadual || null,
  funcionarios: company.funcionarios || [],
  ferias: company.ferias || [],
  documentos: company.documentos || [],
  pastas_documentos: company.pastasDocumentos || [],
  categorias_documentos: company.categoriasDocumentos || [],
  capital_social: company.capitalSocial || null,
  socios: company.socios || [],
  historico_corporativo: company.historicoCorporativo || [],
  certificados: company.certificados || [],
  polos: company.polos || [],
});

export const gestaoEmpresarialService = {
  async getCompanies(): Promise<Company[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao buscar clientes: ${error.message}`);
    return ((data || []) as ClienteRow[]).map(mapRowToCompany);
  },

  async getCompanyById(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar cliente: ${error.message}`);
    return data ? mapRowToCompany(data as ClienteRow) : null;
  },

  async saveCompany(updatedCompany: Company): Promise<Company> {
    const payload = mapCompanyToPayload(updatedCompany);

    if (updatedCompany.id) {
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', updatedCompany.id)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
      return mapRowToCompany(data as ClienteRow);
    }

    await planosContratacaoService.assertCanCreateCompany();

    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Erro ao cadastrar cliente: ${error.message}`);
    return mapRowToCompany(data as ClienteRow);
  },

  async getCompanyDocumentCount(id: string): Promise<number> {
    const { count, error } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .eq('scope', 'empresa')
      .eq('cliente_id', id);

    if (error) throw new Error(`Erro ao verificar documentos do cliente: ${error.message}`);

    const { data: company, error: companyError } = await supabase
      .from('clientes')
      .select('documentos')
      .eq('id', id)
      .maybeSingle();

    if (companyError) throw new Error(`Erro ao verificar documentos do cliente: ${companyError.message}`);

    const legacyDocuments = Array.isArray((company as Pick<ClienteRow, 'documentos'> | null)?.documentos)
      ? ((company as Pick<ClienteRow, 'documentos'>).documentos?.length || 0)
      : 0;

    return (count || 0) + legacyDocuments;
  },

  async deleteCompany(id: string): Promise<void> {
    const documentCount = await this.getCompanyDocumentCount(id);
    if (documentCount > 0) {
      throw new Error('Este cliente possui arquivos em Documentos. Apague os arquivos da empresa antes de excluir o cadastro ou inative a empresa.');
    }

    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir cliente: ${error.message}`);
  },

  async inativarCompany(id: string): Promise<void> {
    const { error } = await supabase.from('clientes').update({ status: 'Inativa' }).eq('id', id);
    if (error) throw new Error(`Erro ao inativar cliente: ${error.message}`);
  },

  async reativarCompany(id: string): Promise<void> {
    const { error } = await supabase.from('clientes').update({ status: 'Ativa' }).eq('id', id);
    if (error) throw new Error(`Erro ao reativar cliente: ${error.message}`);
  },

};
