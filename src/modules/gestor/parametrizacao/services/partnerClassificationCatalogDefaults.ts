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
    nome: 'ME',
    descricao: 'Microempresa, conforme o porte oficial cadastrado no CNPJ.',
    sistema: true,
  },
  {
    codigo: 'epp',
    nome: 'EPP',
    descricao: 'Empresa de pequeno porte, conforme o cadastro oficial.',
    sistema: true,
  },
  {
    codigo: 'demais',
    nome: 'Demais',
    descricao: 'Demais portes e empresas sem enquadramento como MEI, ME ou EPP.',
    sistema: true,
  },
];

export const NATUREZAS_JURIDICAS_DEFAULTS: CatalogoDefaultItem[] = [
  {
    codigo: 'empresario_individual',
    nome: 'Empresário Individual (EI)',
    descricao: 'Pessoa física titular de atividade empresarial.',
    sistema: true,
  },
  {
    codigo: 'sociedade_limitada',
    nome: 'Sociedade Limitada (LTDA)',
    descricao: 'Empresa formada por sócios com quotas de participação.',
    sistema: true,
  },
  {
    codigo: 'sociedade_limitada_unipessoal',
    nome: 'Sociedade Limitada Unipessoal (SLU)',
    descricao: 'Modelo societário com um único titular.',
    sistema: true,
  },
  {
    codigo: 'associacao_privada',
    nome: 'Associação',
    descricao: 'Entidade sem fins lucrativos com obrigações próprias.',
    sistema: true,
  },
  {
    codigo: 'sociedade_anonima',
    nome: 'Sociedade Anônima (S.A.)',
    descricao: 'Sociedade empresária com capital dividido em ações.',
    sistema: true,
  },
  {
    codigo: 'cooperativa',
    nome: 'Cooperativa',
    descricao: 'Sociedade de pessoas organizada para atividade cooperativa.',
    sistema: true,
  },
  {
    codigo: 'fundacao_privada',
    nome: 'Fundação',
    descricao: 'Entidade privada constituída a partir de um patrimônio destinado a uma finalidade.',
    sistema: true,
  },
  {
    codigo: 'sociedade_simples',
    nome: 'Sociedade Simples',
    descricao: 'Sociedade voltada a atividades intelectuais, científicas, literárias ou artísticas.',
    sistema: true,
  },
  {
    codigo: 'organizacao_religiosa',
    nome: 'Organização Religiosa',
    descricao: 'Pessoa jurídica privada constituída para finalidade religiosa.',
    sistema: true,
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
    sistema: true,
  },
  {
    codigo: 'fornecedor',
    nome: 'Fornecedor',
    descricao: 'Prestador ou fornecedor vinculado às rotinas internas.',
    sistema: true,
  },
  {
    codigo: 'correspondente',
    nome: 'Correspondente',
    descricao: 'Parceiro operacional para demandas locais.',
    sistema: true,
  },
];
