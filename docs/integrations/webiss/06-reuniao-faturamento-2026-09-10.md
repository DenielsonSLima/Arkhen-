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
5. **Atualizar do WebISS** chama somente `ConsultarNfseServicoPrestado` com A1 no servidor. Até cinco páginas/250 documentos, intervalo máximo de 366 dias; paginação incompleta é informada como consulta parcial.
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

As três migrations foram aplicadas no projeto Arkhen `dgklhykjwzmeqxejlicz`. Edge fiscal publicada na versão 7, mantendo verificação de JWT. A publicação da interface e a consulta autenticada real são conferidas separadamente; publicar o código não prova autorização fiscal municipal nem homologação concluída.

Primeiro caso de consulta: parceiro UNILASE já cadastrado, em 20/08/2026, comparando o retorno com o PDF fornecido pelo usuário. Usar a sessão normal do aplicativo e o certificado armazenado no servidor. Importação só é considerada concluída após resposta do provedor e confirmação do histórico local.

## Correção de interface e consulta no Histórico

A segunda revisão corrigiu o portal do formulário: cores independentes de `document.body`, rótulos escuros, controles com aparência e altura definidas no Safari e cabeçalho/rodapé sem a margem duplicada do card. Os campos foram agrupados em serviço, atividade/local, ISS e complemento do tomador. O seletor de parceiro reutiliza o componente pesquisável do Faturamento.

A aba Histórico agora oferece **Consultar WebISS**, com emitente, parceiro, ambiente e intervalo explícitos. A resposta invalida a lista e aparece no próprio histórico. Datas são apresentadas em português; o intervalo usa a data fiscal no horário municipal, sem presumir emissão em registros sem data. Intervalos invertidos são indicados na interface.

Migration adicional aplicada: `20260910032827_webiss_historico_filtros.sql`. A assinatura anterior de três argumentos continua atendida pelos valores padrão da nova assinatura de sete argumentos. Revisão independente sem bloqueadores; 19 testes React passaram e a suite SQL isolada cobriu escopo, filtros, fuso, permissões e compatibilidade.
