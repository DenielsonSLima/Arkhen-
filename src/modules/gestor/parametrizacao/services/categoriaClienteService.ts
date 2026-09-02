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
    codigo: 'clinica',
    nome: 'Clínica',
    descricao: 'Clínicas e estabelecimentos de serviços de saúde.',
    sistema: true,
    ordem: 10,
  },
  {
    codigo: 'comercio',
    nome: 'Comércio',
    descricao: 'Empresas de comércio varejista ou atacadista.',
    sistema: true,
    ordem: 20,
  },
  {
    codigo: 'restaurante',
    nome: 'Restaurante',
    descricao: 'Restaurantes, bares, lanchonetes e atividades de alimentação.',
    sistema: true,
    ordem: 30,
  },
  {
    codigo: 'transportadora',
    nome: 'Transportadora',
    descricao: 'Transportadoras e empresas de logística.',
    sistema: true,
    ordem: 40,
  },
  {
    codigo: 'escola',
    nome: 'Escola',
    descricao: 'Escolas, cursos e demais instituições de ensino.',
    sistema: true,
    ordem: 50,
  },
  {
    codigo: 'prestador_servicos',
    nome: 'Prestador de Serviços',
    descricao: 'Empresas e profissionais prestadores de serviços.',
    sistema: true,
    ordem: 60,
  },
  {
    codigo: 'industria',
    nome: 'Indústria',
    descricao: 'Empresas de produção e transformação industrial.',
    sistema: true,
    ordem: 70,
  },
  {
    codigo: 'agronegocio',
    nome: 'Agronegócio',
    descricao: 'Empresas rurais e da cadeia do agronegócio.',
    sistema: true,
    ordem: 80,
  },
  {
    codigo: 'outro',
    nome: 'Outro',
    descricao: 'Demais segmentos de atividade.',
    sistema: true,
    ordem: 90,
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
