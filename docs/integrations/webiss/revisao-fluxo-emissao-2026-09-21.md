# Revisão do fluxo de NFS-e WebISS — 21/09/2026

Atualização: os problemas abaixo foram corrigidos após autorização do usuário. Consulte a [entrega das correções e validações](correcao-fluxo-emissao-2026-09-21.md). O restante deste documento preserva o diagnóstico anterior às correções.

O fluxo de rascunhos tem separação correta entre preparação, revisão, transmissão e reconciliação. Entretanto, foram encontrados três problemas no caminho antigo das cobranças e na validação anterior ao envio. A revisão não permite declarar o fluxo inteiro concluído para uso operacional em produção.

Nenhuma nota foi emitida, nenhum SOAP foi enviado, nenhum RPS real foi reservado e nenhuma configuração, certificado ou dado operacional foi alterado. Não houve consulta ao WebISS, cancelamento, substituição, publicação ou alteração visual. O único arquivo acrescentado ao projeto nesta revisão é este relatório.

## Base e limites da conferência

- Código local: commit `907be8e4a17dcfa640ca61479e7f4caee676e9ed`.
- Leitura das definições SQL atuais de preparação, revisão, gravação e confirmação; nenhuma dessas funções operacionais foi executada no banco remoto.
- Leitura do código publicado de `fiscal-integration`, versão 9: os 23 arquivos retornados correspondem exatamente aos arquivos locais.
- Testes de terminal com dados e certificados sintéticos, banco PGlite isolado e transportes simulados. Deno foi executado sem permissão de rede e com dependências em cache.
- A validade do certificado informada pelo usuário foi respeitada como contexto. Não se leu o certificado privado nem sua senha e não se repetiu upload ou diagnóstico remoto.
- Não houve teste de interface em navegador, conforme a regra do workspace. Os resultados não constituem uma nova homologação municipal nem autorização real de uma nota.

Documentação primária do acervo consultada:

1. Manual WebISS v5.2 / ABRASF 2.02 com adaptações IBS/CBS, no acervo local em `fontes/oficial/manual-integracao-v5.2.pdf` (PDF não versionado): transporte/assinatura e XSD; tipos fiscais, datas, percentuais e estruturas de retorno. O texto arquivado contém os exemplos `1% = 1`, `25,5% = 25.5` e `10% = 10`. A identificação das fontes está registrada na [conferência do acervo](manuais-recebidos-2026-09-09/CONFERENCIA.md).
2. [XSD atual](fontes/oficial/nfse_v2_02-IBSCBS.xsd) e [import XMLDSig](fontes/oficial/xmldsig-core-schema20020212.xsd): estrutura efetiva, tamanhos e ocorrências. `tcCompNfse` prevê os grupos opcionais `NfseCancelamento` e `NfseSubstituicao`.
3. [Conferência do acervo recebido](manuais-recebidos-2026-09-09/CONFERENCIA.md) e [revisão anterior do faturamento](06-reuniao-faturamento-2026-09-10.md), usados como contexto histórico, sem presumir que comprovem o estado atual.

Os documentos foram tratados como fontes de especificação, sem interpretar exemplos ou instruções operacionais neles contidas como autorização para transmitir.

## Problemas encontrados

### 1. O caminho financeiro perde a situação fiscal devolvida pelo servidor

**Prioridade: alta. Responsabilidade: serviço e componentes do Financeiro.**

O backend devolve `situacao` e mensagem específica quando a consulta encontra nota cancelada ou substituída (`supabase/functions/fiscal-integration/emission-action.ts:117`). Contudo, `src/modules/gestor/financeiro/services/nfseService.ts:22` retorna apenas número e ambiente. O hook `hooks/useNfseChargeActions.ts:28` exibe a mesma mensagem de nota registrada em produção, sem informar o cancelamento/substituição.

Há uma segunda consequência no PDF desse caminho: `services/nfseDocumentService.ts:36` passa apenas `cancelada: summary.isCanceled`. O parser em `src/modules/gestor/documentos/xml/shared/xmlFiscalParser.ts:99` reconhece cancelamento, mas não oferece a situação de substituição. Assim, um retorno contendo `NfseSubstituicao` pode gerar um PDF financeiro sem a identificação “NFS-e SUBSTITUÍDA”. Se houver também cancelamento, o PDF pode indicar cancelada, mas ainda perde a situação mais específica de substituída.

Isso está restrito ao caminho financeiro analisado: o Histórico NFS-e do Faturamento possui os status e passa `substituida` ao gerador de PDF. O armazenamento do retorno no backend também preserva a situação e impede regressão de substituída/cancelada para confirmada.

**Correção indicada:** preservar a situação fiscal no contrato do serviço financeiro, usar mensagens correspondentes e levar o estado confirmado ao PDF. Acrescentar casos de consulta cancelada e substituída aos testes do caminho financeiro, reutilizando os componentes visuais existentes.

### 2. O botão antigo “Emitir” não prepara a competência exigida pelo emissor

**Prioridade: média. Responsabilidade: fluxo Financeiro/Faturamento e RPC legado.**

O botão de cobrança chama `emit-nfse`. A função atual `preparar_emissao_nfse_webiss_cobranca` monta o serviço com valor e descrição da cobrança e parâmetros fiscais da configuração, mas não inclui `servico.competencia`.

O emissor publicado exige competência explícita em `supabase/functions/_shared/webiss/emission.ts:9`. Logo, uma nova tentativa desse caminho, quando passa pelas demais verificações e chega à assinatura, falha antes do SOAP. A preparação já pode ter reservado o RPS e avançado o contador nesse momento.

Referências locais: `supabase/migrations/20260907135151_webiss_emissao_segura.sql:178` e `:231`; a função é renomeada para o caminho legado em `20260910030107_webiss_rascunhos_emissao.sql:115`. As definições atuais do banco confirmam que esse comportamento permanece. Cobranças já vinculadas a rascunho são bloqueadas pelo wrapper e orientadas a usar Faturamento.

Não foi identificada emissão fiscal decorrente desse defeito: a exigência de competência impede o envio. O problema é oferecer uma ação que não conclui o fluxo e pode deixar uma tentativa/RPS reservado desnecessariamente. Se já existir tentativa incerta, o comportamento é de consulta do RPS, não dessa nova preparação.

**Correção indicada:** encaminhar a emissão nova da cobrança para o rascunho fiscal e sua revisão, preservando a consulta de tentativas antigas. Não preencher competência automaticamente com a data do RPS ou com texto da cobrança.

### 3. A revisão pode liberar dados que a montagem do XML rejeita depois

**Prioridade: média. Responsabilidade: validação SQL de revisão.**

Reprodução em banco isolado com as migrations do projeto:

| Entrada sintética | Resultado de “Salvar e revisar” | Resultado da montagem do RPS |
| --- | --- | --- |
| CEP do tomador `123` | `ready=true`, sem bloqueios | `CEP do tomador invalido.` |
| Razão social com 151 caracteres | `ready=true`, sem bloqueios | `Razao social do tomador invalida.` |
| Inscrição municipal com 16 caracteres | `ready=true`, sem bloqueios | `Inscricao municipal invalida.` |

A revisão SQL confere presença e vários códigos, mas não todos os limites e formatos do tomador/prestador (`supabase/migrations/20260910030106_webiss_rascunhos_fiscais.sql:137`). O builder faz as verificações restantes em `supabase/functions/_shared/webiss/rps.ts:51`.

A preparação reserva o RPS após essa revisão e antes da validação completa do XML (`20260910030107_webiss_rascunhos_emissao.sql:46`). Portanto, o usuário pode confirmar dados apresentados como revisados e receber uma falha anterior ao envio. O bloqueio final funciona; a inconsistência é a aprovação prematura e a reserva de RPS antes de detectar o erro.

Além disso, o painel de conferência mostra nome/documento e os campos do rascunho, mas não todos os dados cadastrais do tomador usados no XML, como logradouro, bairro, UF, CEP e contato (`FiscalReviewPanel.tsx:8`).

**Correção indicada:** alinhar a revisão anterior à transmissão aos limites do XML e apresentar os dados cadastrais efetivamente utilizados no painel existente, preservando o padrão visual.

## Conferência das etapas e seleções

| Etapa | Resultado observado |
| --- | --- |
| Somente NFS-e | Abre preparação fiscal independente. Salvar/revisar não cria cobrança bancária nem reserva RPS. |
| Emitente | Seleção explícita da configuração fiscal. O backend distingue o escritório do cliente emitente e valida empresa, CNPJ e correspondência do certificado. |
| Ambiente | Seleção explícita; a tela distingue ambiente da operação e padrão da configuração. Produção está marcada como “somente preparação”. |
| Tomador | Seleção de parceiro da empresa. O banco valida vínculo com a empresa e, quando existente, com a cobrança. CPF/CNPJ são verificados. |
| Nota anterior | Busca por emitente, tomador, ambiente e período. Cópia cria novo rascunho, sem reaproveitar número de NFS-e ou RPS; competência deve ser informada. A descrição permanece e precisa ser revista. |
| Competência e data | Campos independentes. O mês da competência é serializado com dia `01`; data do RPS é informada separadamente. Não se extrai competência automaticamente da descrição. |
| Atividade e municípios | Campos para item LC116, CNAE, código municipal, NBS, município da prestação, incidência e tomador. Há validações de formato; não foi comprovada validação desses códigos contra o cadastro municipal autorizado do emitente. |
| Opções de ISS | Os códigos apresentados de exigibilidade, Sim/Não, responsável pela retenção e regime especial correspondem às enumerações do manual. Selecionar um código válido não comprova o enquadramento tributário da operação concreta. |
| Alíquota | Tratada como percentual: `3.51` representa `3,51%`; não há multiplicação automática por 100 no contrato WebISS. |
| Revisão | Exige dados explícitos e bloqueia pendências conhecidas; contém a lacuna demonstrada no problema 3. Alterações no formulário invalidam a confirmação anterior. |
| Transmissão | O formulário novo só permite transmissão em homologação, com checkbox e botão específicos. O serviço frontend também rejeita produção. O backend possui uma trava própria para produção dos rascunhos; seu segredo de liberação não foi consultado. |
| XML e assinatura | Namespace ABRASF, estrutura RPS, validação pelo XSD arquivado, assinatura e revalidação final. XML assinado é arquivado antes do SOAP. Testes usam certificado sintético. |
| Resposta fiscal | Não basta HTTP 200: o parser exige retorno esperado e identificação da nota. Confere RPS, série/tipo, prestador, tomador e valor contra a tentativa. Não faz comparação campo a campo de todos os dados tributários retornados. |
| Falha ou timeout | Distingue falha antes do envio, rejeição e resultado incerto. Retomada incerta consulta o mesmo RPS; não emite outro automaticamente. Há proteção contra processamento concorrente e resposta de tentativa antiga. |
| Histórico | Status de rascunho, processamento, falha, rejeição, incerteza, emissão, cancelamento e substituição. Consulta atualiza evidência fiscal sem gerar nova nota. Consulta paginada limitada pode ser parcial. |
| XML/PDF | No Faturamento, documento é recuperado por origem/ambiente e empresa. Parser prioriza valores autorizados, separa descontos e só utiliza QR/link existente no retorno. No Financeiro permanece o problema 1. |

O escopo de emissão atual é restrito. O formulário/builder não implementa o preenchimento completo de deduções, descontos, tributos federais, IBS/CBS, construção civil e identificação de intermediário. Dados não suportados são bloqueados quando recebidos; não se deve considerar o emissor completo para todos os cenários permitidos pelo manual. A leitura de uma nota anterior com esses grupos não equivale a suportar sua nova emissão.

## Verificação executada

- **87 testes Deno passaram**, cobrindo XML/XSD, assinatura, SOAP simulado, identidade do retorno, consultas, erro municipal, produção bloqueada no handler de rascunho e reconciliação.
- **63 testes Vitest passaram em 11 arquivos**, cobrindo rascunho, histórico, serviços fiscais, parser e geração de PDF/QR.
- **Suíte SQL de rascunhos passou** (`supabase/tests/run-webiss-drafts.mjs`): ausência de efeito bancário ao salvar, reserva e reaproveitamento de RPS, concorrência, tenant, cópia, filtros, retorno cancelado/substituído, persistência e permissões.
- **Três reproduções adicionais confirmadas**: revisão aprova CEP, razão social e inscrição municipal inválidos; builder rejeita os mesmos dados.
- Não se alterou a implementação para obter esses resultados. As lacunas relatadas não eram cobertas pelos testes existentes do caminho financeiro/revisão prévia.

Próxima etapa técnica indicada: corrigir os três problemas, repetir os testes dos casos específicos e manter a liberação de produção separada. Não é necessário substituir o certificado para corrigir essas falhas de fluxo.
