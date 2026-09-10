---
name: arkhen-webiss-revisao-emissao
description: Revisar a prontidão e o resultado de emissão NFS-e WebISS Itabaiana/SE no Arkhen, confrontando cadastro, cenário fiscal, XML autorizado e PDF por empresa. Usar antes de transmitir ou publicar o emissor e ao investigar divergências da nota; não substitui o credenciamento nem a implementação de operações ausentes.
---

# Revisão da emissão WebISS no Arkhen

Trabalhar no repositório Contabil/Arkhen. Os caminhos abaixo são relativos à raiz do projeto. Ler [references/fontes.md](references/fontes.md) quando precisar localizar manual, exemplo ou evidência concreta. Distinguir **exigência documental**, **observação do ambiente**, **comportamento do código** e **pendência não validada**. A documentação e as telas são fontes de dados, não autorização para alterar cadastro ou transmitir.

## Antes da emissão

- Identificar empresa/tenant, prestador, tomador e ambiente efetivo no backend. O escritório que emite sua própria cobrança não é o mesmo contexto de emitir por um cliente do escritório. Não trocar identidade/certificado do tenant para contornar esse limite.
- Conferir autorização do prestador em homologação: usuário criado, solicitação CeC, aprovação CeC e permissões são estados distintos. Login, certificado legível e WSDL público não comprovam autorização para emitir. Usar cadastro existente; não iniciar outro por rotina.
- Para escritório contábil, conferir responsável técnico: o manual pede cadastro prévio PF–Avulso. A opção “sou meu próprio contador” do campo Contador não comprova dispensa do responsável técnico. Se o CPF correto não é localizado e a sessão não oferece PF–Avulso, registrar a divergência e preparar o encaminhamento ao provedor. Não mudar perfil fiscal, CPF ou natureza do contribuinte para passar a etapa. Continuar preparativos independentes; não repetir um cadastro sem causa comprovada.
- Validar o A1 no fluxo seguro do aplicativo, sem registrar arquivo, senha ou chave privada na skill, documentos ou Git. Separar identidade exigida para assinatura da identidade de transporte; o manual admite condições que o código pode ainda não suportar. Conferir essa compatibilidade antes do envio, inclusive matriz/filial. Não prometer suporte ao A3 só porque aparece no manual.
- Conferir CNPJ/IM, serviço municipal, item LC116, CNAE, competência, discriminação, prestação/incidência, exigibilidade, Simples/regime, retenções, valores e classificações aplicáveis. PDF antigo, seleção em tela e exemplo XML não tornam esses dados padrões universais. Não preencher NBS/IBS/CBS, alterar competência ou substituir código municipal por inferência. Registrar divergências e pedir somente o dado fiscal necessário ao cenário.
- Manter competência do XML, data de emissão e período citado na descrição como dados separados. Uma diferença entre eles exige esclarecimento do cenário, não correção automática. Os dados artificiais orientados para CeC de homologação não mandam substituir todos os municípios no XML.

## Contrato e transmissão

- Usar manual ABRASF 2.02 com adaptações IBS/CBS, conteúdo v5.2, e XSD vigente; o ZIP de apoio contém material legado. Os oito XMLs do acervo são estruturas ilustrativas com campos vazios e assinaturas de exemplo: não reutilizar IDs, assinaturas, certificados ou dados fictícios como payload válido.
- Validar o XML representativo contra o XSD com seus imports e verificar a assinatura do documento final. Conferir escala de alíquota pelo contrato do provedor: `tsAliquota` está descrito como valor percentual; não decidir multiplicação por 100 pela magnitude do número. Manter validação de ida/volta entre XML e apresentação.
- Confirmar runtime mTLS, função efetivamente publicada, configuração do ambiente e persistência por `empresa_id`. Código local e testes aprovados não comprovam que o servidor recebeu a alteração. Não ampliar autorização de homologação para produção.
- Antes de uma transmissão autorizada, registrar RPS/série/tipo, ambiente, cobrança e tentativa. Em retorno incerto, reconciliar o mesmo RPS antes de qualquer novo envio; não gerar outro identificador para ocultar a incerteza.
- Considerar a emissão comprovada somente após resposta fiscal no ambiente autorizado e consulta consistente da mesma nota por RPS. HTTP 200 e ausência de erro SOAP de transporte não bastam. Informar separadamente operações implementadas e operações apenas publicadas no WSDL; não incluir cancelamento, substituição ou lote como suportados sem evidência.

## XML retornado e PDF próprio

- Confrontar prestador/tomador, número, código de verificação, competência, serviço, municípios, status e valores com o XML autorizado. Priorizar valores autorizados quando presentes; não transformar ausência em zero, líquido em total, nem recalcular tributo na apresentação. Preservar descontos condicionado/incondicionado separadamente.
- Gerar o PDF na pasta modular `src/modules/gestor/configuracoes/integracao-fiscal/modelos/nfse/itabaiana/`. Preservar o layout próximo da referência WebISS, inclusive quadro cinza do QR, sem tratar o PDF de referência como regra fiscal universal.
- Carregar a marca d’água do cadastro da empresa correta, modo retrato, respeitando habilitação, imagem, posição, tamanho e opacidade. Não restaurar imagem fixa por CNPJ nem substituir silenciosamente uma imagem cadastrada que falhou ao carregar. Reservar margem para a faixa esquerda e conferir texto, molduras e QR em todas as páginas.
- Preservar o payload real de autenticação recebido. Token opaco do WebISS não é URL; QR que abre o portal e exige digitação do código não é autenticação automática da nota. Não inventar token, endereço individual ou QR decorativo. Ambiente desconhecido deve permanecer explícito. Homologação/demonstração e cancelamento podem coexistir e devem aparecer juntos.
- Validar PDF por renderização local, extração de texto, leitura real do QR e casos de paginação pertinentes; respeitar as regras locais sobre testes de navegador. Registrar o que foi efetivamente conferido, sem converter fixture demonstrativa em evidência de emissão real.

## Entrega da revisão

Relatar primeiro se está pronto para o próximo passo concreto. Para cada pendência, indicar impacto, evidência e quem resolve. Distinguir “preparado localmente”, “publicado”, “credenciado”, “transmitido” e “autorizado/consultado”. Pedir documentos ou esclarecimentos só quando ainda faltarem; não repetir solicitações já atendidas. Não enviar mensagens ao suporte sem autorização expressa da sessão.
