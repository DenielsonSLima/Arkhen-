import {
  catalogosService,
  type CatalogoDefaultItem,
  type CatalogoItem,
} from './catalogosService';

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipoDespesa: 'fixa' | 'variavel';
  status: 'Ativa' | 'Inativa';
  sistema: boolean;
}

const DEFAULT_CATEGORIAS_FINANCEIRAS: CatalogoDefaultItem[] = [
  // Fixas
  {
    codigo: 'aluguel-condominio',
    nome: 'Aluguel / Condomínio',
    descricao: 'fixa',
  },
  {
    codigo: 'honorarios-contabeis',
    nome: 'Honorários Contábeis',
    descricao: 'fixa',
  },
  {
    codigo: 'salarios-prolabore',
    nome: 'Salários e Prolabore',
    descricao: 'fixa',
  },
  {
    codigo: 'assinaturas-software-saas',
    nome: 'Assinaturas de Software / SaaS',
    descricao: 'fixa',
  },
  {
    codigo: 'servicos-terceiros-fixos',
    nome: 'Serviços de Terceiros (Fixos)',
    descricao: 'fixa',
  },
  // Variáveis
  {
    codigo: 'impostos-taxas',
    nome: 'Impostos e Taxas',
    descricao: 'variavel',
  },
  {
    codigo: 'marketing-publicidade',
    nome: 'Marketing e Publicidade',
    descricao: 'variavel',
  },
  {
    codigo: 'comissoes-vendas',
    nome: 'Comissões sobre Vendas',
    descricao: 'variavel',
  },
  {
    codigo: 'material-escritorio',
    nome: 'Material de Escritório',
    descricao: 'variavel',
  },
  {
    codigo: 'manutencao-reparos',
    nome: 'Manutenção / Reparos',
    descricao: 'variavel',
  },
  {
    codigo: 'viagens-deslocamentos',
    nome: 'Viagens e Deslocamentos',
    descricao: 'variavel',
  },
];

const fromCatalogo = (item: CatalogoItem): CategoriaFinanceira => ({
  id: item.id,
  nome: item.nome,
  tipoDespesa: (item.descricao === 'fixa' || item.descricao === 'variavel') ? item.descricao : 'variavel',
  status: item.ativo ? 'Ativa' : 'Inativa',
  sistema: item.sistema,
});

export const categoriaFinanceiraKeys = {
  all: ['parametrizacao', 'catalogos', 'categorias_financeiras'] as const,
};

export const categoriaFinanceiraService = {
  async getAll(): Promise<CategoriaFinanceira[]> {
    const rows = await catalogosService.list('categorias_financeiras', DEFAULT_CATEGORIAS_FINANCEIRAS);
    return rows.map(fromCatalogo);
  },

  async save(nome: string, tipoDespesa: 'fixa' | 'variavel'): Promise<void> {
    await catalogosService.save({
      tipo: 'categorias_financeiras',
      nome,
      descricao: tipoDespesa,
      ativo: true,
      sistema: false,
    });
  },

  async update(id: string, nome: string, tipoDespesa: 'fixa' | 'variavel', ativo = true): Promise<void> {
    await catalogosService.save({
      id,
      tipo: 'categorias_financeiras',
      nome,
      descricao: tipoDespesa,
      ativo,
      sistema: false,
    });
  },

  async setStatus(id: string, ativa: boolean): Promise<void> {
    await catalogosService.setAtivo(id, ativa);
  },
};
