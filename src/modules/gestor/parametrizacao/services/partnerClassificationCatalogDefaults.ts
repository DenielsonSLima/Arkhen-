import type { CatalogoDefaultItem } from './catalogosService';

export const TIPOS_EMPRESA_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'te-1',
    nome: 'Pessoa Física',
    descricao: 'Parceiro PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.',
    sistema: true,
  },
  {
    codigo: 'te-2',
    nome: 'MEI',
    descricao: 'Microempreendedor individual com rotinas simplificadas.',
    sistema: true,
  },
  {
    codigo: 'te-3',
    nome: 'Microempresa',
    descricao: 'Empresa parceira com faturamento e obrigações de pequeno porte.',
  },
  {
    codigo: 'te-4',
    nome: 'Empresa de Pequeno Porte',
    descricao: 'Parceiro com maior volume fiscal, contábil e trabalhista.',
  },
  {
    codigo: 'te-5',
    nome: 'Isenta / Imune',
    descricao: 'Entidade ou operação com tratamento tributário diferenciado.',
  },
  {
    codigo: 'te-6',
    nome: 'Holding / Patrimonial',
    descricao: 'Empresa com acompanhamento societário e documental específico.',
  },
];

export const NATUREZAS_JURIDICAS_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'nj-1',
    nome: 'Empresário Individual',
    descricao: 'Pessoa física titular de atividade empresarial.',
  },
  {
    codigo: 'nj-2',
    nome: 'Sociedade Limitada',
    descricao: 'Empresa formada por sócios com quotas de participação.',
    sistema: true,
  },
  {
    codigo: 'nj-3',
    nome: 'Sociedade Limitada Unipessoal',
    descricao: 'Modelo societário com um único titular.',
  },
  {
    codigo: 'nj-4',
    nome: 'Associação Privada',
    descricao: 'Entidade sem fins lucrativos com obrigações próprias.',
  },
];

export const TIPOS_PARCEIROS_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'tp-1',
    nome: 'Cliente Contábil',
    descricao: 'Empresa atendida diretamente pelo escritório.',
    sistema: true,
  },
  {
    codigo: 'tp-2',
    nome: 'Parceiro Comercial',
    descricao: 'Origem de indicações e oportunidades comerciais.',
  },
  {
    codigo: 'tp-3',
    nome: 'Fornecedor',
    descricao: 'Prestador ou fornecedor vinculado às rotinas internas.',
  },
  {
    codigo: 'tp-4',
    nome: 'Correspondente',
    descricao: 'Parceiro operacional para demandas locais.',
  },
];
