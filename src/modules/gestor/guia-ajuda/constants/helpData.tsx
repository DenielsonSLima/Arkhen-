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
    titulo: 'Parceiros',
    icone: <Users size={18} />,
    descricao: 'Cadastro e gestão da carteira de parceiros da contabilidade.',
    objetivo: 'Centralizar dados cadastrais e, para cada cliente contábil, dados fiscais e histórico de rotina.',
    comoUsa: 'Abra Parceiros, filtre os clientes contábeis por regime/status e selecione uma empresa para ver dados cadastrais, filiais e obrigações.',
    submodulos: [
      {
        nome: 'Lista de parceiros',
        descricao: 'Pesquisa por nome, status, regime e mudança de visão em tabela/card.',
        comoUsar: 'Use para cadastrar, editar ou consultar rapidamente o cadastro principal de cada parceiro.',
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
    descricao: 'Configurações de base do sistema para padronizar prazos, tributos, regimes e fluxos.',
    objetivo: 'Evitar retrabalho e manter consistência entre parceiros e contas.',
    comoUsa: 'Preencha as bases antes de começar as operações recorrentes. Isso acelera tarefas e evita erro de classificação.',
    submodulos: [
      { nome: 'Regimes Tributários', descricao: 'Catalogação de regimes e regras principais.', comoUsar: 'Selecione o regime correto em parametrizacao e relatórios.' },
      { nome: 'Obrigações', descricao: 'Cards com prazo opcional, regimes aplicáveis e etapas do fluxo.', comoUsar: 'Crie cada variante de obrigação e depois ative o fluxo nas empresas compatíveis.' },
      { nome: 'Enquadramento / Natureza Jurídica / Parceiros', descricao: 'Classificações da base administrativa.', comoUsar: 'Use o enquadramento para o porte oficial (MEI, ME, EPP ou Demais) e mantenha a natureza jurídica separada.' },
      { nome: 'Categorias de Clientes', descricao: 'Segmentação da carteira contábil.', comoUsar: 'Crie grupos para relatórios e prioridade operacional dos clientes.' },
      { nome: 'Impostos', descricao: 'Regras e tabelas de cálculo.', comoUsar: 'Defina parâmetros para simulações e consistência.' },
      { nome: 'Tipos de Documentos', descricao: 'Classificação documental.', comoUsar: 'Usado para organização no módulo Documentos.' },
    ],
  },
  {
    titulo: 'Atividades',
    icone: <ListChecks size={18} />,
    descricao: 'Centro principal de rotina operacional e acompanhamento de execução.',
    objetivo: 'Acompanhar entregas diárias, semanais, mensais e o andamento por colaborador/empresa.',
    comoUsa: 'Use a fila para executar, Rotinas para organizar por empresa e o painel para acompanhar a operação.',
    submodulos: [
      { nome: 'Minha Fila', descricao: 'Tarefas organizadas por prazo, prioridade e situação.', comoUsar: 'Comece o dia por aqui para executar suas pendências.' },
      { nome: 'Equipe', descricao: 'Carga e andamento por colaborador.', comoUsar: 'Use para redistribuir trabalho e identificar gargalos.' },
      { nome: 'Fechamentos de Clientes', descricao: 'Execução por empresa e competência.', comoUsar: 'Acompanhe o que foi concluído e o que falta em cada fechamento.' },
      { nome: 'Rotinas', descricao: 'Recorrências agrupadas por empresa e consulta transversal.', comoUsar: 'Defina responsáveis, crie rotinas e faça alterações em lote.' },
      { nome: 'Painel Operacional', descricao: 'Indicadores e visão resumida de progresso.', comoUsar: 'Use em reuniões rápidas para apontar riscos.' },
    ],
  },
  {
    titulo: 'Simulações',
    icone: <FileText size={18} />,
    descricao: 'Calculadora trabalhista dedicada à rescisão de contratos.',
    objetivo: 'Apoiar a conferência das verbas rescisórias antes da emissão do TRCT.',
    comoUsa: 'Informe motivo, aviso prévio, salário, datas, FGTS e férias vencidas; depois confira o resultado e gere o PDF.',
    submodulos: [
      { nome: 'Calculadora de Rescisão', descricao: 'Projeção de verbas, descontos e FGTS do desligamento.', comoUsar: 'Preencha os dados do vínculo e valide as regras coletivas antes de concluir.' },
    ],
  },
  {
    titulo: 'Acompanhamento',
    icone: <FileCheck size={18} />,
    descricao: 'Acompanhamento mensal de entregas, evidências e documentos por empresa.',
    objetivo: 'Saber rapidamente o que aconteceu, o que foi concluído e o que segue pendente em cada competência.',
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
