# WebISS — NFS-e de Itabaiana/SE

Pesquisa técnica em 07/09/2026. O provedor das telas é **WebISS**. Esta integração emite nota fiscal de serviço (NFS-e); NF-e de mercadorias pertence a outro contrato.

## Fontes verificadas

| Fonte | Evidência e uso |
| --- | --- |
| [Portal oficial de manuais de Itabaiana](https://itabaianase.webiss.com.br/externo/manual/visualizar) | Publica os materiais ABRASF 2.02 atualizados, endpoints e procedimento de homologação. |
| [Manual de integração oficial](https://drive.google.com/file/d/1s97wqsgksPKtIL4tTZjKF_zXzO-JAAYX/view) | PDF baixado e lido. Apesar de o nome no Drive mencionar V5.0, a capa e histórico do conteúdo indicam **5.2**. Páginas 13–16: certificados/assinatura; tabela `tsAliquota`: percentual. |
| [Schema oficial nfse_v2_02-IBSCBS.xsd](https://drive.google.com/file/d/14yTC_mKUsBEYfmiv35JyYC_FP_6z2U-T/view) | XML baixado e inspecionado: estrutura e cardinalidade dos campos, inclusive adaptações IBS/CBS. |
| [Guia técnico rápido](https://drive.google.com/file/d/1VxSQDysYbJ7YM-4_6t8fsKt8B-x9DX7U/view) | Apresenta os grupos nacionais incorporados ao layout municipal. |
| [Exemplos oficiais](https://drive.google.com/drive/folders/1sJeZC_iB5GPz1ox4q9BEd9zppbG3olls) | Templates de emissão, cancelamento, substituição e consultas. Não são transações homologadas deste sistema. |
| [Exemplo GerarNfseEnvio](https://drive.google.com/file/d/1euj1NbfShb7WixtEObwC8DbDzHP7boXP/view) | Baixado; confirma estrutura RPS e algoritmos XMLDSig. Campos fiscais estão vazios, portanto não comprovam alíquota específica. |
| [ACBr WebISSv2 no GitHub](https://github.com/frones/ACBr/blob/master/Exemplos/ACBrDFe/ACBrNFSe/ArqINI/WebISSv2.ini) | Implementação pública corrobora SOAP 1.1, versão 2.02, namespaces, SOAPAction e assinatura do RPS. Referência de interoperabilidade, subordinada ao contrato oficial. |

O [comunicado do portal municipal](https://itabaianase.webiss.com.br/autenticacao/entrar) anuncia adequações IBS/CBS e integração ao ADN. Isso não transforma automaticamente o conector em API REST nacional. Bibliotecas antigas, como [nfse-webiss](https://github.com/scupen/nfse-webiss), descrevem ABRASF 1.0; não devem definir o XML desta integração.

## Contrato de transporte

| Ambiente | Endpoint SOAP | WSDL |
| --- | --- | --- |
| Produção Itabaiana/SE | `https://itabaianase.webiss.com.br/ws/nfse.asmx` | `https://itabaianase.webiss.com.br/ws/nfse.asmx?WSDL` |
| Homologação WebISS | `https://homologacao.webiss.com.br/ws/nfse.asmx` | `https://homologacao.webiss.com.br/ws/nfse.wsdl` |

As páginas [produção](https://itabaianase.webiss.com.br/ws/nfse.asmx) e [homologação](https://homologacao.webiss.com.br/ws/nfse.asmx) anunciam dez operações: `GerarNfse`, `RecepcionarLoteRps`, `RecepcionarLoteRpsSincrono`, `ConsultarLoteRps`, `ConsultarNfsePorRps`, `ConsultarNfsePorFaixa`, `ConsultarNfseServicoPrestado`, `ConsultarNfseServicoTomado`, `CancelarNfse` e `SubstituirNfse`. Operação anunciada pelo provedor não significa implementação disponível no Arkhen.

O [WSDL de homologação](https://homologacao.webiss.com.br/ws/nfse.wsdl) foi baixado e analisado como XML. Para `GerarNfse`, o corpo contém `GerarNfseRequest` no namespace `http://nfse.abrasf.org.br`, com `nfseCabecMsg` e `nfseDadosMsg` do tipo string e **sem namespace**. O retorno contém `GerarNfseResponse/outputXML`. Usar SOAP 1.1 com `Content-Type: text/xml; charset=utf-8` e `SOAPAction: http://nfse.abrasf.org.br/GerarNfse`.

Cabeçalho e XML são strings escapadas, sem dupla codificação. O cabeçalho contém `cabecalho@versao="2.02"` e `versaoDados=2.02`, no namespace `http://www.abrasf.org.br/nfse.xsd`.

## XML e certificado

A forma correta do trecho RPS é `GerarNfseEnvio/Rps/InfDeclaracaoPrestacaoServico/Rps/IdentificacaoRps`. Não inserir um elemento `InfRps` intermediário: `tcInfRps` é o **tipo** do segundo `Rps`. A assinatura fica após `InfDeclaracaoPrestacaoServico`, dentro do primeiro `Rps`. Datas de emissão e competência usam `xsd:date`; série aceita 1–5 caracteres e número RPS até 15 dígitos. [Schema oficial](https://drive.google.com/file/d/14yTC_mKUsBEYfmiv35JyYC_FP_6z2U-T/view).

O manual define certificado ICP-Brasil A1 ou A3, assinatura RSA-SHA1, digest SHA1 e canonicalização inclusiva `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`. O aplicativo usa arquivo A1/PFX/P12 para execução no servidor. A transmissão exige autenticação cliente; a assinatura identifica o prestador ou estabelecimento permitido. O material pede validação XSD antes do envio. [Manual oficial, seções 3.2.2–3.2.5](https://drive.google.com/file/d/1s97wqsgksPKtIL4tTZjKF_zXzO-JAAYX/view).

O exemplo também usa transforms `enveloped-signature` e canonicalização inclusiva. Alterar o XML após assinar invalida o digest. [Template oficial](https://drive.google.com/file/d/1euj1NbfShb7WixtEObwC8DbDzHP7boXP/view).

`Servico/CodigoNbs` e `InfDeclaracaoPrestacaoServico/IBSCBS` têm `minOccurs="0"` no XSD consultado. Quando informado, o bloco IBS/CBS exige sua própria estrutura, incluindo finalidade, indicador da operação, destinatário e classificação tributária. A opcionalidade estrutural não comprova dispensa fiscal para uma empresa/operação. Há divergências de grafia e exemplos entre guia e XSD: para serializar, respeitar nomes e ordem do XSD (`CodigoNbs`). [Schema oficial](https://drive.google.com/file/d/14yTC_mKUsBEYfmiv35JyYC_FP_6z2U-T/view).

## Homologação operacional

1. Cadastrar usuário no ambiente WebISS de homologação e solicitar CeC com os dados fictícios determinados pelo provedor: IBGE `9999999`, CEP `99999999`, Rua da Homologação, Bairro da Homologação e Cidade da Homologação.
2. Aguardar aprovação do CeC. O portal orienta contato com `callcenter2@webiss.com.br` após solicitar; nenhuma mensagem foi enviada durante esta implementação.
3. Obter os dados autorizados do prestador e o link do webservice no ambiente aprovado. [Procedimento oficial](https://itabaianase.webiss.com.br/externo/manual/visualizar).
4. No Arkhen, selecionar a empresa emitente, Itabaiana/SE, WebISS e ambiente homologação. Conferir inscrição municipal, série/numeração, serviço, município de incidência, regime e retenções com os dados autorizados.
5. Carregar A1 válido para o contexto. Testar certificado e WSDL. Esses testes não substituem emissão homologada, autorização do CeC ou aceitação municipal da assinatura.
6. Emissão de homologação deve usar uma cobrança de teste identificável. Confirmar número da NFS-e, código de verificação, XML retornado e consulta por RPS. Simular falha de rede e reconciliar o mesmo RPS antes de qualquer reenvio.
7. Só considerar produção validada após comprovar o ciclo completo no ambiente autorizado, persistência do resultado e isolamento da empresa.

O código real de Itabaiana não deve ser substituído globalmente por `9999999`. Os dados artificiais são exclusivos do cadastro de homologação; a incidência e demais campos do XML precisam corresponder ao cenário aprovado pelo provedor.

## Implementação entregue

O conector permanece separado em `supabase/functions/_shared/webiss/`, com arquivos para XML, SOAP, assinatura, certificado, RPS, conexão e emissão. A entrada do servidor é `supabase/functions/fiscal-integration/index.ts`, com a ação fiscal extraída em arquivo próprio. O módulo `src/modules/gestor/configuracoes/integracao-fiscal/` conecta a interface aos services e hooks. Segredos A1 pertencem ao backend/Vault; o frontend não assina XML nem calcula tributos.

Estão implementadas emissão individual (`GerarNfse`) e consulta por RPS (`ConsultarNfsePorRps`), com XML de consulta `ConsultarNfseRpsEnvio` e autenticação mTLS. O XML RPS e a canonicalização foram corrigidos; o parser diferencia resposta SOAP, rejeição e resultado incerto. A alíquota agora preserva o percentual: o [manual](https://drive.google.com/file/d/1s97wqsgksPKtIL4tTZjKF_zXzO-JAAYX/view) exemplifica 1% como `1`, 25,5% como `25.5` e 10% como `10`.

As RPCs preservam um snapshot sem segredos por cobrança/ambiente e identificam cada tentativa por token. Locks e prazo de exclusividade impedem emissões concorrentes da mesma cobrança. Após resultado incerto, o fluxo consulta o RPS preservado; não transmite automaticamente outro XML. A confirmação é idempotente e não duplica estatísticas. Resultados de homologação ficam separados e não preenchem a cobrança como nota de produção.

A interface apresenta a disponibilidade efetiva do conector e os dados necessários ao RPS, incluindo opção explícita pelo Simples Nacional e responsável por retenção. Configuração ativa, certificado válido e diagnóstico de WSDL são estados distintos da homologação fiscal concluída.

## Limites de prontidão

Pontos que exigem evidência operacional antes de anunciar emissão pronta para produção:

- Certificado do prestador disponível, válido e autorizado; CeC homologado.
- XML representativo validado contra o XSD atualizado e assinatura aceita pelo WebISS.
- Os grupos IBS/CBS e o campo NBS **não estão implementados no envio**. Embora opcionais no XSD, sua aplicabilidade precisa ser definida e o suporte necessário implementado/configurado antes da produção. PIS/COFINS e demais campos específicos também exigem análise do cenário. Nunca inventar classificação fiscal para preencher XML.
- Rejeição definitiva ainda exige análise e correção controlada. Corrigir uma configuração não substitui automaticamente o snapshot de um RPS já transmitido. Não há reenvio automático de rejeições.
- Testes isolados cobrem tentativas e confirmação; aceitação municipal, contingência de rede e reconciliação com dados reais continuam dependentes de homologação.
- Cancelamento, substituição, envio de lotes e demais consultas do catálogo do provedor não estão implementados como operações fiscais deste conector.

Nenhuma nota foi transmitida, cancelada ou consultada com certificado nesta pesquisa; nenhum cadastro foi criado durante a pesquisa inicial. Consulta de WSDL prova disponibilidade do contrato público, não autorização fiscal. Não foi possível comprovar emissão real sem CeC/A1 e cenário fiscal autorizado.

## Validação reproduzível e ordem de publicação

Executar na raiz do repositório:

```sh
npm test
npm run build
deno task --config supabase/functions/fiscal-integration/deno.json test
deno task --config supabase/functions/fiscal-integration/deno.json check
```

Os testes SQL usam PostgreSQL isolado via PGlite e fixtures, sem conexão ao banco de produção:

```sh
npm install --prefix /tmp/contabil-webiss-sql --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
node supabase/tests/run-webiss.mjs /tmp/contabil-webiss-sql/node_modules/@electric-sql/pglite/dist/index.js
```

Na publicação, aplicar primeiro as migrations `20260907135151_webiss_emissao_segura.sql` e `20260907135202_webiss_parametros_diagnostico.sql`, nessa ordem. Depois publicar a Edge Function `fiscal-integration`, incluindo seu `deno.json`, `deno.lock` e módulos compartilhados. Publicar a interface somente com as RPCs e a função compatíveis disponíveis. As duas migrations foram aplicadas em 07/09/2026 no projeto `dgklhykjwzmeqxejlicz`; a Edge Function foi publicada na versão 5 (ACTIVE), mantendo `verify_jwt=true`. Os nomes locais das migrations refletem as versões registradas pelo Supabase. Nenhuma nota foi emitida nesta publicação.

O runner SQL valida as migrations contra um schema de teste; não substitui verificação do schema real, migrações anteriores, Vault e permissões no ambiente de destino.

Também foram validados três XMLs gerados — RPS sem assinatura, RPS assinado com certificado sintético e consulta por RPS — com `xmllint --nonet --noout --schema`, usando o XSD oficial baixado e seu import [XMLDSig da W3C](https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd). Os três passaram. Essa verificação estrutural não transmitiu notas e não comprova aceitação do certificado pelo WebISS.

## Rastreabilidade dos downloads

SHA-256 dos arquivos públicos efetivamente consultados (07/09/2026):

| Arquivo | SHA-256 |
| --- | --- |
| XSD IBS/CBS | `4caeadd9b4993b7741d7a83aa80601ac5743524d5af7bdd14f862fed053c7003` |
| WSDL homologação `/ws/nfse.wsdl` | `9a079fdbd5c524bcb4cb8bbf82171fc2b711dd6d1aee60672fb0d4573913fd74` |
| Manual PDF, conteúdo versão 5.2 | `6b772a4d43ad61dcec24f01f5c1a2aecb55c98cf1d9549769a98148d6da5e04a` |
| Guia técnico rápido PDF | `f2c5f3497a5ae449dd226ad0a899fe8d78ffde2c896e3ab1aa62cdda5531823d` |

Links do Drive são mutáveis: conferir versão e hash novamente quando houver atualização oficial.

## Verificação da publicação — 07/09/2026

As RPCs de emissão, consulta e confirmação permanecem restritas a `service_role`. A tabela privada de tentativas mantém RLS e bloqueia acesso direto de `anon`/`authenticated`; o aviso informativo de RLS sem política nessa tabela é intencional, pois o acesso ocorre somente pelas RPCs verificadas. Build e 515 testes da aplicação, 22 testes Deno e os testes SQL isolados passaram antes da publicação. O teste HTTP sem autenticação deve retornar 401. A homologação fiscal com A1/CeC e os limites funcionais descritos acima permanecem pendentes.
