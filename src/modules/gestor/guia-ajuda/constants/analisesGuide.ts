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
