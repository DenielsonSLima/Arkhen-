import type { ReformaStatus } from './reformaTributaria.types';

export const STATUS_LABELS: Record<ReformaStatus, string> = {
  nao_iniciado: 'Não iniciado',
  aguardando_informacoes: 'Aguardando informações',
  em_configuracao: 'Em configuração',
  aguardando_xml: 'Aguardando XML',
  xml_inconsistente: 'XML inconsistente',
  adequado: 'Adequado',
  nao_aplicavel: 'Não aplicável',
};

export const formatCurrency = (value: unknown) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(Number(value || 0));

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};
