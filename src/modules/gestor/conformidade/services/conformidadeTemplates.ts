import type { ConformidadeTipo } from './conformidadeService';

export interface ConformidadeTemplate {
  id: string;
  tipo: ConformidadeTipo;
  rotina: string;
  descricao: string;
  responsavelPadrao: string;
  diaVencimento: number;
  prazoContratoDias: number;
  impacto: 1 | 2 | 3 | 4 | 5;
  consequencia: string;
  documentos: string[];
}

export const CONFORMIDADE_TEMPLATES: ConformidadeTemplate[] = [
  {
    id: 'fiscal-apuracao',
    tipo: 'fiscal',
    rotina: 'Apuração Fiscal Mensal',
    descricao: 'Conferência de apurações fiscais e montagem da declaração mensal.',
    responsavelPadrao: 'João Silva',
    diaVencimento: 31,
    prazoContratoDias: 8,
    impacto: 5,
    consequencia: 'Emissão de alerta imediato, retenção de entrega até regularização do cliente.',
    documentos: ['Relatório SPED', 'Notas de entrada e saída'],
  },
  {
    id: 'fiscal-esocial',
    tipo: 'fiscal',
    rotina: 'eSocial e Retificações',
    descricao: 'Revisão de eventos do eSocial e eventual retificação por inconsistência.',
    responsavelPadrao: 'Karine',
    diaVencimento: 15,
    prazoContratoDias: 5,
    impacto: 4,
    consequencia: 'Multa por atraso e risco de bloqueio de envio de eventos.',
    documentos: ['Folha do período', 'Movimentações de eventos'],
  },
  {
    id: 'folha-mensal',
    tipo: 'folha',
    rotina: 'Fechamento de Folha',
    descricao: 'Conferência de encargos e aprovação da folha para pagamento.',
    responsavelPadrao: 'Fernanda',
    diaVencimento: 9,
    prazoContratoDias: 3,
    impacto: 5,
    consequencia: 'Repassar atraso ao cliente, com potencial cobrança administrativa e juros.',
    documentos: ['Ponto', 'Aditivos e recibos', 'Tabela de benefícios'],
  },
  {
    id: 'documentos-habitec',
    tipo: 'documentos',
    rotina: 'Documentos de Atividade',
    descricao: 'Validação de documentos operacionais pendentes e arquivos faltantes.',
    responsavelPadrao: 'Pedro',
    diaVencimento: 10,
    prazoContratoDias: 10,
    impacto: 3,
    consequencia: 'Não iniciar o fechamento até o acervo documental estar completo.',
    documentos: ['Extratos', 'Comprovantes bancários', 'Contratos e recibos'],
  },
  {
    id: 'protocolo-competencia',
    tipo: 'protocolo',
    rotina: 'Protocolo de Entrega',
    descricao: 'Abertura e submissão das obrigações com validação de retorno do protocolo.',
    responsavelPadrao: 'João Silva',
    diaVencimento: 20,
    prazoContratoDias: 6,
    impacto: 4,
    consequencia: 'Bloquear novas tarefas do cliente até protocolo entregue.',
    documentos: ['Comprovantes de protocolo', 'XML de transmissão'],
  },
  {
    id: 'atendimento-cliente',
    tipo: 'atendimento',
    rotina: 'Retorno e Aprovação do Cliente',
    descricao: 'Revisão de pendências junto ao cliente e aprovação final para fechamento.',
    responsavelPadrao: 'Karine',
    diaVencimento: 14,
    prazoContratoDias: 4,
    impacto: 2,
    consequencia: 'Aviso ao gestor e replanejamento de competência.',
    documentos: ['Comprovante de aceite', 'Confirmação de retorno'],
  },
];
