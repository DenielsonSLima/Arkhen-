import type { CatalogoDefaultItem } from './catalogosService';

export const TIPOS_EMPRESA_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'pessoa_fisica',
    nome: 'Pessoa Física',
    descricao: 'Parceiro PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.',
    sistema: true,
  },
  {
    codigo: 'mei',
    nome: 'MEI',
    descricao: 'Microempreendedor individual com rotinas simplificadas.',
    sistema: true,
  },
  {
    codigo: 'microempresa',
    nome: 'Microempresa',
    descricao: 'Empresa parceira com faturamento e obrigações de pequeno porte.',
  },
  {
    codigo: 'epp',
    nome: 'Empresa de Pequeno Porte',
    descricao: 'Parceiro com maior volume fiscal, contábil e trabalhista.',
  },
  {
    codigo: 'isenta_imune',
    nome: 'Isenta / Imune',
    descricao: 'Entidade ou operação com tratamento tributário diferenciado.',
  },
  {
    codigo: 'holding_patrimonial',
    nome: 'Holding / Patrimonial',
    descricao: 'Empresa com acompanhamento societário e documental específico.',
  },
];

export const NATUREZAS_JURIDICAS_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'empresario_individual',
    nome: 'Empresário Individual',
    descricao: 'Pessoa física titular de atividade empresarial.',
  },
  {
    codigo: 'sociedade_limitada',
    nome: 'Sociedade Limitada',
    descricao: 'Empresa formada por sócios com quotas de participação.',
    sistema: true,
  },
  {
    codigo: 'sociedade_limitada_unipessoal',
    nome: 'Sociedade Limitada Unipessoal',
    descricao: 'Modelo societário com um único titular.',
  },
  {
    codigo: 'associacao_privada',
    nome: 'Associação Privada',
    descricao: 'Entidade sem fins lucrativos com obrigações próprias.',
  },
];

export const TIPOS_PARCEIROS_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'cliente_contabil',
    nome: 'Cliente Contábil',
    descricao: 'Empresa atendida diretamente pelo escritório.',
    sistema: true,
  },
  {
    codigo: 'parceiro_comercial',
    nome: 'Parceiro Comercial',
    descricao: 'Origem de indicações e oportunidades comerciais.',
  },
  {
    codigo: 'fornecedor',
    nome: 'Fornecedor',
    descricao: 'Prestador ou fornecedor vinculado às rotinas internas.',
  },
  {
    codigo: 'correspondente',
    nome: 'Correspondente',
    descricao: 'Parceiro operacional para demandas locais.',
  },
];
