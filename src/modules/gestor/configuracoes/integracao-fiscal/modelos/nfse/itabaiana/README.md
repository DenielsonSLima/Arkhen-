# Layout próprio da NFS-e de Itabaiana/SE

Modelo A4 inspirado na organização do PDF fornecido pelo usuário, com ornamento próprio e identificadores da nota representada. O quadro de validação recebe destaque no canto superior direito, com número, código de verificação, QR Code vetorial de 27 mm e código de barras quando há chave nacional compatível. O WebISS autoriza a NFS-e; o aplicativo apresenta o XML confirmado neste layout, com texto selecionável e brasão, sem marca d’água decorativa. Não é uma nova autorização fiscal nem o PDF oficial do portal.

## Arquivos e uso

- `gerarNfsePdf.ts`: gerador independente da interface, com os dados já extraídos do XML.
- `pdfLayout.ts`: medidas, hierarquia visual, campos, paginação e rodapé.
- `modelo.ts`: ambiente explícito, município, legendas de códigos e endereços de validação.
- `qrCode.ts`: seleção do destino e geração do QR Code vetorial, com margem branca de quatro módulos.
- `codigoBarras.ts`: extração conferida do código numérico da chave nacional e desenho ITF vetorial, preservando zeros iniciais.
- `carregarModelo.ts`: imagens locais e download; jsPDF é carregado sob demanda.
- `NfseItabaianaDocument.tsx`: prévia do mesmo PDF que será baixado.
- `assets/`: brasão SVG vetorial e PNG derivado em 1500 × 1840. A marca da empresa não é aplicada à NFS-e.
- `exemplo.test-fixture.ts`: XML artificial para testes, não transmitir ao WebISS.

```ts
const summary = parseFiscalXml(xmlConfirmadoPeloWebiss);
await baixarNfsePdf(summary.nfse!, {
  ambiente: 'homologacao', // Usar o ambiente confirmado no contexto da emissão.
});
```

`homologacao` recebe aviso de ausência de valor fiscal em todas as páginas. `producao` utiliza o link municipal. XML importado sem contexto usa `nao_identificado`, sem inferir o ambiente pelo número, data, CNPJ ou presença de um código de verificação. O município gerador tem precedência sobre o endereço do prestador. Não usar este modelo para Itabaiana/PB.

Desde 10/09/2026, o PDF e a prévia da NFS-e não aplicam marca d’água decorativa, texto de fundo ou papel timbrado da empresa. O carregamento não consulta a configuração de marca nem baixa sua imagem. A configuração global continua disponível para os demais documentos.

As margens do modelo municipal ficam em 4 mm, sem reserva para faixa decorativa. Brasão, quadro de validação, QR, código de barras e avisos de ambiente, demonstração, cancelamento e substituição são preservados.

A decisão e suas fontes estão registradas em `docs/integrations/webiss/reuniao-marca-dagua-nfse-2026-09-10.md`. A retirada da personalização não transforma este espelho WebISS em DANFSe nacional nem certifica a adequação integral à NT 008.

## Integração implementada

O visualizador de XML encaminha Itabaiana para este gerador. Em Financeiro / Contas a Receber, `PDF da NFS-e` fica disponível após uma emissão/consulta confirmada ou para uma cobrança que já tenha NFS-e de produção.

- Produção: lê `financeiro_cobrancas.nfse_payload.xml`, filtrando empresa, cobrança e número.
- Homologação: lê o XML do registro de sucesso, filtrando empresa, cobrança, número e ambiente. A confirmação da Edge Function passa a gravar `cobrancaId` no payload, além de `tentativaId`, para manter esse vínculo sem criar tabela ou migration.
- Consulta e emissão continuam no conector existente. Gerar/baixar o PDF não transmite nem reemite a nota.
- A versão local da Edge Function `fiscal-integration` precisa ser publicada junto com o frontend para novas confirmações de homologação gravarem esse vínculo. Registros antigos sem `cobrancaId` não são selecionados por aproximação; seus XMLs precisam ser recuperados explicitamente. Nesta tarefa não houve publicação nem emissão real.

## Fidelidade dos dados

A leitura está em `documentos/xml/nfse/parseNfse.ts`: usa `InfNfse/ValoresNfse` para valores autorizados e `Servico/Valores` para serviços, deduções, descontos e retenções. `IssRetido` é lido no grupo `Servico`; é um indicador, distinto de um valor monetário. Para Itabaiana/WebISS, a alíquota é lida em pontos percentuais conforme `tsAliquota` do manual v5.2: `3.5100` é apresentado como `3,5100%`, inclusive quando menor que 1 (sem heurística por magnitude). Isso coincide com a serialização atual do emissor RPS. A escala anterior dos demais municípios foi preservada. Os testes integram o builder do RPS ao leitor de um retorno simulado; ainda falta confrontar com XML autorizado real. Nenhum tributo, base, total ou retenção é calculado pelo frontend.

Campos ausentes ficam com traço; valores presentes não são ocultados ou substituídos por asteriscos somente porque o exemplo os oculta. Descontos condicionados e incondicionados permanecem separados. Chave de acesso, NBS e folhas dos grupos IBS/CBS são preservados, quando presentes. Os grupos IBS/CBS adicionais mantêm o caminho XML para evitar somar/confundir campos com o mesmo nome.

O QR Code é gerado por `qrcode` 1.5.4 em módulos vetoriais, com correção de erros M. Links fornecidos no XML só são aceitos para o host WebISS do mesmo ambiente e caminho `/externo/nfse/`. Tokens opacos recebidos no XML são preservados com instrução de leitura pelo portal WebISS. Sem token/link específico, o QR abre a consulta pública do ambiente, com a legenda “Escaneie e informe o código de verificação”. O ambiente desconhecido não recebe QR presumido de produção; demonstrações sempre usam o portal, sem reaproveitar token fiscal.

O QR do PDF de referência foi decodificado localmente e contém um token opaco em base64, não uma URL. O [leitor oficial do portal](https://itabaianase.webiss.com.br/Scripts/interno/issqn/notas-fiscais/mobile/validador.js?v=5.3.0.29), função `read`, encaminha o conteúdo lido ao formulário de validação mobile. Não foi encontrada uma regra para fabricar esse token a partir do número/código; ele não é inventado nem copiado do exemplo para outra nota. O QR do PDF demonstrativo gerado foi lido por `jsQR`, confirmando o destino de homologação.

## Fontes consultadas em 09/09/2026

- [Manuais oficiais WebISS de Itabaiana](https://itabaianase.webiss.com.br/externo/manual/visualizar): manual revisado ABRASF 2.02 e extensões IBS/CBS. O acervo já existente em `docs/integrations/webiss/fontes/oficial/` foi usado para verificar a estrutura `tcInfNfse`, `tcValoresNfse`, `tcDadosServico` e `tcValoresDeclaracaoServico`.
- [Validação municipal de NFS-e](https://itabaianase.webiss.com.br/externo/nfse/validar) e [portal de homologação](https://homologacao.webiss.com.br/).
- [Prefeitura de Itabaiana/SE](https://itabaiana.se.gov.br/) e [Símbolos e Hinos](https://itabaiana.se.gov.br/texto/simbolos-e-hinos/3), para identificação do município. Os dados do Departamento Tributário são do portal WebISS e do exemplo.
- [Brasão vetorial por BrCaLeTo, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bras%C3%A3o_de_Itabaiana_-_SE.svg), sob [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). SVG original preservado sem alterações; PNG rasterizado com CairoSVG 2.8.2. Trata-se da representação vetorial publicada pelo autor, não de um SVG certificado pela prefeitura. A imagem já era vetorial, dispensando vetorização de bitmap.
- [Documentação do jsPDF](https://github.com/parallax/jsPDF), biblioteca já instalada no projeto.

Não foi localizada, no material consultado, autorização específica do WebISS para marca d’água decorativa nem vedação municipal expressa. A personalização do espelho local foi removida na revisão de 10/09/2026. O XML original e a consulta de autenticidade continuam preservados.

## Verificação

Build TypeScript/Vite, testes de parser, separação dos ambientes, município, valores ausentes, IBS/CBS, seleção de XML por empresa/cobrança e emissão/reconciliação. PDF demonstrativo gerado pelo mesmo código e inspecionado por Poppler; descrição longa verificada em múltiplas páginas. Sem testes em navegador, conforme `.agents/AGENTS.md`. As duas tabelas foram conferidas por consulta de metadados: colunas existentes, RLS habilitado e SELECT autorizado para authenticated; nenhum dado fiscal real foi consultado.

## Ajustes após a reunião de comparação

O layout foi aproximado da referência: margens de 4 mm, divisórias cinza, títulos pretos, campos em negrito, endereço em negrito/itálico, cabeçalho compacto, área ampla para descrição e total destacado à direita. O QR tem 27 mm, dentro de quadro cinza texturizado com moldura dupla, faixa municipal vertical e número dividido em duas linhas, conforme a composição da referência. `quadroValidacao.ts` desenha os ornamentos em vetores próprios; o código de autenticação vem dos dados da nota e não da imagem de referência. As fontes Liberation Sans são incorporadas ao PDF, evitando substituições de fonte no computador do destinatário. São carregadas sob demanda a partir do `pdfjs-dist`; licença SIL OFL 1.1 distribuída em `public/licenses/nfse-fontes-liberation.txt`.

O campo destacado “Valor Total da Nota” tem subtítulo “Bruto dos serviços” e repete **exclusivamente `Servico/Valores/ValorServicos`**. Esta é a semântica explícita do espelho local; não se presume equivalência universal com qualquer total do provedor. Descontos, retenções e líquido permanecem separados; nenhum valor é recalculado.

`MunicipioIncidencia` agora aparece junto da exigibilidade, independentemente do município da prestação. Quando ausente, não é inferido. Ambiente e cancelamento aparecem simultaneamente em todas as páginas. A descrição de enquadramento recebida no XML tem precedência; os itens explícitos 17.03 e 17.19 têm legendas da [LC 116 no Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm). Outros itens permanecem como código quando não há descrição conhecida. Não se classifica o serviço pelo CNAE ou pelo texto livre.

A imagem institucional encontrada no [site da prefeitura](https://itabaiana.se.gov.br/departamento/) também usa coroa prateada. Uma cópia pública está arquivada em `docs/integrations/webiss/material-apoio/logo-prefeitura-itabaiana-2026.png`, origem `https://itabaiana.se.gov.br/img/logo/media_prefeitura-itabaiana-1080x720_25fcc73a5e0e833756cfffd.png`. Isso dá suporte à manutenção da coroa prateada; não certifica a equivalência de cada traço do SVG do Commons nem a aprovação do espelho fiscal. O brasão amarelo do PDF original não foi redesenhado por suposição.

Validação desta revisão: 25 testes em 5 suítes, TypeScript/Vite, leitura independente do QR do PDF com jsQR, inspeção colorida e em tons de cinza e amostra de quatro páginas com 180 linhas, conferindo continuidade e avisos de cancelamento/ambiente em todas as páginas. Nenhuma emissão ou publicação remota.

## Histórico: conferência da marca cadastrada (comportamento removido)

Em 09/09/2026, a configuração consultada estava habilitada, centralizada, com tamanho e opacidade em 100%. A imagem já continha o logo suave e a faixa dourada esquerda. A prévia foi regenerada com esse arquivo real, mantendo os identificadores fiscais fictícios da fixture. Conferidas a página inteira, a continuidade em três páginas, a leitura do QR e a margem dos textos fora da faixa lateral. Consulta por empresa, RLS e permissão de leitura verificadas sem alteração remota.

## Código de barras conferido em 10/09/2026

Foram decodificadas as barras de dois PDFs WebISS independentes: a nota 2026000000292 fornecida pelo usuário e a nota pública 2026000000022, primeira página de `docs/integrations/webiss/fontes/municipio/nfse-publica-itabaiana-2026-04-01.pdf`. Ambas usam Interleaved 2 of 5 (ITF), sem dígito adicional, com razão largo/estreito 3:1. Os conteúdos lidos foram respectivamente `0003063115` e `0002867418`; correspondem ao campo numérico de nove posições da chave nacional, completado com zero à esquerda para dez posições. Essa correspondência é **observação dos dois documentos**, não uma regra universal publicada pelo WebISS.

A [tabela de composição da chave do guia oficial NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/guia-emissorpubliconacionalweb_snnfse-ern-v12.pdf), página 95, identifica as posições dos campos; a soma da tabela é 50 caracteres, apesar de o parágrafo introdutório do guia citar 44. O [codificador ITF do JsBarcode](https://github.com/lindell/JsBarcode/blob/master/src/barcodes/ITF/ITF.js) também foi consultado para conferir a simbologia. Nenhum pacote adicional foi incorporado.

O modelo lê a chave recebida em `NfseFiscalData.chaveAcesso`, já extraída de `ChaveAcesso` no XML. Só desenha as barras para uma chave numérica de 50 posições de Itabaiana/SE cujo CPF/CNPJ e número coincidam com a nota; sem chave, em demonstração ou ambiente desconhecido, preserva o quadro sem inventar identificador. Não calcula tributos, não altera a chave nem deriva o código a partir do número da NFS-e. O ITF serve como representação do identificador observado; não substitui a consulta de autenticidade pelo WebISS.

O painel cresce de 60 para 69 mm quando há barras, preservando o QR de 27 mm, barras com 7 mm de altura e margem branca lateral de dez módulos. O início do bloco do prestador acompanha essa altura. Testes cobrem a sequência exata de 57 elementos do selo original, o segundo exemplar, ausência/divergência de chave e paginação; o PDF resultante também foi renderizado localmente para conferir o espaço de ambos os códigos.
