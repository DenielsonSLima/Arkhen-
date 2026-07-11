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
    codigo: 'cliente-contabil',
    nome: 'Cliente Contábil',
    descricao: 'Empresa sob assessoria e contabilidade regular.',
  },
  {
    codigo: 'entidade-isenta',
    nome: 'Entidade Isenta',
    descricao: 'Entidades sem fins lucrativos ou orgaos isentos.',
  },
  {
    codigo: 'holding-patrimonial',
    nome: 'Holding / Patrimonial',
    descricao: 'Empresas com gestao societaria e patrimonial especifica.',
  },
  {
    codigo: 'outro',
    nome: 'Outro',
    descricao: 'Categorias de clientes gerais ou excepcionais.',
  },
  {
    codigo: 'pessoa-fisica',
    nome: 'Pessoa Física',
    descricao: 'Cliente individual sem CNPJ, rotinas de IRPF ou pessoais.',
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

  async save(nome: string, descricao: string): Promise<void> {
    await catalogosService.save({
      tipo: 'categorias_clientes',
      nome,
      descricao,
      ativo: true,
      sistema: false,
    });
  },

  async update(id: string, nome: string, descricao: string): Promise<void> {
    await catalogosService.save({
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
