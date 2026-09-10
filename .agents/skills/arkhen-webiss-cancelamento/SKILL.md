---
name: arkhen-webiss-cancelamento
description: Analisar, preparar e conferir cancelamento ou substituição de NFS-e WebISS de Itabaiana/SE no Arkhen, distinguindo cancelamento direto, solicitação administrativa e substituição. Usar para elegibilidade, XML/evento, implementação ou acompanhamento dessas operações; não acionar para emissão comum ou simples edição do PDF.
---

# Cancelamento e substituição WebISS

Identifique a operação que o usuário pretende e o efeito fiscal esperado. Consulte [fontes e contratos](references/fontes.md) para páginas físicas dos manuais, exemplos e limites da implementação. Caminhos do projeto nessa referência são relativos à raiz do repositório Contabil/Arkhen; localize a raiz antes de ler arquivos.

## Escopo e autorização

- Uma consulta, análise, criação desta skill ou autorização de emissão não autoriza cancelar nem substituir uma nota. Preparar os dados e verificações é trabalho de leitura e preparação; não transmitir pedido fiscal nessa modalidade.
- Para uma operação de produção, deve existir autorização expressa do usuário que abranja cancelamento ou substituição, com emitente, ambiente e nota(s) determinados. Preserve autorização já concedida e restrições da sessão; não peça a mesma confirmação novamente. Se faltar autorização ou a identificação for ambígua, conclua a preparação independente e apresente a operação concreta para decisão, sem transmiti-la.
- Substituição também emite uma nova NFS-e. Pedido de cancelamento não autoriza substituir; pedido de substituição não autoriza fazer cancelamento e emissão independentes para contornar o serviço próprio.
- Cancelar boleto, Pix ou cobrança bancária não cancela a NFS-e correspondente. Fotografias, mensagens do banco ou status financeiro não substituem confirmação fiscal do WebISS. Consultar últimas notas e copiar dados para um rascunho também não cancela, substitui ou autoriza emitir a nota de origem.
- Não converter diagnóstico em cancelamento de teste. Use homologação somente quando esse teste estiver no escopo autorizado, com uma nota daquele ambiente. Nunca inferir ambiente pela numeração ou pelo modelo de PDF.

## Escolher o caminho correto

| Intenção e condição | Caminho | Evidência de conclusão |
| --- | --- | --- |
| Cancelar a nota sem gerar outra, quando admitido pelo município | Cancelamento direto; Web Service `CancelarNfse` tem processamento síncrono | Confirmação de cancelamento da nota correta e situação confirmada em consulta |
| Pedir análise municipal quando não cabe cancelamento direto | Solicitação administrativa no portal, com motivo, justificativa e comprovante exigido | Pedido protocolado é pendência; somente deferimento e nota cancelada concluem o cancelamento |
| Corrigir nota por outra com vínculo fiscal, quando admitido | Substituição; Web Service `SubstituirNfse` tem processamento síncrono | NFS-e original substituída/cancelada, nova NFS-e e vínculo entre ambas |

O grupo XML `Pedido` de `CancelarNfseEnvio` não significa que o serviço implementa o protocolo administrativo do portal. A presença de `CodigoCancelamento` no schema não define quais motivos o município aceita.

Antes de escolher o caminho, conferir em leitura: tenant/emitente, CNPJ/IM, município, ambiente, número da NFS-e, RPS de origem quando disponível, XML e situação atual. Verificar existência de cancelamento/substituição anterior, dados do tomador, data/competência e situação de pagamento do tributo. Não confundir pagamento da cobrança comercial com recolhimento do ISS/DAM.

O manual genérico do portal condiciona cancelamento direto/substituição a dados do tomador, prazo municipal e pagamento do tributo, entre outras regras municipais. Consultar regra municipal vigente e disponibilidade efetiva do procedimento para o caso. Não inventar quantidade de dias, código de motivo, lei, restituição automática ou dispensa de recolhimento. Pedido administrativo pendente não é prova de cancelamento nem de suspensão da obrigação.

## Preparação técnica quando a tarefa incluir implementação ou execução

1. Verificar o código e a versão publicada. Na revisão de 09/09/2026 o conector só executava `GerarNfse` e `ConsultarNfsePorRps`; havia limitações no parser e assinador para as demais operações. Revalidar esse estado antes de afirmar suporte. Um catálogo na interface, WSDL ou PDF com selo de cancelada não implementa uma ação fiscal.
2. Montar o documento adequado ao contrato atual. Para cancelamento: `CancelarNfseEnvio/Pedido/InfPedidoCancelamento`, identificação da nota e motivo aceito quando aplicável. Para substituição: pedido de cancelamento e RPS da substituta no grupo próprio; preservar identificação da original e da nova nota.
3. Validar XML final contra XSD vigente e XMLDSig. Definir `Id` único e referência da assinatura para o elemento exigido por essa operação; verificar a assinatura antes de transmitir. Não reutilizar cegamente `signRps`, que assina `InfDeclaracaoPrestacaoServico`. Assinar com o certificado autorizado do emitente pelo fluxo seguro, sem expor PFX, senha ou chave privada.
4. Os XMLs oficiais arquivados são exemplos de estrutura com campos vazios e assinaturas ilustrativas/inconsistentes. Não transmitir esses originais, não copiar identificadores, certificado, digest ou assinatura e não tratar validação de um exemplo como prova de uma operação real.
5. Preparar persistência de tentativa e estados por tenant, nota, ambiente e operação, incluindo pedido, confirmação, erro e resultado incerto. Preservar XML autorizado original e eventos; marcar cancelamento não deve apagar a nota ou alterar silenciosamente seus dados. Substituição deve guardar os dois documentos e o vínculo.

## Resultado, consulta e interrupção de tentativas

- `CancelarNfseResposta` pode trazer `RetCancelamento` ou `ListaMensagemRetorno`. Validar a identificação em `RetCancelamento/NfseCancelamento/Confirmacao/Pedido` e a data/hora da confirmação; HTTP 200 não basta. Preservar e verificar assinaturas de resposta conforme o contrato suportado, sem confundir presença de uma tag com autenticidade comprovada.
- `SubstituirNfseResposta` usa o grupo `RetSubstituicao`, com nota substituída e substituidora. Conferir identidade, vínculo, dados e situação de ambas. Não interpretar o retorno como se fosse emissão individual.
- Após retorno conclusivo, consultar a nota no ambiente correto e reconciliar o estado local. Se só houver consulta por RPS disponível, confirmar que ela retorna o evento/situação necessária; não declarar cancelamento por ausência de uma nota ou por um XML antigo.
- Em timeout, falha de transporte, resposta ambígua ou confirmação fiscal seguida de falha local: registrar resultado incerto e consultar/reconciliar antes de qualquer novo pedido. Não repetir cancelamento, gerar substituta adicional, mudar RPS ou alternar endpoint para tentar obter sucesso. Sem prova suficiente, parar mutações e informar a pendência concreta.
- Em rejeição conclusiva, apresentar código/motivo e corrigir apenas dentro do escopo autorizado. Na solicitação administrativa, acompanhar o pedido existente; não protocolar outro por falta de resposta imediata.

Relatar separadamente o que foi preparado, transmitido, protocolado, confirmado pelo WebISS e persistido localmente. Para execução real, entregar identificação da operação/ambiente, evidência do retorno e consulta, vínculos e pendências. Para análise, declarar que não houve transmissão.
