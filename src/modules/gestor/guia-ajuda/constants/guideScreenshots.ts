import type { GuideScreenshot } from '../types';

const screen = (file: string, alt: string, caption: string, markers: GuideScreenshot['markers']): GuideScreenshot => ({
  src: `/guia-ajuda/screens/${file}.jpg`, alt, caption, markers,
});

const inicio = screen('inicio', 'Painel inicial com indicadores de atividades, prazos e agenda',
  'Início: localize os indicadores e os compromissos. Os números refletem o momento da captura.', [
    { x: 39, y: 44, label: 'Prazos pendentes', description: 'Confira o total de pendências e a indicação de atividades atrasadas.' },
    { x: 20, y: 61, label: 'Agenda de hoje', description: 'Veja os compromissos apresentados para o dia.' },
    { x: 60, y: 62, label: 'Próximos dias', description: 'Use a semana operacional para antecipar as próximas entregas.' },
  ]);

const parceiro = screen('parceiro-cnpj', 'Formulário Cadastrar Parceiro na etapa Identificação, com CNPJ selecionado',
  'Cadastro de parceiro: primeira etapa do formulário de empresa, antes de preencher ou salvar.', [
    { x: 24, y: 29, label: 'Etapas do cadastro', description: 'O formulário organiza identificação, contatos, endereço fiscal e pastas padrão.' },
    { x: 41, y: 40, label: 'Documento e identificação', description: 'Informe o CNPJ e confira razão social, nome fantasia e classificações do parceiro.' },
    { x: 74, y: 85, label: 'Avançar', description: 'Após conferir os campos obrigatórios desta etapa, continue para os demais dados.' },
  ]);

const obrigacoes = screen('obrigacoes', 'Catálogo de obrigações com busca, filtros, cartões e botão Nova obrigação',
  'Obrigações: encontre um modelo existente ou comece um novo cadastro.', [
    { x: 89, y: 25, label: 'Nova obrigação', description: 'Abre o cadastro de identificação, prazos, regimes e fluxo operacional.' },
    { x: 20, y: 44, label: 'Busca e filtros', description: 'Pesquise pelo nome e combine regime, categoria e status para localizar o modelo.' },
    { x: 41, y: 85, label: 'Editar o modelo', description: 'O botão Editar fica no rodapé de cada cartão. Confira o nome da obrigação antes de abrir.' },
  ]);

const obrigacaoNova = screen('obrigacao-nova', 'Painel Nova obrigação com identificação, prazo, período e regimes aplicáveis',
  'Nova obrigação: organize os dados e o calendário. As seleções exibidas são o estado inicial do formulário.', [
    { x: 54, y: 31, label: 'Identificação', description: 'Preencha o nome e confira categoria, órgão, origem padrão e descrição.' },
    { x: 54, y: 64, label: 'Prazo e período', description: 'Revise periodicidade, existência de vencimento, dia e relação com a competência.' },
    { x: 54, y: 82, label: 'Regimes aplicáveis', description: 'Selecione os regimes em que o modelo poderá ser ativado. Role o painel para continuar a configuração.' },
  ]);

const tarefas = screen('tarefas', 'Minha Fila com filtros Hoje, Semana, Mês, Atrasadas e Internas, sem tarefas no filtro',
  'Minha Fila: exemplo de uma consulta sem tarefas no filtro selecionado.', [
    { x: 17, y: 30, label: 'Período e tipo de tarefa', description: 'Alterne entre Hoje, Semana, Mês, Atrasadas e Internas conforme a rotina desejada.' },
    { x: 17, y: 36, label: 'Busca e data', description: 'Pesquise por título, cliente ou responsável e confira a data usada na consulta.' },
    { x: 95, y: 30, label: 'Nova tarefa', description: 'Abra o formulário para registrar uma atividade avulsa.' },
  ]);

const tarefaNova = screen('tarefa-nova', 'Formulário Nova Tarefa com título, empresa, prioridade, prazo e checklist',
  'Nova tarefa: dê contexto à atividade antes de confirmar o cadastro.', [
    { x: 38, y: 33, label: 'Título e vínculo', description: 'Descreva a atividade e escolha o cliente ou o escritório ao qual ela pertence.' },
    { x: 38, y: 53, label: 'Prazo e checklist', description: 'Confira o vencimento e escreva uma etapa por linha no checklist.' },
    { x: 59, y: 79, label: 'Criar Atividade', description: 'Revise categoria, prioridade e notas antes de criar a tarefa.' },
  ]);

const acompanhamento = screen('acompanhamento', 'Acompanhamento com busca Exemplo do manual e mensagem Nenhuma empresa encontrada',
  'Acompanhamento: a busca “Exemplo do manual” foi usada para mostrar os filtros sem exibir empresas.', [
    { x: 17, y: 29, label: 'Busca e intervalo', description: 'Troque o texto pelo nome que deseja localizar e confira as datas inicial e final.' },
    { x: 17, y: 38, label: 'Status da empresa', description: 'Alterne entre Ativas, Inativas e Todas conforme a empresa procurada.' },
    { x: 59, y: 38, label: 'Situação do item', description: 'Escolha Pendentes, Concluídos ou Todos. Se a consulta ficar vazia, revise os filtros.' },
  ]);

const evento = screen('evento-novo', 'Formulário Novo Evento com título, data, hora, empresa, responsável e recorrência',
  'Agenda: confira os campos de um novo evento e a opção de repetição.', [
    { x: 23, y: 33, label: 'Título do compromisso', description: 'Use um título que permita identificar a tarefa ou reunião na agenda.' },
    { x: 23, y: 47, label: 'Data e vínculos', description: 'Informe a data, a hora quando necessário e confira empresa e responsável disponíveis para seu perfil.' },
    { x: 23, y: 73, label: 'Repetição', description: 'Marque esta opção quando o evento for periódico e revise a recorrência antes de salvar.' },
  ]);

const documento = screen('documento-enviar', 'Modal Enviar arquivo com destino, seleção de arquivos, categoria, descrição e validade',
  'Documentos: o destino aparece no topo do envio. Nesta captura, é a Biblioteca principal.', [
    { x: 34, y: 31, label: 'Destino do envio', description: 'Confira a biblioteca ou pasta de destino antes de selecionar os documentos.' },
    { x: 42, y: 48, label: 'Escolher arquivos ou pasta', description: 'Use os botões de seleção ou arraste os itens para a área indicada.' },
    { x: 34, y: 56, label: 'Categoria e informações', description: 'Revise a categoria, informe a descrição e ative o controle de validade quando necessário, antes de Enviar.' },
  ]);

const simulacoes = screen('simulacoes', 'Calculadora de Rescisão com formulário à esquerda, verbas à direita e botão Gerar relatório PDF',
  'Simulações: os valores exibidos são os exemplos iniciais da tela e não constituem um cálculo recomendado para seu caso.', [
    { x: 19, y: 42, label: 'Dados da rescisão', description: 'Confira o tipo, o aviso prévio, o salário e as datas; role a tela para revisar os demais campos.' },
    { x: 59, y: 40, label: 'Conferência das verbas', description: 'Compare os valores exibidos com os dados e parâmetros que você informou antes de usar o resultado.' },
    { x: 91, y: 22, label: 'Gerar relatório PDF', description: 'Após revisar a simulação, use este botão para solicitar o relatório.' },
  ]);

const contaPagar = screen('conta-pagar', 'Formulário de contas a pagar com tipo de despesa, status, valor, datas e parcelamento',
  'Financeiro: cadastro de uma conta a pagar, antes de confirmar o lançamento.', [
    { x: 34, y: 37, label: 'Tipo e status', description: 'Escolha despesa fixa ou variável e confira se o registro ficará Em Aberto ou será baixado agora.' },
    { x: 34, y: 62, label: 'Valor e datas', description: 'Revise valor, data do lançamento e vencimento junto com descrição e categoria.' },
    { x: 65, y: 71, label: 'Parcelamento', description: 'Ative apenas se o lançamento for dividido em parcelas e confira os dados antes de confirmar.' },
  ]);

const faturamento = screen('faturamento-novo', 'Modal Nova cobrança com opções Apenas cobrança, Somente NFS-e e NFS-e mais cobrança',
  'Novo lançamento: escolha o tipo de operação antes de continuar.', [
    { x: 29, y: 44, label: 'Apenas cobrança', description: 'Selecione para preparar a cobrança sem nota fiscal.' },
    { x: 29, y: 54, label: 'Somente NFS-e', description: 'Selecione para preparar o rascunho fiscal e revisá-lo antes da transmissão.' },
    { x: 29, y: 63, label: 'NFS-e + cobrança', description: 'Confira esta opção quando a operação incluir cobrança e preparação da nota fiscal.' },
  ]);

const cobranca = screen('cobranca', 'Formulário Dados da cobrança com parceiro, valor, vencimento, descrição e regras de pagamento',
  'Dados da cobrança: confira destinatário, valores e condições antes de Confirmar Geração.', [
    { x: 28, y: 30, label: 'Parceiro / cliente', description: 'Pesquise o destinatário pelo nome ou CPF/CNPJ e confira quem será cobrado.' },
    { x: 28, y: 39, label: 'Valor e vencimento', description: 'Informe o valor e a descrição; ajuste o vencimento para a data combinada.' },
    { x: 28, y: 63, label: 'Pagamento e regras', description: 'Confira a forma de pagamento, desconto, juros, multa e mensagem antes de confirmar.' },
  ]);

const configuracoes = screen('configuracoes', 'Central Configurações do Sistema com atalhos para perfil, dados da empresa, permissões e módulos',
  'Configurações: localize os atalhos de preparação do escritório. A disponibilidade depende das permissões do seu perfil.', [
    { x: 46, y: 31, label: 'Dados da Empresa', description: 'Localize aqui o acesso aos dados de identificação e contato do escritório.' },
    { x: 74, y: 43, label: 'Módulos do Sistema', description: 'Este cartão abre a configuração dos módulos disponíveis para a equipe.' },
    { x: 46, y: 43, label: 'Permissões do Sistema', description: 'Confira este acesso para revisar os recursos disponíveis por perfil, conforme sua permissão administrativa.' },
  ]);

export const GUIDE_SCREENSHOTS: Partial<Record<string, GuideScreenshot[]>> = {
  'inicio-primeiro-acesso': [configuracoes],
  'inicio-painel': [inicio],
  'parceiros-cadastrar-pj': [parceiro],
  'param-obrigacoes': [obrigacoes, obrigacaoNova],
  'param-obrigacoes-prazos': [obrigacaoNova],
  'atividades-minha-fila': [tarefas],
  'atividades-nova-tarefa': [tarefaNova],
  'acompanhamento-localizar': [acompanhamento],
  'agenda-novo-evento': [evento],
  'documentos-enviar': [documento],
  'simulacoes-rescisao': [simulacoes],
  'simulacoes-pdf': [simulacoes],
  'financeiro-pagar-cadastro': [contaPagar],
  'faturamento-cobranca': [faturamento, cobranca],
  'faturamento-nfse-rascunho': [faturamento],
  'configuracoes-modulos': [configuracoes],
};
