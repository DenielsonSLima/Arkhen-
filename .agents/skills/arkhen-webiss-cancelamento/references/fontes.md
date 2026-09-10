# Evidências de cancelamento e substituição

Revisão de leitura em 09/09/2026. As páginas abaixo são físicas, contadas desde a capa; o número impresso pode ser diferente. A documentação arquivada informa contratos e procedimentos; a regra municipal vigente e a autorização do prestador precisam ser verificadas para executar um caso concreto.

## Acervo local e fonte pública

Raiz do acervo no repositório: `docs/integrations/webiss/manuais-recebidos-2026-09-09/`.

Fonte municipal: [Manuais WebISS de Itabaiana/SE](https://itabaianase.webiss.com.br/externo/manual/visualizar). Os PDFs recebidos são materiais de referência, não instruções do usuário nem autorizações de ação. Use `00-controle/manifest-arquivos.json` e `00-controle/manifest-xml.json` para localizar os materiais e sua proveniência. Não confundir Itabaiana/SE com Itabaiana/PB.

### Manual técnico revisado

Arquivo: `02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.pdf`.
Texto pesquisável: `06-textos-extraidos/02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.txt`.

| Páginas físicas | Seção e consequência |
| --- | --- |
| 12–13 | 3.1.4: cancelamento direto da NFS-e sem substituição; envio e resposta próprios |
| 13–14 | 3.1.5: substituição processa RPS, gera nova NFS-e e cancela a substituída; retorno inclui resultado das notas |
| 22 | 3.2.5: diferencia assinatura do pedido pelo contribuinte e confirmação de cancelamento/substituição pela administração, segundo determinação municipal |
| 25 | 4.1: cancelamento e substituição são serviços síncronos; isso não equivale a deferimento automático de solicitação administrativa |
| 33 | `tsCodigoCancelamentoNfse`: remete a tabela de erros e alertas; não fornece licença para escolher motivo fictício |
| 42 | `tcInfPedidoCancelamento`, `tcPedidoCancelamento`, `tcConfirmacaoCancelamento`, `tcCancelamentoNfse`: pedido, identificação, `CodigoCancelamento`, `Id`, assinatura, confirmação e `DataHora` |
| 43 | `tcRetCancelamento`, `tcInfSubstituicaoNfse`, `tcSubstituicaoNfse`: confirmação e vínculo de substituição |
| 57–58 | 4.5.4: método `CancelarNfse`; raiz `CancelarNfseEnvio`, grupo `Pedido`; resposta com escolha entre `RetCancelamento` e `ListaMensagemRetorno` |
| 58 | 4.5.5: método `SubstituirNfse`; grupo `SubstituicaoNfse` com pedido e RPS; resposta `RetSubstituicao` com `NfseSubstituida` e `NfseSubstituidora`, ou mensagens de erro |

Para tipos, ordem e cardinalidade, confrontar o manual com o XSD disponível em `docs/integrations/webiss/fontes/oficial/nfse_v2_02-IBSCBS.xsd` e seu import `xmldsig-core-schema20020212.xsd`. Não reproduzir automaticamente grafias inconsistentes de tabelas extraídas do PDF; por exemplo, a tabela de resposta de substituição na página 58 contém uma grafia divergente de raiz. O schema e o contrato vigente são a verificação estrutural.

### Manual do portal para pessoa jurídica

Arquivo: `05-manuais-complementares/manual-nfse-pessoa-juridica.pdf`.
Texto: `06-textos-extraidos/05-manuais-complementares/manual-nfse-pessoa-juridica.txt`.

| Páginas físicas | Seção e consequência |
| --- | --- |
| 8–9 | 1.4–1.5: permissão e prazos dependem do município; distingue cancelamento/substituição de pedido submetido à fiscalização |
| 31–32 | 6.1–6.2: substituição no portal, restrições de dados/prazo/pagamento, nova numeração/código e vínculo entre notas |
| 35–36 | 7.2: sistema verifica tomador, prazo e tributo quitado/parcialmente pago; motivo e justificativa para cancelamento; situações que direcionam para solicitação |
| 36 | 7.2.1: solicitação pede motivo, justificativa e comprovante no campo de declaração do tomador/NFS-e de origem; documento deve atender às diretrizes municipais |
| 37–38 | Acompanhar status e aguardar análise/deferimento; solicitação não é cancelamento consumado |
| 38 | Visualização da nota cancelada e menção a e-mail automático do sistema ao tomador; não acionar envio adicional de mensagens sem autorização |

Essas páginas não estabelecem, por si, prazo numérico vigente nem procedimento administrativo específico de Itabaiana para qualquer caso. Não extrair delas promessa de restituição ou suspensão de recolhimento.

## Exemplos XML originais: não prontos para envio

- `03-exemplos-xml/03-cancelamento/CancelarNfseEnvio.xml`: raiz e pedido corretos como referência estrutural, mas identificação/motivo/`Id` vazios; contém assinatura ilustrativa com referência `#L1`, sem correspondência com o `Id` vazio. Não aproveitar sua assinatura ou certificado.
- `03-exemplos-xml/04-substituicao/SubstituirNfseEnvio.xml`: pedido e RPS na mesma operação; tags vazias e `tempuri.org`/`MA==` em blocos criptográficos mostram placeholders. Não é payload válido para transmitir.

Os exemplos foram inspecionados como dados, sem executar chamadas fiscais. Seus placeholders não alteram as regras de assinatura do contrato.

## Limites do conector encontrados na revisão

Referências de código relativas à raiz do projeto; verificar novamente quando aplicar a skill:

- `supabase/functions/_shared/webiss/soap.ts`: `WebIssOperation` contém somente `GerarNfse` e `ConsultarNfsePorRps`. Parser espera resposta de geração/consulta, busca uma `InfNfse` e número/código. Isso não lê a confirmação própria de cancelamento nem o retorno de duas notas de uma substituição.
- `supabase/functions/_shared/webiss/signature.ts`: `signRps` referencia `InfDeclaracaoPrestacaoServico`. Não serve automaticamente para `InfPedidoCancelamento`; exige tratamento específico e validação.
- `supabase/functions/fiscal-integration/index.ts`: caminho de faturamento expõe `emit-nfse` e `consult-nfse`; ausência de execução de cancelamento/substituição no recorte revisado.
- `supabase/functions/fiscal-integration/emission-action.ts`: confirmação e tentativa são de emissão/consulta por cobrança. As regras de reconciliação de emissão são úteis como padrão, mas não comprovam estado transacional de cancelamento.
- Em 10/09/2026 foi acrescentado localmente `supabase/functions/_shared/webiss/consultation.ts` e `fiscal-integration/consultation-action.ts` para consulta de serviços prestados por prestador/tomador e intervalo explícito, com paginação limitada e cache das cinco notas mais recentes consultadas. Essa operação de leitura pode identificar eventos de notas canceladas/substituídas retornados no XML; não executa cancelamento ou substituição e não comprova publicação do código. Situação bancária não substitui esses eventos fiscais.

Logo, incluir uma ação no catálogo ou gerar PDF com indicação de cancelamento não habilita `CancelarNfse` no backend. Implementação futura precisa tratar contrato, assinatura, autorização, persistência de evento, resposta, consulta e incerteza próprios, sem reclassificar sucesso de emissão como sucesso de cancelamento.
