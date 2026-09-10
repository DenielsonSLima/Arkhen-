# Fontes e evidências da revisão

Raiz do acervo: `docs/integrations/webiss/manuais-recebidos-2026-09-09/`. Os números de página abaixo são páginas físicas do PDF; no manual de integração também se informa a página impressa quando relevante. Arquivos em `06-textos-extraidos/` espelham a organização dos PDFs e facilitam busca; confira o PDF quando a informação depender da figura.

## Triagem dos nove itens recebidos

| Item | Caminho sob o acervo | Uso na revisão |
| --- | --- | --- |
| CeC pessoa jurídica | `01-cadastro-cec/manual-cec-pessoa-juridica.pdf` (29 p.) | Usuário, cadastro, análise e autorização; não confundir login com CeC aprovado. |
| CeC escritório | `01-cadastro-cec/manual-cec-escritorio-contabilidade.pdf` (30 p.) | pp.11–12: tipos e responsável técnico PF–Avulso; p.19: campo Contador; pp.21–22: responsável técnico; pp.24–25: rascunho/rejeição; pp.26–28: autorização no contexto do contribuinte. |
| Integração atual | `02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.pdf` (62 p.) | Conteúdo versão5.2 apesar do nome original do download mencionar V5.0. p.19 (impressa14): assinatura/transporte e validação XSD; p.31 (impressa26): tipos e alíquota percentual; p.39 (impressa34): valores declarados versus valores NFS-e. |
| Guia rápido | `02-integracao-webservice/guia-tecnico-rapido-abr-asf-202-ibscbs.pdf` (34 p.) | pp.2–4: escopo e alterações NBS, chave, IBS/CBS. Resumo não substitui manual/XSD. |
| Material de apoio | `04-material-apoio-legado/material-apoio-webservice-v5.0.zip` | Conteúdo extraído tem modelo conceitual e manual ABRASF de novembro/2012, erros/alertas, ZIPs schema/WSDL. O nome do pacote não torna esses contratos mais atuais que v5.2. |
| NFS-e pessoa jurídica | `05-manuais-complementares/manual-nfse-pessoa-juridica.pdf` (39 p.) | Operação pelo portal: emissão, substituição e cancelamento. UI documentada não prova implementação dessas operações no Arkhen. |
| AIDF | `05-manuais-complementares/manual-aidf.pdf` (17 p.) | p.3: autorização para impressão gráfica de RPS físico. Não impor como pré-requisito de todo envio SOAP. |
| RANFS tomador | `05-manuais-complementares/manual-ranfs-aceitar-rejeitar-tomador.pdf` (15 p.) | p.3: serviços de prestadores de outros municípios; aceite/rejeite pelo tomador. Não confundir com emissão própria de NFS-e. |
| DES-IF | `05-manuais-complementares/manual-des-if-relatorios-v5.7.pdf` (42 p.) | Capa interna v5.7 de2018, embora nome original cite5.1. Relatórios DES-IF não determinam emissão comum de serviços contábeis. |

Inventário e rastreabilidade: `00-controle/manifest-arquivos.json` e `00-controle/manifest-xml.json`. Verificar esses registros ao mover/atualizar fontes.

## Oito exemplos XML

Em `03-exemplos-xml/`: quatro consultas (`01-consultas/ConsultarNfseFaixaEnvio.xml`, `ConsultarNfseRpsEnvio.xml`, `ConsultarNfseServicoPrestadoEnvio.xml`, `ConsultarNfseServicoTomadoEnvio.xml`); duas emissões (`02-emissao/GerarNfseEnvio.xml`, `EnviarLoteRpsSincronoEnvio.xml`); cancelamento (`03-cancelamento/CancelarNfseEnvio.xml`); substituição (`04-substituicao/SubstituirNfseEnvio.xml`). Todos usam namespace ABRASF e têm conteúdo de template. Parse bem-sucedido só prova XML bem formado. Exemplos de assinatura incluem referências/valores ilustrativos, inclusive `http://tempuri.org` em substituição; não copiar como assinatura operacional.

XSD/import e WSDL atuais já arquivados em `docs/integrations/webiss/fontes/oficial/`; localizar pelo `manifest.json` desse diretório. Procedimento municipal e limites: `docs/integrations/webiss/01-fontes-oficiais.md` e `04-etapas-e-checklist.md`. Fonte pública municipal: https://itabaianase.webiss.com.br/externo/manual/visualizar . Revalidar publicações se o contrato/ambiente mudar.

## Observações de 09/09/2026, sem generalização

As capturas privadas do Desktop `Captura de Tela 2026-09-09 às 23.50.50.png` e `...23.50.52.png` mostram **formulário de produção**, não nota autorizada: competência09/2026; descrição referindo serviços contábeis08/2026 e autenticação de ATA perante Junta Comercial; atividade municipal1703; CNAE6920601; NBS vazio; ISS exigível; prestação/incidência Itabaiana–SE. Os meses diferentes requerem esclarecimento antes de reutilizar o cenário; NBS vazio na tela não prova dispensa no XML. Não inferir outro código de atividade só pelo nome contabilidade.

Na sessão de homologação relatada na reunião, só Pessoa Jurídica estava disponível; CPF correto do contador não foi localizado e PF–Avulso não aparecia. Isso é divergência entre sessão e fluxo do manual, não justificativa para novo cadastro, perfil incorreto ou outro CPF. Verificar o estado atual antes de repetir esse diagnóstico. As capturas não precisam ser copiadas para a skill/Git.

## Pontos do código a conferir quando mudarem

- `src/modules/gestor/documentos/xml/nfse/parseNfse.ts`: escala específica do WebISS, valores autorizados, municípios, descontos e QR do retorno.
- `src/modules/gestor/configuracoes/integracao-fiscal/modelos/nfse/itabaiana/carregarModelo.ts` e `marcaDagua.ts`: cadastro da empresa e parâmetros retrato.
- Na mesma pasta, `pdfLayout.ts`: marca em todas as páginas, margem para faixa esquerda e coexistência de status; `qrCode.ts`: payload real/fallback e área branca; `quadroValidacao.ts`: apresentação do quadro.
- `src/modules/gestor/financeiro/services/nfseDocumentService.ts`: vínculo empresa/cobrança/nota/ambiente ao recuperar XML.

Esses caminhos refletem inspeção local, não prova de implantação ou homologação fiscal.

## Fluxo de faturamento revisto em 10/09/2026

`src/modules/gestor/faturamento/forms/nfse/` prepara nota separada de boleto/Pix, consulta até cinco notas anteriores por parceiro e permite copiar para rascunho. Datas fiscais são independentes da descrição. `faturamentoFiscalService.ts` passa origem e ambiente ao recuperar XML/PDF. Revisão SQL não reserva RPS. Histórico deriva da evidência WebISS; um retorno consultado de cancelamento prevalece sobre estado local antigo. Verificar também `supabase/tests/run-webiss-drafts.mjs` e `docs/integrations/webiss/06-reuniao-faturamento-2026-09-10.md`.

Consulta limitada a cinco páginas em período explícito pode ser parcial; não chamar esse resultado de histórico completo. Códigos do cadastro CeC de homologação não comprovam por si só o código do órgão gerador no XML. Transmissão de produção está bloqueada por padrão nesta etapa. A implantação do código não substitui resultado real de homologação.
