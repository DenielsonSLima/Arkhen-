# Reunião de revisão da marca d’água da NFS-e — 10/09/2026

## Decisão

Remover a marca decorativa da empresa dos PDFs e prévias de NFS-e do Arkhen. O usuário autorizou a revisão da decisão anterior de incluir a marca. A remoção abrange o fundo com imagem do modelo Itabaiana e o texto de fundo do visualizador genérico.

## Revisão normativa independente

Fonte: [NT 008, versão 1.02, de 14/07/2026](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260714-v1-02.pdf), consultada em 10/09/2026.

- Itens 2.2.3 e 2.2.4, p. 12: fundo branco nos campos/dados fora dos sombreados previstos e disposição conforme Anexo I.
- Item 2.4.3, p. 14: logomarca oficial da NFS-e no cabeçalho.
- Itens 2.5.1 e 2.5.2, p. 23: marcas fiscais de cancelamento e substituição obrigatórias.

A interpretação da revisão é que a decoração corporativa de fundo conflita com a apresentação padronizada. Não há fundamento para dizer que toda marca d’água é proibida: os indicadores fiscais têm finalidade distinta e devem ser preservados.

Para Itabaiana, o [Decreto 011/2016, art. 1º, Diário Oficial p. 7](https://itabaiana.se.gov.br/download/18066-i7r7w4e8a9u6n7b5_136e7cb9b59d640eab82db7fe2d.pdf) remete ao modelo ABRASF e seu Anexo I. Não foi localizada vedação municipal expressa à decoração. A retirada do espelho próprio é uma decisão conservadora autorizada pelo usuário.

## Revisão técnica independente e implementação

O caminho atual trata XML WebISS/ABRASF e produz um espelho municipal. A presença de chave nacional no retorno não converte esse gerador em DANFSe nacional. Esta alteração não certifica conformidade integral com a NT 008 nem implementa o leiaute nacional.

- Removidos desenho da imagem, texto de fundo e estilos da marca decorativa.
- Removidas consulta da configuração e transferência da imagem no carregamento da NFS-e; a prévia deixa de depender dessa consulta.
- Margem esquerda do modelo Itabaiana fixada em 4 mm, sem faixa decorativa.
- Preservados brasão, QR, barras, dados do XML e avisos existentes de ambiente, demonstração, cancelamento e substituição.
- Cadastro global de marca d’água e demais documentos permanecem intactos.
- Utilitário exclusivo da marca na NFS-e e seus testes obsoletos removidos; documentação do modelo atualizada.

A revisão independente do diff não encontrou bloqueios, imports quebrados ou arquivos acima de 500 linhas.

## Validação e entrega

- Build TypeScript/Vite aprovado; aviso de chunks acima de 500 kB.
- 38 testes aprovados em 7 suítes: modelo, contrato fiscal, QR, barras e fluxos relacionados do Financeiro/Faturamento.
- PDF demonstrativo de uma página e amostra de quatro páginas gerados pelo código alterado e renderizados localmente com Poppler, sem navegador.
- Inspeção confirmou ausência de decoração, legibilidade e continuidade. Extração de texto confirmou avisos de demonstração e cancelamento nas quatro páginas.
- Leitura independente do QR com jsQR confirmou o portal de homologação. Inventário de imagens do PDF contém apenas o brasão e sua máscara de transparência.
- `git diff --check` aprovado.

Alteração local, sem publicação, emissão, reemissão ou modificação de documento fiscal autorizado. PDFs já baixados continuam com o conteúdo original; novos downloads usarão o código atualizado após sua publicação.
