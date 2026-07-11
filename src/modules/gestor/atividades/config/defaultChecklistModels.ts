import type { ModeloAtividade } from '../services/atividadesService';

export const REGIMES_APLICAVEIS = ['PF', 'MEI', 'Isento', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'];

export const MODELOS_PADRAO: ModeloAtividade[] = [
  {
    id: 'folha-pagamento',
    codigo: 'folha-pagamento',
    nome: 'Folha de Pagamento',
    descricao: 'Checklist para apuração de folha de funcionários da empresa.',
    tipos: ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Fechar folha no sistema',
      'Gerar guias FGTS (FGTS Digital)',
      'Enviar eventos ao eSocial',
      'Conferir INSS e IRRF',
      'Emitir recibos de pagamento',
      'Gerar relatórios para o cliente',
      'Arquivar comprovantes e protocolos',
    ],
  },
  {
    id: 'pro-labore',
    codigo: 'pro-labore',
    nome: 'Pró-Labore',
    descricao: 'Checklist para apuração de pró-labore de sócios e diretores.',
    tipos: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Conferir sócios ativos',
      'Calcular retirada e INSS',
      'Gerar DARF de Pró-Labore',
      'Enviar informações ao eSocial',
      'Arquivar comprovantes do período',
    ],
  },
  {
    id: 'obras',
    codigo: 'obras',
    nome: 'Obras',
    descricao: 'Checklist para controle fiscal e de folha de obras de construção civil.',
    tipos: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Conferir folha de pagamento da obra',
      'Gerar FGTS da obra',
      'Transmitir eSocial de obra específica',
      'Conferir retenções de INSS',
      'Atualizar cadastro CNO/CEI',
      'Arquivar comprovantes da obra',
    ],
  },
  {
    id: 'dctfweb-tributos-federais',
    codigo: 'dctfweb-tributos-federais',
    nome: 'DCTFWeb / Tributos Federais',
    descricao: 'Fechamento e consolidação de obrigações e valores tributários federais.',
    tipos: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Conferir PIS e COFINS',
      'Calcular IRPJ e CSLL Trimestral',
      'Verificar retenções (1708, 3208, 5952)',
      'Transmitir DCTFWeb',
      'Gerar DARFs federais',
      'Arquivar recibos e guias',
    ],
  },
  {
    id: 'obrigacoes-mensais',
    codigo: 'obrigacoes-mensais',
    nome: 'Obrigações Mensais',
    descricao: 'Envio de declarações acessórias mensais da empresa.',
    tipos: ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Verificar notas fiscais emitidas',
      'Gerar guia DAS (Simples) ou guias federais',
      'Transmitir PGDAS-D ou EFD-Contribuições',
      'Enviar guias e comprovantes ao cliente',
    ],
  },
  {
    id: 'tarefas-internas',
    codigo: 'tarefas-internas',
    nome: 'Tarefas Internas',
    descricao: 'Procedimentos e tarefas administrativas internas do escritório.',
    tipos: ['PF', 'MEI', 'Isento', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
    etapas: [
      'Organizar documentos recebidos',
      'Conciliar extrato bancário',
      'Arquivar recibos e protocolos',
      'Atualizar painel de acompanhamento',
    ],
  },
];

export const emptyNewModel = () => ({
  nome: '',
  descricao: '',
  etapas: '',
  tipos: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
});
