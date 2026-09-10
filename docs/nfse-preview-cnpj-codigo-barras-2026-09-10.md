# Reunião de revisão — histórico e PDF da NFS-e

Data: 10/09/2026. Solicitações: prévia PDF em modal antes do download; documento do parceiro abaixo do nome; código de barras sob o QR conforme os PDFs apresentados.

## Participantes e decisões

- **cnpj_historico:** conferiu a origem dos dados. A lista fiscal não projeta documento do tomador, mas a consulta de parceiros já carregada contém CPF/CNPJ. Implementado vínculo exato por `clienteId`, sem associar nomes iguais. O documento formatado aparece abaixo do nome; a origem da nota segue na linha seguinte.
- **barcode_nfse:** constatou que o modelo desenhava QR e legenda, sem barras. Reproduzir somente o payload sustentado pela chave nacional real recebida; não usar número da nota ou código de verificação como substitutos.
- **revisor_pdf:** decodificou independentemente o código ITF do PDF original e de um segundo PDF público. A nota 292 codifica `0003063115`; a segunda referência codifica `0002867418`. As duas confirmam o zero de preenchimento seguido do código numérico de nove posições presente na chave nacional.
- **Integração principal:** implementou modal com carregamento, erro, repetição, fechamento e download opcional do mesmo blob usado na prévia. A geração reutiliza o modelo e a configuração de marca d’água da empresa. Consultou somente os campos necessários dos XMLs já importados, com empresa/ambiente/notas delimitados, confirmando a chave usada pelo modelo.

## Escopo e revisão

Não foram alterados valores tributários, emitidas notas, geradas cobranças ou feitas mudanças no banco. O botão XML mantém download direto; o botão PDF abre a prévia. A consulta de documento conserva a RPC existente e as validações de empresa, ambiente e número do XML.

O visualizador usa o PDF nativo em iframe. O botão Fechar permanece disponível; eventos de teclado dentro do leitor nativo dependem do navegador. URLs temporárias são liberadas ao fechar, e respostas de geração concluídas após o fechamento são descartadas.

## Validação final

- Build TypeScript/Vite aprovado; permanece o aviso preexistente sobre chunks grandes da aplicação.
- 64 testes aprovados em 14 arquivos de faturamento, modelo Itabaiana e guia de ajuda.
- Oxlint focal e conferência de whitespace sem erros.
- PDF de teste renderizado em uma página e inspecionado: QR e código de barras separados, sem sobrepor os dados do prestador ou o rodapé. O quadro tem altura dinâmica, preservando 27 mm do QR e 7 mm das barras.
- O código de barras depende de chave nacional recebida e compatível com prestador/número/município. Quando esse dado não existe ou é incompatível, não se inventa um identificador.
- Leitura independente do PDF renderizado confirmou ITF `0003063115` em três linhas de varredura e QR direcionando ao portal de validação de homologação. O artefato usa fixture de teste sem transmissão fiscal.
