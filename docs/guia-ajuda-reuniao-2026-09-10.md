# Manual modular — reunião e implementação

Data: 10/09/2026. Solicitação: substituir o guia resumido por módulos separados e tutoriais completos para usuários novos, com reunião de três agentes.

## Participantes e decisões

- **manual_cadastros:** mapeou Parceiros e todos os itens de Parametrização. Entregou 22 artigos sobre localização, cadastro PF/PJ, edição, filiais, obrigações e cadastros de apoio.
- **manual_operacao:** mapeou Início, Atividades, Acompanhamento, Documentos e Agenda. Entregou 23 artigos de preparação, execução, organização e conferência.
- **manual_gestao:** mapeou Faturamento, Financeiro, Simulações, Reforma Tributária, Configurações e Relatórios. Entregou 37 artigos e documentou os recursos indisponíveis ou demonstrativos.
- **Integração principal:** implementou catálogo, primeiros passos, busca global sem distinção de acentos, índice por módulo, leitura individual, assuntos relacionados e navegação anterior/próximo.

Total final: **13 módulos e 84 tutoriais**. A revisão do faturamento acrescentou dois tutoriais sobre configuração e execuções recorrentes. Cada artigo contém finalidade, caminho na interface, pré-requisitos, passos numerados e verificação do resultado. Dicas explicam condições e limites reais.

## Fundamentação e revisão cruzada

O conteúdo foi conferido nas páginas, componentes, formulários e fluxos existentes em `src/modules/gestor/`. As capturas do usuário serviram como referência do guia anterior. Não foram incorporados prints com dados de clientes.

Achados incorporados:

- Configurar obrigações por matriz/filial é diferente de executar e gerar rotinas.
- As abas de parceiros dependem do tipo de relacionamento e dos dados da matriz.
- Concluir e reabrir entregas exige evidência; guardar arquivos ocorre em Documentos.
- A transmissão pelo formulário de rascunho NFS-e se limita à homologação; ações fiscais de cobranças têm fluxo próprio.
- Edição de recorrências, cancelamento no histórico NFS-e, determinadas ações de inadimplência e baixa manual Banco Inter têm restrições explícitas.
- Status das APIs usa conteúdo demonstrativo.
- Relatórios pode ser localizado pela busca do cabeçalho, apesar de não ter item no menu lateral padrão.

A revisão de interface corrigiu foco no título ao abrir um artigo, retorno de foco ao limpar a busca e apresentação do botão Anterior no último artigo. Os dados e estilos do guia são carregados sob demanda ao abrir a ajuda.

## Validação

- Build TypeScript + Vite concluído. O Vite mantém aviso sobre outros chunks grandes da aplicação; o manual possui chunk separado.
- Cinco testes de navegação, busca, foco, troca de módulo e integridade dos artigos aprovados.
- Oxlint focal e `git diff --check` sem apontamentos.
- Arquivos do módulo abaixo de 500 linhas.
- Sem alterações de banco, transmissão fiscal, operação bancária, publicação ou envio de mensagens.

## Manutenção

Os artigos ficam em `src/modules/gestor/guia-ajuda/constants/`, organizados por área. O contrato está em `types.ts`; ids de artigo devem ser únicos e os ids de `related` devem apontar a artigos existentes. Ao alterar um botão, formulário ou disponibilidade de ação, revisar o tutorial correspondente.

## Complemento: capturas reais pelo Safari

Foram acrescentadas 14 capturas reais da aplicação local, feitas exclusivamente pelo Safari: início, identificação de parceiro por CNPJ, catálogo e formulário de obrigações, fila e cadastro de tarefas, filtros de acompanhamento, novo evento, envio de documentos, simulador de rescisão, conta a pagar, opções e dados de cobrança e central de configurações.

As 14 imagens ilustram 16 tutoriais e entram no tutorial correspondente com legendas, marcações numeradas e visualizador ampliável. O catálogo completo continua com 82 tutoriais; as imagens ilustram os principais fluxos, não todas as telas de todos os artigos. Os valores do simulador são exemplos da própria interface; o acompanhamento usa uma busca sem resultados para demonstrar os filtros. Formulários foram abertos sem salvar, enviar convites, transmitir notas ou gerar cobranças. Capturas que revelavam contatos de usuários no fundo foram descartadas.

A revisão no Safari também identificou a animação de entrada do contêiner autenticado interferindo na composição visual. O ajuste foi limitado ao contêiner raiz autenticado; alterações temporárias de diagnóstico e a prévia de build foram removidas.

As capturas ficam em `public/guia-ajuda/screens/`. Ao mudar um formulário, atualize a imagem real, sua legenda e as coordenadas percentuais dos indicadores em `constants/guideScreenshots.ts`.

Validação do complemento: dez testes aprovados (navegação, visualizador e integridade de IDs/arquivos JPEG); TypeScript e Oxlint focal sem erros; build de produção concluído com o aviso já existente de chunks grandes. No Safari, foram conferidos catálogo, módulo, artigo, imagem inteira, zoom e fechamento com Esc. Não foi feita validação visual em dispositivo móvel.
