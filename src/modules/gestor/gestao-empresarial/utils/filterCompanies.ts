import type { Company } from '../services/gestaoEmpresarialService';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const filterCompanies = (
  companies: Company[],
  searchQuery: string,
  selectedRegime: string,
  activeStatusTab: 'Ativos' | 'Inativos',
) => {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');
  const documentQuery = digitsOnly(searchQuery);

  return companies.filter((company) => {
    const matchesText = !normalizedQuery || [
      company.nome,
      company.razaoSocial,
      company.categoriaCliente || '',
      company.cidade || '',
      company.uf || '',
    ].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
    const matchesDocument = documentQuery.length > 0
      && digitsOnly(company.cnpj).includes(documentQuery);
    const matchesRegime = selectedRegime === 'Todos' || company.tipo === selectedRegime;
    const matchesStatus = activeStatusTab === 'Ativos'
      ? company.status !== 'Inativa'
      : company.status === 'Inativa';

    return (matchesText || matchesDocument) && matchesRegime && matchesStatus;
  });
};
