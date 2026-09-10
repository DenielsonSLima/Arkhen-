---
name: arkhen-webiss-envio
description: Preparar, implementar, diagnosticar e executar emissão individual NFS-e WebISS Itabaiana no Arkhen, em homologação ou produção, com XML ABRASF 2.02 adaptado IBS/CBS, assinatura A1 e reconciliação por RPS. Usar para envio e retomada de tentativa; cancelamento pertence à skill específica.
---

# Envio WebISS no Arkhen

Trabalhe na raiz do repositório Arkhen/Contabil e leia suas regras locais. Os caminhos de código/documentação abaixo são relativos a essa raiz. Para contrato, divergências entre fontes ou decisão de implementação, consulte [fontes e limites](references/fontes.md).

## Escopo e preparação

- Preserve o escopo autorizado na conversa. Consulta, pesquisa, configuração ou criação desta skill não autorizam emitir. Quando já houver autorização para a nota/cenário e ambiente, execute sem pedir confirmação repetida; quando faltar, prepare os dados/XML e apresente a operação concreta antes de solicitar autorização para transmitir. Nunca troque homologação por produção por causa de falha.
- Identifique o tenant e o emitente real. O fluxo de cobrança atual emite pelo escritório/tenant e usa seu cliente como tomador; selecionar certificado de cliente não transforma esse fluxo em emissão por conta do cliente.
- Use dados cadastrais e fiscais confirmados da operação. Certificado A1 válido, teste de assinatura ou WSDL acessível não comprovam credenciamento CeC/autorização municipal. Confira os dados efetivamente autorizados no ambiente escolhido.
- Separe competência fiscal, data do RPS e período mencionado na descrição. Não derive competência automaticamente de “REF.” nem copie data/número da nota usada como exemplo. Separe município de prestação e incidência, códigos municipal/LC116/CNAE/NBS, opção Simples e regime especial, ISS retido e responsável pela retenção.
- NBS vazio em uma foto não prova dispensa universal. Avalie campos IBS/CBS/NBS pelo cenário, contrato e regras vigentes; ocorrência XSD 0-1 significa possibilidade estrutural de ausência, não dispensa fiscal geral. Não invente códigos ou preencha grupos vazios.
- Confira versão publicada do frontend, Edge Function, RPCs e ambiente real antes de afirmar prontidão. Leia estado e metadados necessários sem expor senha, PFX/base64 ou chave privada. Utilize o fluxo seguro existente para segredos.

## XML e assinatura antes do envio

1. Os exemplos originais contêm campos vazios e assinaturas ilustrativas; não são arquivos prontos para transmitir. Verifique se o construtor cobre o cenário real. O suporte local observado é emissão individual por `GerarNfse`; a existência de exemplos de lote não prova que lotes estejam implementados.
2. Valide o XML representativo contra XSD atualizado com seu import XMLDSig. `buildUnsignedRps` faz validações parciais e `signRps` verifica criptografia; isso não substitui validação XSD. Se o caso exigir campo não implementado, complete-o antes de transmitir esse caso.
3. Use namespace e nomes exatos do XSD/WSDL correspondente. Os PDFs têm divergências de grafia em algumas tabelas; não os trate como geradores de tags. Alíquota é percentual: não divida/multiplique por 100 por heurística.
4. Assine o conteúdo final com os algoritmos do contrato WebISS; o código atual usa RSA-SHA1, SHA1, enveloped-signature e C14N 20010315, referenciando `InfDeclaracaoPrestacaoServico` e inserindo `Signature` como irmã. Verifique a assinatura e não reformate/modifique XML depois de assinar. Não copie IDs, digest, assinatura ou certificado dos exemplos.

## Transmissão e recuperação

- Utilize o fluxo fiscal seguro existente, que prepara snapshot/RPS por cobrança e ambiente, controla tentativa e reconcilia. Não chame `GerarNfse` por um script improvisado que ignore essas garantias.
- Endpoints permitidos atualmente: homologação `https://homologacao.webiss.com.br/ws/nfse.asmx`; produção Itabaiana `https://itabaianase.webiss.com.br/ws/nfse.asmx`. Transporte local: SOAP 1.1, cabeçalho ABRASF 2.02, mTLS A1, sem redirects, limite de resposta 4 MiB e timeout 30 s. São decisões do código, não limites universais impostos pelo manual.
- Preservar empresa, cobrança, ambiente, RPS número/série/tipo e snapshot ao reconciliar. HTTP 200 não é autorização: conferir estrutura esperada, número/código e correspondência do RPS, CNPJ e inscrição municipal retornados.
- Timeout, erro de transporte, retorno ambíguo ou falha de confirmação local após emissão deixam resultado incerto. Consulte o mesmo RPS antes de qualquer novo envio. Consulta sem resultado não autoriza automaticamente uma segunda emissão nem um novo RPS; resolva a tentativa existente com evidência e o fluxo apropriado.
- O fluxo atual não libera reenvio automático para `rejeitada` ou `incerta`: volta a consultar o snapshot. `falha_pre_envio` é tratada separadamente. Não apagar tentativa, trocar ambiente ou avançar numeração para contornar a trava. Se a consulta continuar inconclusiva, interrompa transmissões e informe o que falta resolver.
- Consulta isolada não deve liberar o lease de outra transmissão. Confirme persistência e vínculo correto da nota de homologação sem marcar a cobrança como emitida em produção.

## Evidência de conclusão

Relate ambiente, operação efetivamente realizada, resultado fiscal, RPS/nota reconciliados e limitações. Guarde XML retornado no fluxo institucional, sem segredos em Git/logs. Depois de retorno autorizado, confira o PDF próprio contra o XML e a marca d'água da empresa; PDF ou QR de exemplo não prova autenticação oficial. Encaminhe revisão de retorno/PDF e cancelamento para suas skills específicas quando a tarefa exigir.
