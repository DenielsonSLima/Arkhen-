export const OBRIGACAO_REGIMES = [
  'PF',
  'MEI',
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'Isenta',
] as const;

export const OBRIGACAO_PERIODICIDADES = [
  'diaria',
  'unica',
  'semanal',
  'quinzenal',
  'mensal',
  'trimestral',
  'semestral',
  'anual',
] as const;

export const OBRIGACAO_ORIGENS = [
  'Cliente envia',
  'Escritório envia',
  'Ambos',
] as const;

export type ObrigacaoRegime = typeof OBRIGACAO_REGIMES[number];
export type ObrigacaoPeriodicidade = typeof OBRIGACAO_PERIODICIDADES[number];
export type ObrigacaoOrigem = typeof OBRIGACAO_ORIGENS[number];

export const OBRIGACAO_PERIODICIDADE_LABELS: Record<ObrigacaoPeriodicidade, string> = {
  diaria: 'Diário',
  unica: 'Único',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const OBRIGACAO_DIAS_SEMANA = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
] as const;

export const OBRIGACAO_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

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
  diaSemana?: number;
  dataVencimento?: string;
  mesVencimento?: number;
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
  diaSemana: 1,
  dataVencimento: '',
  mesVencimento: 1,
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
