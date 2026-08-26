import React from 'react';
import {
  CheckCircle,
  Clock3,
  Database,
  FileCheck,
  FileText,
  Landmark,
  ListChecks,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

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
    descricao: 'Painel operacional com configuração inicial, atrasos, vencimentos, agenda e andamento da equipe.',
    objetivo: 'Mostrar o que precisa de atenção assim que o escritório abre o sistema.',
    comoUsa: 'Conclua os primeiros passos e, depois, use os indicadores e painéis para priorizar o trabalho do dia.',
    submodulos: [
      {
        nome: 'Primeiros passos',
        descricao: 'Sequência de configuração essencial para deixar o escritório pronto para operar.',
        comoUsar: 'Siga as ações na ordem apresentada e volte ao painel até concluir a configuração.',
      },
      {
        nome: 'Prioridades operacionais',
        descricao: 'Atrasos, itens que vencem hoje, próximos compromissos e riscos.',
        comoUsar: 'Comece pelos atrasos e prazos de hoje; depois confira a semana operacional.',
      },
      {
        nome: 'Andamento da equipe',
        descricao: 'Resumo de execução por usuário e frequência das atividades.',
        comoUsar: 'Use para redistribuir carga e identificar responsáveis com itens atrasados.',
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
    descricao: 'Bases de classificação e modelos usados nos cadastros, cálculos, documentos e fechamentos.',
    objetivo: 'Padronizar a operação para evitar digitação repetida e classificações divergentes.',
    comoUsa: 'Cadastre primeiro as bases que serão usadas pela sua equipe e só depois crie rotinas recorrentes.',
    submodulos: [
      { nome: 'Regimes Tributários', descricao: 'Catalogação de regimes e regras principais.', comoUsar: 'Selecione o regime correto nos cadastros e relatórios.' },
      { nome: 'Catálogo de Obrigações', descricao: 'Tipos de obrigação/protocolo da empresa.', comoUsar: 'Use como padrão ao configurar obrigações por cliente.' },
      { nome: 'Cadastros de classificação', descricao: 'Tipos de empresa, natureza jurídica, parceiros, categorias de clientes e CNAE.', comoUsar: 'Prepare opções consistentes para cadastro e filtros de clientes.' },
      { nome: 'Impostos e tabelas tributárias', descricao: 'Tributos, faixas e tabelas usadas em cálculos.', comoUsar: 'Revise os parâmetros antes de usar simulações e apurações.' },
      { nome: 'Documentos e pastas', descricao: 'Tipos de documentos e estrutura padrão de pastas.', comoUsar: 'Defina a organização que será aplicada à biblioteca de cada empresa.' },
      { nome: 'Modelos de fechamento', descricao: 'Checklist padrão que serve de base para rotinas recorrentes.', comoUsar: 'Monte o modelo e depois vincule-o às empresas em Rotinas programadas.' },
      { nome: 'Categorias Financeiras', descricao: 'Classificação de receitas e despesas.', comoUsar: 'Cadastre categorias claras antes de registrar movimentações.' },
    ],
  },
  {
    titulo: 'Atividades',
    icone: <ListChecks size={18} />,
    descricao: 'Centro principal de rotina operacional e acompanhamento de execução.',
    objetivo: 'Distribuir tarefas, acompanhar fechamentos e executar rotinas recorrentes por responsável e empresa.',
    comoUsa: 'Crie e vincule rotinas programadas; depois acompanhe execução pela Minha Fila, Equipe e Painel Operacional.',
    submodulos: [
      { nome: 'Minha Fila', descricao: 'Tarefas atribuídas ao usuário atual.', comoUsar: 'Use como lista diária de execução, filtrando por prazo, status e cliente.' },
      { nome: 'Equipe', descricao: 'Atividades distribuídas entre os colaboradores.', comoUsar: 'Acompanhe carga, progresso e gargalos por responsável.' },
      { nome: 'Fechamentos de Clientes', descricao: 'Execução do checklist por empresa e competência.', comoUsar: 'Abra a competência e marque cada etapa conforme o fechamento avança.' },
      { nome: 'Rotinas programadas', descricao: 'Regras recorrentes que geram tarefas para empresas e responsáveis.', comoUsar: 'Vincule um modelo, escolha empresas, frequência, vencimento e responsável.' },
      { nome: 'Painel Operacional', descricao: 'Indicadores consolidados da execução.', comoUsar: 'Use em reuniões rápidas para revisar risco e andamento da carteira.' },
    ],
  },
  {
    titulo: 'Conformidade',
    icone: <ShieldCheck size={18} />,
    descricao: 'Visão de obrigações, documentos e ocorrências que exigem regularização por empresa.',
    objetivo: 'Antecipar riscos e manter evidências de acompanhamento da carteira.',
    comoUsa: 'Filtre a carteira, abra os itens com risco e registre a tratativa até a regularização.',
    submodulos: [
      { nome: 'Visão da carteira', descricao: 'Resumo de empresas e pontos de atenção.', comoUsar: 'Comece pelos itens críticos e refine a análise por empresa.' },
      { nome: 'Tratativas', descricao: 'Acompanhamento das ações tomadas para resolver ocorrências.', comoUsar: 'Registre responsável, contexto e evolução para manter rastreabilidade.' },
    ],
  },
  {
    titulo: 'Simulações e Cálculos',
    icone: <FileText size={18} />,
    descricao: 'Calculadora de rescisão com regras processadas no servidor.',
    objetivo: 'Apoiar a conferência das verbas rescisórias antes da orientação ao cliente.',
    comoUsa: 'Informe o tipo de desligamento, salário, datas e saldo do FGTS; depois revise o resultado e gere o relatório em PDF.',
    submodulos: [
      { nome: 'Rescisão', descricao: 'Projeção de saldo de salário, férias, 13º, aviso-prévio e multa do FGTS.', comoUsar: 'Preencha os dados do vínculo, confira as verbas calculadas e exporte o PDF.' },
    ],
  },
  {
    titulo: 'Reforma Tributária',
    icone: <Scale size={18} />,
    descricao: 'Área de consulta e apoio às mudanças trazidas pela reforma tributária.',
    objetivo: 'Centralizar referências e análises usadas na orientação dos clientes.',
    comoUsa: 'Consulte o conteúdo disponível e use os cenários como apoio; valide a regra aplicável antes de orientar o cliente.',
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
    descricao: 'Biblioteca de arquivos e pastas do escritório, organizada por usuário e por empresa.',
    objetivo: 'Centralizar arquivos, preservar histórico e compartilhar documentos com controle.',
    comoUsa: 'Escolha a visão adequada antes de enviar arquivos; confirme sempre a empresa, pasta e categoria de destino.',
    submodulos: [
      { nome: 'Meus Documentos', descricao: 'Arquivos pessoais e operacionais do usuário.', comoUsar: 'Armazene materiais de trabalho que não pertencem à pasta de uma empresa.' },
      { nome: 'Por Empresa', descricao: 'Arquivos separados por cliente e pasta.', comoUsar: 'Suba e organize documentos de cada cliente no contexto correto.' },
      { nome: 'Solicitações', descricao: 'Controle do que cada cliente precisa enviar em cada competência.', comoUsar: 'Selecione o cliente, informe a competência e acompanhe o status de Pendente até Concluído.' },
      { nome: 'Empresas Inativas', descricao: 'Acesso ao acervo de clientes que não estão mais ativos.', comoUsar: 'Consulte o histórico sem misturá-lo à carteira operacional atual.' },
      { nome: 'Todos os Documentos', descricao: 'Visão global para busca e auditoria.', comoUsar: 'Use em fiscalização interna e conferência rápida por palavra-chave.' },
      { nome: 'Compartilhados', descricao: 'Links e arquivos disponibilizados externamente.', comoUsar: 'Revise validade, senha e destinatário antes de compartilhar.' },
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
    titulo: 'Configurações',
    icone: <Settings size={18} />,
    descricao: 'Central administrativa organizada por configuração essencial, acessos e integrações.',
    objetivo: 'Controlar a identidade do escritório, usuários, permissões, integrações e auditoria.',
    comoUsa: 'Comece pelo grupo Comece por aqui; altere acessos e integrações somente quando necessário.',
    submodulos: [
      { nome: 'Comece por aqui', descricao: 'Meu perfil, dados do escritório, equipe, contadores e marca-d’água.', comoUsar: 'Complete esses dados antes de gerar documentos ou convidar toda a equipe.' },
      { nome: 'Acessos e governança', descricao: 'Perfis, permissões, módulos, compartilhamento e logs.', comoUsar: 'Conceda somente os acessos necessários para cada função.' },
      { nome: 'Integrações e ferramentas', descricao: 'Contas e integrações bancárias, fiscal, XML e calculadora.', comoUsar: 'Configure credenciais em ambiente seguro e teste antes do uso operacional.' },
    ],
  },
];
