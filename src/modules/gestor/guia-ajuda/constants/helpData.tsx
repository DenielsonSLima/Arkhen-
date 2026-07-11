import React from 'react';
import { CheckCircle, Clock3, Database, FileCheck, FileText, Headphones, Landmark, ListChecks, Receipt, Settings, Users } from 'lucide-react';

export interface HelpSubmodule {
  nome: string;
  descricao: string;
  comoUsar: string;
}

export interface HelpModule {
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  objetivo: string;
  comoUsa: string;
  submodulos?: HelpSubmodule[];
}

export const HELP_DATA: HelpModule[] = [
  {
    titulo: 'Início',
    icone: <CheckCircle size={18} />,
    descricao: 'Dashboard de visão operacional. Mostra o resumo do dia, clientes, obrigações e alertas importantes.',
    objetivo: 'Te colocar no contexto do escritório na abertura do sistema.',
    comoUsa: 'Use na entrada para checar pendências do dia, empresas mais críticas e acompanhar o andamento geral.',
    submodulos: [
      {
        nome: 'Painel de mensagens',
        descricao: 'Mensagem diária com prioridade operacional e acesso rápido ao contexto.',
        comoUsar: 'Verifique essa área ao abrir o sistema para decidir o que tratar primeiro.',
      },
    ],
  },
  {
    titulo: 'Clientes',
    icone: <Users size={18} />,
    descricao: 'Cadastro e gestão dos dados dos clientes da contabilidade.',
    objetivo: 'Centralizar dados civis/fiscais e histórico de rotina de cada cliente.',
    comoUsa: 'Abra clientes, filtre por regime/status e selecione uma empresa para ver: dados cadastrais, filiais e obrigações da empresa.',
    submodulos: [
      {
        nome: 'Lista de clientes',
        descricao: 'Pesquisa por nome, status, regime e mudança de visão em tabela/card.',
        comoUsar: 'Use para cadastrar, editar ou consultar rapidamente o cadastro principal de cada cliente.',
      },
      {
        nome: 'Detalhes da empresa',
        descricao: 'Resumo da empresa (dados fiscais, contatos e endereço).',
        comoUsar: 'Abra a empresa e mantenha os dados atualizados para emissão e controle de documentos.',
      },
      {
        nome: 'Rotinas e obrigações',
        descricao: 'Histórico e controle de itens de entrega por cliente e competência.',
        comoUsar: 'Clique na aba para conferir o que ainda está pendente e o que já foi entregue.',
      },
      {
        nome: 'Filiais',
        descricao: 'Cadastro de unidades filiadas à empresa.',
        comoUsar: 'Gerencie múltiplas filiais sem duplicar o cliente principal.',
      },
    ],
  },
  {
    titulo: 'Parametrização',
    icone: <Database size={18} />,
    descricao: 'Configurações de base do sistema para padronizar prazos, tributos, regimes e parametrizacao.',
    objetivo: 'Evitar retrabalho e manter consistência entre clientes e contas.',
    comoUsa: 'Preencha as bases antes de começar as operações recorrentes. Isso acelera tarefas e evita erro de classificação.',
    submodulos: [
      { nome: 'Regimes Tributários', descricao: 'Catalogação de regimes e regras principais.', comoUsar: 'Selecione o regime correto em parametrizacao e relatórios.' },
      { nome: 'Catálogo de Obrigações', descricao: 'Tipos de obrigação/protocolo da empresa.', comoUsar: 'Use como padrão ao configurar obrigações por cliente.' },
      { nome: 'Tipos de Empresa / Natureza Jurídica / Parceiros', descricao: 'Classificações da base administrativa.', comoUsar: 'Utilize para filtros e segmentações rápidas.' },
      { nome: 'Categorias de Clientes', descricao: 'Segmentação de carteira.', comoUsar: 'Crie grupos para relatórios e prioridade operacional.' },
      { nome: 'Impostos', descricao: 'Regras e tabelas de cálculo.', comoUsar: 'Defina parâmetros para simulações e consistência.' },
      { nome: 'Obrigações', descricao: 'Definição de prazos-padrão.', comoUsar: 'Garante calendário fiscal completo e menos omissões.' },
      { nome: 'Tipos de Documentos', descricao: 'Classificação documental.', comoUsar: 'Usado para organização no módulo Documentos.' },
      { nome: 'Modelos de Checklists', descricao: 'Padrões de rotina por cliente/tarefa.', comoUsar: 'Use nas áreas de atividades e rotinas para uniformizar passos.' },
    ],
  },
  {
    titulo: 'Atividades',
    icone: <ListChecks size={18} />,
    descricao: 'Centro principal de rotina operacional e acompanhamento de execução.',
    objetivo: 'Acompanhar entregas diárias, semanais, mensais e o andamento por colaborador/empresa.',
    comoUsa: 'Escolha o tipo de rotina (diária, semanal, mensal, por empresa, por funcionário, interno, checklist ou controle).',
    submodulos: [
      { nome: 'Atividades Diárias', descricao: 'Checklist diário da operação.', comoUsar: 'Use para tarefas repetidas do dia a dia.' },
      { nome: 'Atividades Semanais', descricao: 'Pendências que vencem na janela semanal.', comoUsar: 'Defina e acompanhe itens recorrentes no período semanal.' },
      { nome: 'Atividades Mensais', descricao: 'Tarefas de competência mensal por data de corte.', comoUsar: 'Monitore fechamento e vencimentos mensais por cliente.' },
      { nome: 'Atividades por Empresa', descricao: 'Dashboard consolidado por cliente com seleção de competência.', comoUsar: 'Acompanhe o que foi concluído e o que falta por empresa.' },
      { nome: 'Atividades por Funcionário', descricao: 'Controle de produtividade e responsabilidade interna.', comoUsar: 'Use para ver quem executa o quê e identificar gargalos.' },
      { nome: 'Atividades Internas', descricao: 'Rotinas administrativas do escritório.', comoUsar: 'Separe tarefas da operação interna das rotinas de atendimento.' },
      { nome: 'Checklists', descricao: 'Modelos e listas padrão.', comoUsar: 'Aplique padrões repetíveis para ganhar previsibilidade.' },
      { nome: 'Painel de Andamento', descricao: 'Indicadores e visão resumida de progresso.', comoUsar: 'Use em reunião rápida com o time para apontar risco.' },
    ],
  },
  {
    titulo: 'Simulações e Cálculos',
    icone: <FileText size={18} />,
    descricao: 'Ferramentas de simulação de folha, impostos e cenários tributários.',
    objetivo: 'Apoiar decisão técnica e geração de cenários antes de emissão.',
    comoUsa: 'Escolha o simulador (folha, rescisão, encargos, DAS etc.) e preencha os dados do caso.',
    submodulos: [
      { nome: 'Folha e encargos', descricao: 'Cálculo de proventos, descontos e custo trabalhista.', comoUsar: 'Use para referência técnica antes de registrar lançamentos.' },
      { nome: 'Rescisão e PL', descricao: 'Projeções de verbas e custos de desligamento.', comoUsar: 'Preencha salários, datas e regras da simulação.' },
      { nome: 'DAS, PIS/COFINS e multas', descricao: 'Simulações tributárias do período.', comoUsar: 'Compare cenários e valide impactos no fluxo.' },
      { nome: 'Custos e comparativo de regimes', descricao: 'Avalia carga tributária por cenário.', comoUsar: 'Use para orientação e análise de viabilidade.' },
    ],
  },
  {
    titulo: 'Protocolos',
    icone: <FileCheck size={18} />,
    descricao: 'Controle de entregas e documentos em relação às obrigações.',
    objetivo: 'Saber rapidamente o que foi entregue, o que está pendente e por competência.',
    comoUsa: 'Filtre por período, status e empresa, depois abra a competência para ver os detalhes de cada item.',
    submodulos: [
      { nome: 'Pendentes', descricao: 'Lista de entregas atrasadas ou em andamento.', comoUsar: 'Priorize esses itens no primeiro bloco da rotina.' },
      { nome: 'Concluídos', descricao: 'Histórico de entregas finalizadas.', comoUsar: 'Use para comprovação e auditoria interna.' },
      { nome: 'Detalhe da empresa/competência', descricao: 'Acesso completo aos registros daquele período.', comoUsar: 'Revisite e reative notas/tarefas se necessário.' },
    ],
  },
  {
    titulo: 'Documentos',
    icone: <FileText size={18} />,
    descricao: 'Repositório de arquivos e pastas por usuário e por empresa.',
    objetivo: 'Centralizar contratos, documentos fiscais e provas para auditoria.',
    comoUsa: 'Navegue entre Minha Biblioteca, Por Empresa e Todos os Documentos; use upload, pasta e categoria para manter organização.',
    submodulos: [
      { nome: 'Biblioteca', descricao: 'Arquivos pessoais/operacionais do time.', comoUsar: 'Armazene documentos de referência e materiais recorrentes.' },
      { nome: 'Por Empresa', descricao: 'Arquivos separados por cliente e pasta.', comoUsar: 'Suba e organize documentos de cada cliente no contexto correto.' },
      { nome: 'Todos os Documentos', descricao: 'Visão global para busca e auditoria.', comoUsar: 'Use em fiscalização interna e conferência rápida por palavra-chave.' },
    ],
  },
  {
    titulo: 'Faturamento',
    icone: <Receipt size={18} />,
    descricao: 'Controle de cobranças, notas de serviço e recorrência contratual.',
    objetivo: 'Administrar fluxo de receita e status de documentos de cobrança.',
    comoUsa: 'Use dashboard para visão gerencial e abas para detalhar histórico, inadimplência e recorrências.',
    submodulos: [
      { nome: 'Dashboard', descricao: 'Resumo de indicadores de faturamento.', comoUsar: 'Acompanhe a saúde do ciclo financeiro.' },
      { nome: 'Recorrências', descricao: 'Configuração e execução de lançamentos recorrentes.', comoUsar: 'Gerencie mensalidades e repetições automáticas.' },
      { nome: 'Histórico NFS-e', descricao: 'Consulta das emissões por competência/cliente.', comoUsar: 'Revisão e rastreabilidade de notas emitidas.' },
      { nome: 'Inadimplência', descricao: 'Clientes com atraso e posição de cobrança.', comoUsar: 'Acompanhe cobrança preventiva antes do atraso crítico.' },
      { nome: 'Financeiro', descricao: 'Visão complementar para fluxo e conciliação.', comoUsar: 'Integre com operações de faturamento para fechar caixa.' },
      { nome: 'Configurações', descricao: 'Regras de comportamento da operação de faturamento.', comoUsar: 'Ajuste modelos e parâmetros antes de gerar ciclos.' },
    ],
  },
  {
    titulo: 'Financeiro',
    icone: <Landmark size={18} />,
    descricao: 'Controle de caixa, contas a pagar/receber e ajustes.',
    objetivo: 'Saber quanto entra, sai e está pendente no curto prazo.',
    comoUsa: 'Selecione a aba conforme natureza do movimento e atualize lançamentos.',
    submodulos: [
      { nome: 'Caixa', descricao: 'Visão consolidada de disponibilidade.', comoUsar: 'Comece aqui para decisão operacional diária.' },
      { nome: 'Contas a Receber', descricao: 'Entradas esperadas e vencimentos.', comoUsar: 'Monitore cobranças por empresa e status.' },
      { nome: 'Contas a Pagar', descricao: 'Despesas e vencimentos do escritório.', comoUsar: 'Evite atrasos com prioridade de vencimento.' },
      { nome: 'Transferências e outros lançamentos', descricao: 'Movimentações complementares.', comoUsar: 'Registre ajustes com descrição e referência.' },
    ],
  },
  {
    titulo: 'Agenda',
    icone: <Clock3 size={18} />,
    descricao: 'Matriz de eventos da rotina + prazos recorrentes + tarefas.',
    objetivo: 'Saber o que acontece hoje, esta semana e nos próximos dias de forma operacional.',
    comoUsa: 'Filtro por empresa, funcionário, tipo e categoria; crie e edite eventos e acompanhe os blocos de origem.',
    submodulos: [
      { nome: 'Agenda (eventos manuais)', descricao: 'Compromissos e tarefas cadastradas.', comoUsar: 'Crie itens por responsável e empresa, definindo recorrência.' },
      { nome: 'Prazos recorrentes', descricao: 'Obrigações fiscais repetidas.', comoUsar: 'Ative e controle vencimentos para reduzir esquecimentos.' },
      { nome: 'Tarefas de Atividades', descricao: 'Integração com rotina operacional.', comoUsar: 'Identifique tarefas em andamento e próxima ação por competência.' },
      { nome: 'Configurações (tipos, categorias, cores)', descricao: 'Padronização de filtros visuais.', comoUsar: 'Ajuste antes de iniciar a rotina para reduzir ruído.' },
    ],
  },
  {
    titulo: 'Relatórios',
    icone: <Headphones size={18} />,
    descricao: 'Relatórios analíticos de faturamento, conformidade, pessoal e tributário.',
    objetivo: 'Entregar informação de gestão para decisão e revisão.',
    comoUsa: 'Escolha relatório, aplique filtros de período/empresa e gere resultado.',
  },
  {
    titulo: 'Configurações',
    icone: <Settings size={18} />,
    descricao: 'Central administrativa da contabilidade do escritório.',
    objetivo: 'Controlar dados da empresa, usuários, permissões, integrações e segurança.',
    comoUsa: 'Atualize os parametrizacao base antes da operação diária para não interromper os fluxos.',
    submodulos: [
      { nome: 'Meu Perfil / Usuários', descricao: 'Acesso, permissões e cargos.', comoUsar: 'Gerencie identidade e privilégios por pessoa.' },
      { nome: 'Dados da Empresa', descricao: 'CNPJ, logo, contatos e identificação oficial.', comoUsar: 'Mantém emissão e documentos com dados corretos.' },
      { nome: 'Integrações (Bancária e Fiscal)', descricao: 'Conexão com serviços externos.', comoUsar: 'Configure somente após validações operacionais internas.' },
      { nome: 'Perfis e Permissões', descricao: 'Regras de segurança do sistema.', comoUsar: 'Ajuste quem pode ver e editar cada recurso.' },
      { nome: 'Contas, marca d’água, logs e API', descricao: 'Infraestrutura e auditoria.', comoUsar: 'Use para governança e rastreabilidade.' },
    ],
  },
];
