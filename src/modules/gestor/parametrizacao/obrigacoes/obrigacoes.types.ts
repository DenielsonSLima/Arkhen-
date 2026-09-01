export const OBRIGACAO_REGIMES = [
  'PF',
  'MEI',
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'Isenta',
] as const;

export const OBRIGACAO_PERIODICIDADES = [
  'mensal',
  'quinzenal',
  'trimestral',
  'semestral',
] as const;

export const OBRIGACAO_ORIGENS = [
  'Cliente envia',
  'Escritório envia',
  'Ambos',
] as const;

export type ObrigacaoRegime = typeof OBRIGACAO_REGIMES[number];
export type ObrigacaoPeriodicidade = typeof OBRIGACAO_PERIODICIDADES[number];
export type ObrigacaoOrigem = typeof OBRIGACAO_ORIGENS[number];

export interface ObrigacaoModelo {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  orgao: string;
  descricao: string;
  regimes: ObrigacaoRegime[];
  periodicidade: ObrigacaoPeriodicidade;
  origemPadrao: ObrigacaoOrigem;
  temVencimento: boolean;
  diaVencimento: number;
  referenciaMesAnterior: boolean;
  diaPrimeiraQuinzena: number;
  diaSegundaQuinzena: number;
  etapas: string[];
  ativo: boolean;
  ordem: number;
  atualizadoEm: string | null;
}

export type ObrigacaoModeloDraft = Omit<ObrigacaoModelo, 'id' | 'codigo' | 'ordem' | 'atualizadoEm'> & {
  id?: string;
  codigo?: string;
  ordem?: number;
  atualizadoEm?: string | null;
};

export const createEmptyObrigacao = (): ObrigacaoModeloDraft => ({
  nome: '',
  categoria: 'Fiscal',
  orgao: '',
  descricao: '',
  regimes: ['Simples Nacional'],
  periodicidade: 'mensal',
  origemPadrao: 'Escritório envia',
  temVencimento: true,
  diaVencimento: 20,
  referenciaMesAnterior: true,
  diaPrimeiraQuinzena: 15,
  diaSegundaQuinzena: 30,
  etapas: [''],
  ativo: true,
});

export const duplicateObrigacao = (obrigacao: ObrigacaoModelo): ObrigacaoModeloDraft => ({
  ...obrigacao,
  id: undefined,
  codigo: undefined,
  atualizadoEm: null,
  nome: `${obrigacao.nome} — cópia`,
  etapas: [...obrigacao.etapas],
  regimes: [...obrigacao.regimes],
});
