import { empresaService, type EmpresaDados } from '../../empresa/services/empresaService';
import { gestaoEmpresarialService, type Company } from '../../../gestao-empresarial/services/gestaoEmpresarialService';
type FiscalEmissorCompany = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  cidade?: string;
  uf?: string;
  contato?: string;
  email?: string;
};

export const buildOfficeCompanyFromDados = (dados: EmpresaDados): FiscalEmissorCompany => ({
  id: 'office',
  nome: dados.nomeFantasia || dados.razaoSocial,
  razaoSocial: dados.razaoSocial,
  cnpj: dados.cnpj,
  cidade: dados.cidade,
  uf: dados.estado,
  contato: dados.email || dados.telefone,
  email: dados.email,
});

export const mapToCompanyRecord = (officeCompany: FiscalEmissorCompany): Company => ({
  id: officeCompany.id,
  nome: officeCompany.nome,
  razaoSocial: officeCompany.razaoSocial,
  cnpj: officeCompany.cnpj,
  tipo: 'MEI',
  categoriaCliente: 'Contabilidade',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: officeCompany.email || '',
  telefone: officeCompany.contato || '',
  endereco: 'Configuração da empresa',
  cidade: officeCompany.cidade,
  uf: officeCompany.uf,
  cep: '',
  bairro: '',
  contato: officeCompany.contato || '',
  inscricaoEstadual: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  pastasDocumentos: [],
  categoriasDocumentos: [],
});


export const resolveCompanyName = (companyId: string, companies: Company[]) => {
  if (companyId === 'office') {
    const office = companies.find((item) => item.id === 'office');
    if (office) {
      return office.nome || office.razaoSocial || 'Escritório (contabilidade)';
    }
  }

  const company = companies.find((item) => item.id === companyId);
  return company?.nome || company?.razaoSocial || 'Empresa de emissão';
};


export async function getFiscalCompanies(): Promise<Company[]> {
  const [office, clients] = await Promise.all([empresaService.getDadosEmpresa(), gestaoEmpresarialService.getCompanies()]);
  return [mapToCompanyRecord(buildOfficeCompanyFromDados(office)), ...clients.filter(item => item.status === 'Ativa')];
}
