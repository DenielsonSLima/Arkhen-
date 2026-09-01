import {
  catalogosService,
  type CatalogoDefaultItem,
  type CatalogoItem,
} from './catalogosService';

export interface CategoriaCliente {
  id: string;
  nome: string;
  descricao: string;
  status: 'Ativa' | 'Inativa';
  sistema: boolean;
}

const DEFAULT_CATEGORIAS: CatalogoDefaultItem[] = [
  {
    codigo: 'cliente_contabil',
    nome: 'Cliente Contábil',
    descricao: 'Categoria padrão para clientes contábeis.',
    sistema: true,
    ordem: 10,
  },
  {
    codigo: 'pessoa_fisica',
    nome: 'Pessoa Física',
    descricao: 'Categoria para atendimento de pessoa física.',
    sistema: true,
    ordem: 20,
  },
  {
    codigo: 'entidade_isenta',
    nome: 'Entidade Isenta',
    descricao: 'Categoria para entidades isentas ou imunes.',
    sistema: true,
    ordem: 30,
  },
  {
    codigo: 'holding_patrimonial',
    nome: 'Holding / Patrimonial',
    descricao: 'Categoria para holdings e estruturas patrimoniais.',
    sistema: true,
    ordem: 40,
  },
  {
    codigo: 'outro',
    nome: 'Outro',
    descricao: 'Categoria complementar.',
    sistema: true,
    ordem: 50,
  },
];

const fromCatalogo = (item: CatalogoItem): CategoriaCliente => ({
  id: item.id,
  nome: item.nome,
  descricao: item.descricao,
  status: item.ativo ? 'Ativa' : 'Inativa',
  sistema: item.sistema,
});

export const categoriaClienteKeys = {
  all: ['parametrizacao', 'catalogos', 'categorias_clientes'] as const,
};

export const categoriaClienteService = {
  async getAll(): Promise<CategoriaCliente[]> {
    const rows = await catalogosService.list('categorias_clientes', DEFAULT_CATEGORIAS);
    return rows.map(fromCatalogo);
  },

  async save(nome: string, descricao: string): Promise<string> {
    return catalogosService.save({
      tipo: 'categorias_clientes',
      nome,
      descricao,
      ativo: true,
      sistema: false,
    });
  },

  async update(id: string, nome: string, descricao: string): Promise<string> {
    return catalogosService.save({
      id,
      tipo: 'categorias_clientes',
      nome,
      descricao,
      ativo: true,
      sistema: false,
    });
  },

  async setStatus(id: string, ativa: boolean): Promise<void> {
    await catalogosService.setAtivo(id, ativa);
  },
};
