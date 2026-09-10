import type { GuideModule } from '../types';

export const ANALISES_GUIDE: GuideModule[] = [
  {
    id: 'simulacoes', title: 'Simulações', icon: 'Calculator',
    description: 'Prepare estimativas de rescisão, confira as premissas e gere uma prévia em PDF.',
    articles: [
      {
        id: 'simulacoes-rescisao', title: 'Simular uma rescisão e conferir as verbas',
        summary: 'Preencha os dados do vínculo e acompanhe a estimativa apresentada na calculadora.', path: 'Simulações → Calculadora de Rescisão',
        prerequisites: ['Datas, salário, saldo do FGTS e informações de férias do vínculo.', 'Critérios da rescisão definidos pelo responsável de pessoal.'],
        steps: [
          { title: 'Escolha a modalidade', description: 'Abra Simulações e, em Dados da Rescisão, selecione o tipo de rescisão correspondente ao caso.' },
          { title: 'Confira o aviso prévio', description: 'Escolha a opção aplicável entre as apresentadas, como Cumpriu 30 dias, Não cumpriu ou Indenizado. Leia a descrição da opção.' },
          { title: 'Preencha os dados principais', description: 'Informe Último Salário (R$), Data de Admissão, Data de Demissão e Saldo do FGTS (R$).' },
          { title: 'Revise férias e adicionais', description: 'Confira Períodos vencidos e as opções complementares. Se houver adicional por tempo de serviço, selecione o tipo e preencha o percentual ou valor mensal exigido.' },
          { title: 'Aguarde e confira o resultado', description: 'A calculadora atualiza o resultado conforme os parâmetros. Leia Verbas Rescisórias e eventuais erros antes de considerar a estimativa pronta.' },
        ], verification: ['Os parâmetros correspondem aos documentos do vínculo.', 'As verbas e descontos apresentados foram conferidos pelo responsável de pessoal.'],
        tips: ['O resultado é estimativo. Confira documentos, convenção coletiva, médias variáveis e eventos do vínculo antes de emitir o TRCT.'],
        related: ['simulacoes-pdf'],
      },
      {
        id: 'simulacoes-pdf', title: 'Gerar e baixar o relatório de rescisão',
        summary: 'Revise o relatório em PDF antes de entregar a simulação.', path: 'Simulações → Gerar relatório PDF',
        prerequisites: ['Simulação concluída sem erro e dados conferidos.'],
        steps: [
          { title: 'Finalize a conferência', description: 'Revise os dados do vínculo e aguarde o fim do cálculo. O botão de PDF fica bloqueado durante processamento ou quando há erro.' },
          { title: 'Abra a prévia', description: 'Clique em Gerar relatório PDF e aguarde a janela Relatório de Rescisão.' },
          { title: 'Confira todas as páginas', description: 'Revise dados, premissas, valores, textos e identificação visual do relatório na prévia.' },
          { title: 'Baixe o arquivo', description: 'Use a ação de download na janela. Abra o arquivo salvo para conferir se corresponde à última simulação revisada.' },
        ], verification: ['O PDF contém os parâmetros e valores da simulação atual.'],
        tips: ['Gerar o PDF não envia eventos trabalhistas nem substitui o documento definitivo da rescisão.'],
      },
    ],
  },
  {
    id: 'reforma-tributaria', title: 'Reforma Tributária', icon: 'Scale',
    description: 'Acompanhe adequação por cliente, registre evidências XML e mantenha cenários e decisões organizados.',
    articles: [
      {
        id: 'reforma-visao-geral', title: 'Identificar empresas que precisam de adequação',
        summary: 'Use o mapa da carteira para priorizar o trabalho por CNPJ.', path: 'Reforma Tributária → Visão Geral',
        prerequisites: ['Clientes cadastrados e acesso ao módulo.'],
        steps: [
          { title: 'Abra o painel', description: 'Acesse Reforma Tributária e selecione Visão Geral.' },
          { title: 'Leia os indicadores', description: 'Confira CNPJs monitorados, Adequados, Em risco, Aguardando XML e Simulações pendentes.' },
          { title: 'Identifique o cliente', description: 'No Mapa de preparação por CNPJ, localize a empresa e confira sua situação antes de abrir o trabalho de adequação.' },
          { title: 'Continue pela tarefa pendente', description: 'Abra Adequação Fiscal para cadastro e checklist ou a aba específica para validação, simulação e decisões.' },
        ], verification: ['O cliente selecionado corresponde ao CNPJ que você pretende acompanhar.'],
        tips: ['Se aparecer Acesso somente para consulta, solicite a permissão Gerenciar Reforma Tributária ao gestor para trabalhar nas demais abas.'],
        related: ['reforma-adequacao', 'reforma-xml'],
      },
      {
        id: 'reforma-adequacao', title: 'Cadastrar a adequação e atualizar o checklist',
        summary: 'Registre responsáveis, prazos e evidências da preparação de cada cliente.', path: 'Reforma Tributária → Adequação Fiscal',
        prerequisites: ['Cliente selecionado.', 'Permissão Gerenciar Reforma Tributária.'],
        steps: [
          { title: 'Selecione o cliente', description: 'Escolha o CNPJ no seletor e confira o nome exibido em Configuração do CNPJ.' },
          { title: 'Preencha a preparação', description: 'Informe Emissor ou ERP, Ambiente, Responsável, Prazo e Documentos emitidos. Em Observações, registre fornecedor, chamado e pendências técnicas.' },
          { title: 'Salve o cadastro', description: 'Clique em Salvar adequação e aguarde a confirmação antes de passar para o checklist.' },
          { title: 'Marque o que foi conferido', description: 'Atualize itens como Emissor atualizado, Cadastros revisados, CST configurado, cClassTrib configurado, Alíquotas configuradas e Totalizadores conferidos somente após verificar a evidência.' },
          { title: 'Complete a evidência XML', description: 'Use Validador XML para os itens de XML atualizados automaticamente. Volte à adequação para conferir o progresso e a situação do cliente.' },
        ], verification: ['Responsável, prazo e observações permanecem salvos.', 'O checklist representa conferências realizadas e a situação do cliente foi atualizada.'],
        tips: ['Itens atualizados automaticamente pelo validador ficam bloqueados para marcação manual.'],
      },
      {
        id: 'reforma-xml', title: 'Validar um XML e registrar a evidência',
        summary: 'Confira a consistência do documento e guarde o resultado na trilha do cliente.', path: 'Reforma Tributária → Validador XML',
        prerequisites: ['Permissão de gerenciamento e cliente correto selecionado.', 'XML original de NF-e, NFC-e, NFS-e, CT-e ou MDF-e de até 10 MB.'],
        steps: [
          { title: 'Confira o cliente', description: 'Selecione a empresa do documento. A validação fica vinculada ao CNPJ escolhido e ao seu histórico.' },
          { title: 'Selecione o arquivo', description: 'Em Conferir XML original, clique em Arraste ou selecione um XML e escolha o arquivo. Confira o nome apresentado.' },
          { title: 'Execute a validação', description: 'Clique em Validar e registrar evidência. Aguarde o resultado antes de trocar de cliente ou arquivo.' },
          { title: 'Leia o diagnóstico', description: 'Confira XML consistente, XML consistente com alertas ou XML inconsistente. Leia os campos e mensagens de cada inconsistência e a versão de regra exibida.' },
          { title: 'Confira o histórico', description: 'Verifique o arquivo em Últimas validações. Após corrigir o documento na origem, selecione o XML corrigido e valide novamente.' },
        ], verification: ['O diagnóstico e o arquivo aparecem no histórico do cliente correto.'],
        tips: ['O diagnóstico confere o escopo indicado na tela. Ele não representa autorização da prefeitura ou da SEFAZ nem substitui a revisão fiscal.'],
      },
      {
        id: 'reforma-simulacao', title: 'Gerar um cenário de IBS/CBS',
        summary: 'Compare premissas mensais e registre a simulação para análise profissional.', path: 'Reforma Tributária → Simulador IBS/CBS',
        prerequisites: ['Empresa do Simples disponível no seletor.', 'Receitas, compras e alíquotas estimadas revisadas pelo responsável fiscal.'],
        steps: [
          { title: 'Selecione a empresa', description: 'Abra Simulador IBS/CBS e escolha uma empresa do Simples.' },
          { title: 'Informe período e receita', description: 'Preencha Competência e Receita mensal (R$) para o cenário que deseja comparar.' },
          { title: 'Revise as premissas', description: 'Informe IBS/CBS dentro do Simples (%), Alíquota regular estimada (%), Compras creditáveis (R$), Alíquota média dos créditos (%) e Vendas B2B (%).' },
          { title: 'Gere o cenário', description: 'Clique em Gerar cenário e aguarde o resultado Dentro x fora do Simples.' },
          { title: 'Confronte a análise', description: 'Confira os valores retornados com as premissas informadas. Use a simulação como referência ao registrar a decisão, quando a análise estiver concluída.' },
        ], verification: ['O resultado corresponde à empresa, competência e premissas informadas.'],
        tips: ['Trata-se de um cenário paramétrico. O resultado não altera regime nem formaliza uma opção tributária.'],
        related: ['reforma-decisoes'],
      },
      {
        id: 'reforma-decisoes', title: 'Registrar decisões e imprimir o histórico',
        summary: 'Guarde a análise, as premissas e a ciência do cliente em registros sucessivos.', path: 'Reforma Tributária → Decisões e Relatórios',
        prerequisites: ['Cliente selecionado.', 'Análise concluída ou pendência identificada pelo responsável fiscal.'],
        steps: [
          { title: 'Abra um registro', description: 'Selecione o cliente e consulte Novo registro de decisão.' },
          { title: 'Identifique o estágio', description: 'Em Decisão registrada, escolha a situação correspondente à análise. Se houver, selecione a Simulação de referência.' },
          { title: 'Documente a análise', description: 'Preencha Ciência do cliente quando efetivamente obtida, Início do período, Fim do período e Parecer e premissas.' },
          { title: 'Registre a decisão', description: 'Clique em Registrar decisão e confira o novo item em Histórico e relatórios.' },
          { title: 'Revise e imprima', description: 'Consulte os registros anteriores e use Imprimir quando precisar de uma cópia. Confira a prévia antes de salvar ou imprimir.' },
        ], verification: ['A decisão aparece no histórico do cliente com a referência e o parecer corretos.'],
        tips: ['As versões anteriores não são sobrescritas. Um novo registro preserva a memória da análise.', 'Registrar decisão no sistema não realiza uma opção perante o órgão fiscal.'],
      },
      {
        id: 'reforma-split', title: 'Projetar o impacto do split payment no caixa',
        summary: 'Estime a segregação de valores a partir das receitas e das premissas informadas.', path: 'Reforma Tributária → Split Payment',
        prerequisites: ['Cliente selecionado.', 'Receitas por meio de pagamento e percentuais estimados conferidos.'],
        steps: [
          { title: 'Abra a projeção', description: 'Selecione Split Payment e escolha o cliente.' },
          { title: 'Informe as receitas', description: 'Preencha Competência, Receitas via Pix (R$), Receitas via cartão (R$), Receitas via boleto (R$) e Outros recebimentos (R$).' },
          { title: 'Defina as premissas', description: 'Informe Alíquota efetiva estimada (%) e Cobertura estimada do split (%) de acordo com o cenário analisado.' },
          { title: 'Gere e confira', description: 'Clique em Projetar impacto no caixa. Leia Impacto do split payment e compare o resultado com os parâmetros informados.' },
        ], verification: ['A projeção corresponde ao cliente, competência e valores de receita informados.'],
        tips: ['Esta tela projeta impacto financeiro; não retém tributos nem executa movimentação bancária.'],
      },
    ],
  },
  {
    id: 'relatorios', title: 'Relatórios', icon: 'ChartColumn',
    description: 'Consulte faturamento, prazos, pessoal e estudos de regimes com os filtros de cada relatório.',
    articles: [
      {
        id: 'relatorios-operacionais', title: 'Gerar relatórios de faturamento, prazos e pessoal',
        summary: 'Escolha o assunto, delimite a empresa e confira os dados antes de imprimir.', path: 'Busca do cabeçalho → Relatórios → Selecione o Relatório',
        prerequisites: ['Acesso ao módulo de relatórios.', 'Dados de cobranças, obrigações ou pessoal cadastrados, conforme o relatório.'],
        steps: [
          { title: 'Abra e escolha o assunto', description: 'Na busca do cabeçalho do sistema, digite Relatórios e escolha o resultado de módulo. Na tela aberta, selecione Faturamento & Inadimplência, Cumprimento de Prazos ou Quadro de Pessoal & Custos.' },
          { title: 'Delimite a empresa', description: 'Em Empresa Cliente, selecione uma empresa ou Todas as Empresas, conforme o alcance desejado.' },
          { title: 'Defina o período disponível', description: 'Para Faturamento & Inadimplência, informe Data Inicial e Data Final. Os relatórios de prazos e pessoal não apresentam esses filtros de datas nesta tela.' },
          { title: 'Gere e confira', description: 'Clique em Gerar Relatório e aguarde a análise. Confira indicadores e distribuições com os registros dos módulos de origem.' },
          { title: 'Imprima a versão conferida', description: 'Use Imprimir Relatório e revise a prévia. Se mudar tipo ou filtros, gere novamente antes de utilizar o resultado.' },
        ], verification: ['O título e a empresa correspondem à análise pretendida.', 'Os valores foram confrontados com cobranças, obrigações ou pessoal conforme o relatório.'],
        tips: ['Um relatório reflete os dados disponíveis no sistema. Cadastros e baixas pendentes podem alterar o resultado.'],
      },
      {
        id: 'relatorios-regimes', title: 'Gerar um comparativo de regimes',
        summary: 'Consulte uma estimativa gerencial com faturamento e folha anuais.', path: 'Busca do cabeçalho → Relatórios → Comparativo de Regimes',
        prerequisites: ['Faturamento anual e folha anual estimados e conferidos.', 'Revisão do estudo por um responsável fiscal.'],
        steps: [
          { title: 'Escolha o estudo', description: 'Busque Relatórios no cabeçalho do sistema e abra o resultado de módulo. Em Selecione o Relatório, escolha Comparativo de Regimes.' },
          { title: 'Informe as bases anuais', description: 'Preencha Faturamento Anual (R$) e Folha de Pagamento Anual (R$). Use valores do mesmo período e confira se não informou valores mensais.' },
          { title: 'Gere a comparação', description: 'Clique em Gerar Relatório e aguarde os resultados apresentados para os regimes.' },
          { title: 'Revise e imprima', description: 'Confira alíquotas efetivas, impostos, custo previdenciário e custo total apresentados. Use Imprimir Relatório apenas após revisar as premissas.' },
        ], verification: ['As bases anuais correspondem ao cenário analisado.'],
        tips: ['O comparativo é uma simulação com as entradas informadas; a indicação exibida não substitui a análise das particularidades da empresa nem altera seu regime.'],
      },
    ],
  },
];
