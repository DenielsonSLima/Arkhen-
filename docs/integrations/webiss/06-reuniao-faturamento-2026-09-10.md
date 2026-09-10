# Reunião: Faturamento e reutilização de NFS-e WebISS

Data: 10/09/2026. Escopo autorizado: adaptar o Arkhen, consultar/importar notas já emitidas e preparar rascunhos. Nenhuma emissão ou cancelamento fiscal foi autorizado nesta etapa.

## Divisão e decisões dos três agentes

| Frente | Entrega | Revisão cruzada |
| --- | --- | --- |
| Interface e faturamento | Formulário fiscal independente, histórico real, últimas cinco por parceiro, copiar e revisar | Troca de parceiro descarta resposta atrasada; configuração em homologação/inativa continua disponível para consulta explícita em produção. |
| Banco e transmissão | Rascunhos, revisão, isolamento, tentativas/RPS, cache e RPCs | Concorrência de salvamento/importação, vínculo de cobrança, CPF e validade do certificado, produção bloqueada antes da reserva de RPS. |
| Documentação e consulta | Consulta SOAP por prestador/tomador/período, paginação, XML e qualidade da cópia | Identidade do retorno, município, limite de trabalho, cancelamento recente prevalece sobre estado antigo, estruturas tributárias não traduzidas impedem cópia. |

## Comportamento implementado

1. **Somente NFS-e** abre um rascunho fiscal; não chama o Banco Inter nem cria cobrança bancária.
2. **NFS-e + cobrança** cria a cobrança solicitada e depois abre a preparação fiscal. A nota não é transmitida automaticamente.
3. O usuário escolhe emitente, ambiente e parceiro/tomador. A configuração fiscal salva define o contexto; o ambiente desta operação é explícito.
4. O formulário mostra as últimas cinco notas confirmadas do parceiro. O Histórico NFS-e lista as notas importadas e rascunhos, com filtros por emitente, parceiro, ambiente, situação e período aplicados no servidor.
5. A preparação inicial da base consulta somente `ConsultarNfseServicoPrestado` com A1 no servidor. Até cinco páginas/250 documentos são examinados para conservar as cinco notas mais recentes por parceiro; intervalo máximo de 366 dias. Paginação incompleta é informada como consulta parcial. O Histórico não exige botão manual de consulta.
6. **Copiar dados** cria outro rascunho, preserva valor dos serviços e descrição, exige competência escolhida e não reutiliza número da NFS-e, verificação, RPS, assinatura ou protocolo. A descrição não tem seus meses substituídos silenciosamente.
7. **Salvar e revisar** não reserva RPS nem transmite. Competência, data do RPS, municípios de prestação/incidência, classificação e NBS são campos separados.
8. O histórico usa resposta fiscal. Cancelar boleto não cancela NFS-e. PDF/XML usam o documento recuperado e o gerador existente com marca d'água da empresa.

## Contratos e limites

- Migrations: `20260910030106_webiss_rascunhos_fiscais.sql`, `20260910030107_webiss_rascunhos_emissao.sql`, `20260910030109_webiss_notas_consultadas_historico.sql`.
- Edge `fiscal-integration`: `sync-consulted-nfse`, `consult-draft`, `emit-draft`. Autenticação de usuário mantida; os RPCs com A1/senha são exclusivos do servidor.
- `emit-draft` em produção está bloqueado por padrão, inclusive no backend. Liberação futura exige implementação/estado coerentes com `WEBISS_DRAFT_PRODUCTION_ENABLED` e autorização da operação. Consultas continuam disponíveis com a integração desativada.
- Valores de tributos federais, deduções, descontos e grupos IBS/CBS não traduzidos não são descartados silenciosamente: o XML é preservado e a cópia fica bloqueada nesses cenários.
- Município gerador de produção validado como Itabaiana/SE. Uma eventual diferença no retorno de homologação precisa ser comprovada no XML/orientação do provedor; o código fictício do cadastro CeC não foi aplicado indiscriminadamente ao XML fiscal.
- A integração não oferece cancelamento fiscal nesta entrega. A skill de cancelamento orienta a análise do contrato e distingue pedido, processamento e confirmação.
- Data de emissão sem fuso retornada pelo WebISS é interpretada em `-03:00`; o instante é armazenado em UTC.

## Evidências e validação

O acervo recebido fica em `manuais-recebidos-2026-09-09/`: dez PDFs (338 páginas, incluindo os dois do pacote legado), oito exemplos XML, XSD atual e pacotes originais. O inventário inclui hashes e a origem de cada download. Todos os XMLs originais são bem formados, mas nenhum dos oito passa integralmente no XSD atual; são modelos incompletos, não notas autorizadas.

Validação local: testes React do módulo Faturamento, testes Deno de consulta/emissão/RPS/assinatura, suite SQL em PostgreSQL isolado (PGlite), TypeScript e build. XML representativo do novo RPS validado contra o XSD arquivado. Nenhum teste local chama o WebISS ou o banco de produção.

As três skills ficam em `.agents/skills/arkhen-webiss-{envio,cancelamento,revisao-emissao}/`, com referências documentais; também disponíveis por links no diretório pessoal de skills. PDFs e capturas privadas permanecem no acervo local, separados do código publicado.

## Publicação e consulta real

As migrations foram aplicadas no projeto Arkhen `dgklhykjwzmeqxejlicz`. Edge fiscal publicada na versão 8, mantendo verificação de JWT. A publicação da interface e a consulta autenticada real são conferidas separadamente; publicar o código não prova autorização fiscal municipal nem homologação concluída.

Primeiro caso de consulta: parceiro UNILASE já cadastrado, em 20/08/2026, comparando o retorno com o PDF fornecido pelo usuário. A importação foi realizada inteiramente pelo servidor, com o certificado já armazenado e sem extrair sessão do navegador. Importação só é considerada concluída após resposta do provedor e confirmação do histórico local.

## Correção de interface e consulta no Histórico

A segunda revisão corrigiu o portal do formulário: cores independentes de `document.body`, rótulos escuros, controles com aparência e altura definidas no Safari e cabeçalho/rodapé sem a margem duplicada do card. Os campos foram agrupados em serviço, atividade/local, ISS e complemento do tomador. O seletor de parceiro reutiliza o componente pesquisável do Faturamento.

A aba Histórico mantém filtros de emitente, parceiro, ambiente e intervalo. Por orientação do usuário, a importação inicial não aparece como botão operacional nessa aba. As emissões e consultas registradas pelo sistema invalidam a lista automaticamente; notas importadas na preparação da base também aparecem no histórico. Datas são apresentadas em português; o intervalo usa a data fiscal no horário municipal, sem presumir emissão em registros sem data. Intervalos invertidos são indicados na interface.

Migration adicional aplicada: `20260910032827_webiss_historico_filtros.sql`. A assinatura anterior de três argumentos continua atendida pelos valores padrão da nova assinatura de sete argumentos. Revisão independente sem bloqueadores; 19 testes React passaram e a suite SQL isolada cobriu escopo, filtros, fuso, permissões e compatibilidade.


## Importação inicial pelo servidor

A tarefa interna `webiss-import-worker` usa `pg_net` e autorização própria descartável. O banco gera o token, guarda somente o hash no job e vincula administrador, empresa, configuração, parceiro, ambiente e intervalo. O endpoint aceita apenas o ID do job; não permite escolher ações ou alterar o contexto. `fiscal-integration` preserva a autenticação JWT e a emissão continua bloqueada nesta operação.

A revisão do WSDL público de Itabaiana confirmou o envelope SOAP, os parâmetros sem namespace, o `outputXML` e o `SOAPAction` de `ConsultarNfseServicoPrestado`. O XSD da consulta não inclui assinatura XML nessa mensagem. Mantido HTTPS, embora o WSDL anuncie endereço HTTP. Referência: https://itabaianase.webiss.com.br/ws/nfse.asmx?WSDL.

O acompanhamento registra somente etapa/código controlado, resumo e horários. Certificado, senha e token não são exibidos. Headers da fila HTTP e Vault não devem ser consultados para diagnóstico. Antes de importar, a inscrição municipal vazia do emissor foi preenchida com o valor conferido no PDF; ambiente salvo e configuração desativada foram preservados.


## Diagnóstico confirmado do retorno real

A consulta em produção recebeu `L999` com mensagem do WebISS informando bloqueio temporário por excesso de requisições e correção para aguardar dois segundos entre chamadas consecutivas. Esse retorno difere da descrição de atividade não configurada no artigo Conta Azul enviado pelo usuário; não justifica alterar CNAE ou atividade fiscal. A consulta de serviços prestados não envia esses campos.

O intervalo é aplicado antes da primeira página e de cada página seguinte, com reserva atômica compartilhada por endpoint e margem de três segundos. A chave por endpoint é uma escolha conservadora; não foi comprovado se o provedor limita por IP ou CNPJ. O retorno `E212`, sem notas e sem outros erros, representa consulta vazia e encerra a paginação preservando páginas já obtidas. Outros erros e retornos contraditórios continuam impedindo importação.

Corroboração: relato de desenvolvedor e resposta do mantenedor ACBr sobre WebISSv2 e intervalo mínimo de dois segundos: https://www.projetoacbr.com.br/forum/topic/49864-erro-ao-assinar-cancelamento-de-nfse-webissv2/ . A planilha de erros oficial arquivada documenta E212 (linha218). O bloqueio L999 desta ocorrência foi comprovado pelo próprio retorno SOAP em produção.

## Conferência final com documentos reais

Foram consultados quatro parceiros existentes entre 01/01/2026 e 10/09/2026: UNILASE e Suporte Agrícola retornaram cinco notas recentes cada; Star Fitness e Adilma não retornaram notas nesse intervalo. Dez documentos de produção foram importados no cache privado, com vínculo ao parceiro, XML, hash, valores e situação fiscal. A consulta examinou todas as páginas desses resultados e conservou as últimas cinco; isso não representa importação de todo o histórico anual.

O XML da UNILASE `2026000000292`, código `LY39-KA74`, confirma o PDF de referência: emissão em 20/08/2026, competência 08/2026 e serviços de R$ 405,00. A extração original perdia namespaces herdados utilizados pela C14N inclusiva. O novo serializador clona o nó e conserva todos os namespaces em escopo, respeitando a declaração mais próxima, sem alterar valores ou assinatura. Após nova consulta ao provedor, o XML exportado tem hash idêntico ao cache, passa no XSD oficial e na verificação criptográfica da assinatura municipal. Essa verificação offline não atesta cadeia ICP-Brasil nem revogação por CRL/OCSP.

O intervalo global agora atende também consulta por RPS e envio existente. Falha na reserva impede a chamada SOAP, mantendo os estados de tentativa e reconciliação. Os testes de envio usam transporte simulado; nenhuma nota foi emitida ou cancelada nesta tarefa.

Um job não chegou ao claim: a chamada interna ao PostgREST recebeu HTTP 401/PGRST303, antes de executar SQL ou consultar o WebISS. O worker distingue falha dessa dependência (503) de capability inválida (403), sem repetir automaticamente. Após confirmar o encerramento do request, a administração invalidou o job pendente e enfileirou uma nova consulta explícita, concluída com cinco notas. O subtipo da falha JWT não foi identificado; não houve alteração de certificado ou cadastro para contorná-la. Referência: https://supabase.com/docs/guides/api/rest/postgrest-error-codes.

Validações finais: 52 testes Deno focados no worker, contratos de consulta, erros seguros, assinatura, intervalo e estados fiscais; entrypoints fiscal/worker aprovados no `deno check`; três suites SQL isoladas aprovadas. No frontend, 15 testes existentes e três testes privados com XML real aprovaram parser, cópia, download e geração de PDF de uma página. A marca d'água real do tenant não foi exercitada nesse teste offline.

Os XMLs e relatórios privados estão em `output/webiss-importacao-2026-09-10/`, fora do Git. A limitação de permissões da fila `pg_net` hospedada, comprovada após a migration, permanece descrita no README do worker; a restrição exige o proprietário interno da extensão. A emissão efetiva em homologação continua pendente do credenciamento e de teste posteriormente autorizado.
