import type { GuideModule } from '../types';
import { ATIVIDADES_GUIDE } from './atividadesGuide';
import { AGENDA_GUIDE, DOCUMENTOS_GUIDE } from './documentosAgendaGuide';

export const OPERACAO_GUIDE: GuideModule[] = [
  {
    id: 'inicio', title: 'Início', icon: 'LayoutDashboard',
    description: 'Entenda o painel inicial, prepare o primeiro uso e escolha as prioridades do dia.',
    articles: [
      {
        id: 'inicio-primeiro-acesso', title: 'Primeiro acesso: preparar o escritório para trabalhar',
        summary: 'Conheça a sequência de configuração e cadastro antes de iniciar a rotina dos clientes.',
        path: 'Início → Configurações → Parceiros → Atividades',
        prerequisites: ['Entrar no sistema com o usuário do escritório.'],
        steps: [
          { title: 'Confira os avisos iniciais', description: 'Abra Início e leia os avisos de Cadastro da Empresa Incompleto ou Identidade Visual Incompleta, se aparecerem.' },
          { title: 'Complete o escritório', description: 'Use Completar Cadastro para conferir os dados de endereço e contato em Configurações. Se o aviso for visual, use Configurar Marca d’Água para acessar a configuração correspondente.' },
          { title: 'Conheça os clientes', description: 'Abra Parceiros e confira os cadastros que já existem antes de criar um novo. Para cada cliente, revise identificação e dados necessários à operação.' },
          { title: 'Prepare as obrigações', description: 'No cadastro do cliente, configure Rotinas e Obrigações conforme os serviços que serão executados. Em Atividades → Rotinas, confira a atribuição dos responsáveis.' },
          { title: 'Inicie a execução', description: 'Consulte Minha Fila para o trabalho atribuído ao seu usuário e Agenda para os compromissos. Use os demais artigos deste guia conforme a ação que pretende realizar.' },
        ], verification: ['Os dados do escritório foram conferidos.', 'O cliente e os responsáveis necessários à primeira rotina estão identificados.'],
        tips: ['Algumas configurações e visões de gestão dependem do perfil. Se não estiverem disponíveis, solicite ao administrador do escritório a configuração necessária.'],
        related: ['atividades-nova-rotina', 'agenda-calendario'],
      },
      {
        id: 'inicio-painel', title: 'Ler o painel e escolher as prioridades do dia',
        summary: 'Transforme os indicadores do Início em uma sequência de ações para o trabalho diário.',
        path: 'Início', prerequisites: ['Ter registros de atividades ou agenda no escritório.'],
        steps: [
          { title: 'Confira o dia', description: 'Na seção Hoje, leia os eventos e a indicação de origem de cada item, como atividade ou compromisso da agenda.' },
          { title: 'Antecipe a semana', description: 'Consulte Semana operacional para identificar compromissos e os responsáveis que precisarão se preparar.' },
          { title: 'Priorize as pendências', description: 'Em Prazos e riscos, identifique os alertas e tarefas que precisam de atenção antes de iniciar atividades menos urgentes.' },
          { title: 'Confira as tarefas', description: 'Use Algumas tarefas de hoje para conhecer os próximos trabalhos. Consulte Minha Fila para abrir os detalhes e executar o checklist completo.' },
          { title: 'Acompanhe a distribuição', description: 'Em Andamento por usuario, confira o progresso apresentado por responsável e período. Para investigar a carga da equipe, abra Atividades → Equipe.' },
        ], verification: ['As prioridades escolhidas têm prazo, empresa e responsável conhecidos.'],
        tips: ['O Início reúne informações de outras áreas. Faça os cadastros e alterações no módulo correspondente ao item.'], related: ['atividades-minha-fila', 'atividades-equipe-painel'],
      },
    ],
  },
  ATIVIDADES_GUIDE,
  {
    id: 'acompanhamento', title: 'Acompanhamento', icon: 'FileCheck',
    description: 'Confira recebimentos, envios, pendências e evidências de cada cliente por competência.',
    articles: [
      {
        id: 'acompanhamento-localizar', title: 'Localizar entregas por empresa e competência',
        summary: 'Encontre o mês correto e entenda as visões de pendências, recebimentos, envios e histórico.',
        path: 'Acompanhamento → empresa → competência',
        prerequisites: ['Cliente com entregas ativadas em Rotinas e Obrigações no cadastro do parceiro.'],
        steps: [
          { title: 'Escolha as empresas', description: 'Abra Acompanhamento e, em Status da empresa, selecione Ativas, Inativas ou Todas.' },
          { title: 'Escolha a situação', description: 'Em Situação do item, selecione Pendentes, Concluídos ou Todos. Para uma conferência completa, use Todos.' },
          { title: 'Busque e filtre o prazo', description: 'Busque empresa, CNPJ, entrega ou categoria. Use Inicial e Final para restringir as datas de prazo.' },
          { title: 'Abra a competência', description: 'Selecione o cartão da empresa no mês de referência desejado. Confira nome, CNPJ e competência no cabeçalho do detalhe.' },
          { title: 'Navegue no fluxo', description: 'Alterne entre Pendências, Documentos recebidos, Documentos enviados e Histórico do mês. Selecione um item para ver status, datas, autoria e evidência.' },
        ], verification: ['A empresa e a competência exibidas correspondem ao período que você está conferindo.'],
        tips: ['Os filtros Inicial e Final consideram o prazo da entrega.', 'Se não houver entregas, confira a ativação no cadastro do cliente. Se houver erro de carregamento, use Tentar novamente.'], related: ['acompanhamento-concluir'],
      },
      {
        id: 'acompanhamento-concluir', title: 'Registrar evidência e concluir uma entrega',
        summary: 'Documente a conferência realizada e confira quem concluiu o item e quando.',
        path: 'Acompanhamento → empresa / competência → entrega',
        prerequisites: ['Ter permissão para alterar o status da entrega.', 'Ter conferido o material ou comprovante que sustenta a conclusão.'],
        steps: [
          { title: 'Abra a entrega', description: 'Selecione o item na lista ou use Anotações para abrir o painel lateral. Confira nome da entrega, empresa e competência.' },
          { title: 'Leia os registros existentes', description: 'Revise Status, Recebido em, Evidência atual e o histórico de Anotações para entender o que já foi feito.' },
          { title: 'Descreva a evidência', description: 'Preencha Evidência ou justificativa com pelo menos 8 caracteres. Informe o que foi conferido e a referência do documento ou comprovante utilizado.' },
          { title: 'Conclua o item', description: 'Clique em Concluir e aguarde a atualização. Se surgir mensagem de erro, confira seu conteúdo antes de tentar novamente.' },
          { title: 'Confira a autoria', description: 'Verifique Status, Concluído por, Concluído em e Evidência atual. Consulte o Histórico do mês para revisar o registro no contexto da competência.' },
        ], verification: ['A entrega consta como Concluído com evidência correspondente à conferência.', 'A autoria e a data de conclusão estão disponíveis ou a tela indica a pendência de auditoria.'],
        tips: ['Use Adicionar para salvar somente uma anotação, sem alterar o status.', 'Esta tela registra o acompanhamento. Para guardar o arquivo, utilize Documentos e identifique sua referência na evidência.'], related: ['documentos-enviar', 'acompanhamento-reabrir'],
      },
      {
        id: 'acompanhamento-reabrir', title: 'Reabrir um item e conferir o histórico do mês',
        summary: 'Corrija uma conclusão quando houver retrabalho e mantenha uma justificativa rastreável.',
        path: 'Acompanhamento → Concluídos ou Todos → empresa / competência',
        prerequisites: ['Item concluído e permissão para alterar o status.', 'Motivo identificado para a reabertura.'],
        steps: [
          { title: 'Localize o item concluído', description: 'Na visão geral, escolha Concluídos ou Todos. Entre na empresa e competência e selecione a entrega.' },
          { title: 'Confira a conclusão anterior', description: 'Leia a evidência, o autor e as anotações para identificar a situação que precisa ser corrigida.' },
          { title: 'Justifique a reabertura', description: 'Preencha Evidência ou justificativa com pelo menos 8 caracteres, explicando o motivo e o que falta fazer.' },
          { title: 'Reabra', description: 'Clique em Reabrir e aguarde a alteração. Confira o novo status e as anotações registradas.' },
          { title: 'Verifique o trabalho relacionado', description: 'Use Abrir atividades para consultar o fechamento da empresa e competência. Use Abrir conformidade para investigar a situação do cliente quando necessário.' },
        ], verification: ['O item reaparece como pendência e a justificativa fica registrada.', 'O responsável sabe qual trabalho deve ser revisto.'],
        tips: ['A anotação explica a mudança de status; use uma descrição concreta para que outro usuário possa entender o retrabalho.'], related: ['atividades-fechamentos'],
      },
    ],
  },
  DOCUMENTOS_GUIDE,
  AGENDA_GUIDE,
];
