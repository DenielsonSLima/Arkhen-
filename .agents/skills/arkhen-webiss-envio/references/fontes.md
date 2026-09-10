# Fontes e limites comprovados

Referência examinada em 09/09/2026 e implementação revista em 10/09/2026. Reconfira código e versão publicada ao executar: observação local não prova estado remoto. Caminhos relativos à raiz do repositório. Páginas abaixo são físicas, contadas desde a capa; no manual v5.2 a paginação impressa fica cinco páginas atrás.

## Material do provedor arquivado

Raiz documental: `docs/integrations/webiss/manuais-recebidos-2026-09-09/`.

- `02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.pdf`: p.9–10, adaptação ABRASF com NBS, chave nacional e IBS/CBS; p.12 e 57, `GerarNfse`, entrada `GerarNfseEnvio` e retorno `GerarNfseResposta`; p.19, certificados de assinatura/transmissão e validação XSD antes do envio; p.20–21, assinatura/validações; p.31, limites dos tipos e alíquota percentual; p.39, valores da declaração e da nota; p.40–41, serviço, RPS, competência e grupo IBS/CBS.
- `02-integracao-webservice/guia-tecnico-rapido-abr-asf-202-ibscbs.pdf`: p.3–9, estruturas novas, hierarquias de envio/retorno e `IBSCBS` com ocorrência 0-1. Guia e exemplo não comprovam quais regras negociais o município aplicará a cada operação.
- `03-exemplos-xml/02-emissao/GerarNfseEnvio.xml`: esqueleto com campos vazios e assinatura ilustrativa; não é XML de uma nota emitida nem payload pronto para transmissão.
- `03-exemplos-xml/02-emissao/EnviarLoteRpsSincronoEnvio.xml`: exemplo de operação distinta; não justifica assumir suporte a lote no Arkhen.
- `06-textos-extraidos/02-integracao-webservice/`: extrações dos PDFs para busca; a quebra `form feed` identifica página física.
- `00-controle/manifest-arquivos.json` e `00-controle/manifest-xml.json`: inventário e proveniência dos arquivos. O ZIP em `04-material-apoio-legado/` contém material anterior; não substituir automaticamente o contrato IBS/CBS por ele.
- XSD atualizado arquivado: `02-integracao-webservice/xsd-atual/nfse_v2_02-IBSCBS.xsd` e `xmldsig-core-schema20020212.xsd`. A análise inicial também comparou a cópia em `docs/integrations/webiss/fontes/oficial/`. Compare hashes/origem e contrato vigente antes de novos cenários.
- `00-controle/validacao-xsd/`: resultados da validação coordenada dos oito XMLs originais. São bem-formados, mas todos falham contra o XSD atual; os de emissão têm campos vazios e estruturas incompatíveis. Use como referências incompletas, nunca como fixtures já válidas.

### Divergências documentais que mudam a implementação

O manual p.40 escreve `CodigoNBS`, enquanto o XSD e o exemplo de envio usam `CodigoNbs`. A p.41 escreve `TomadorServico`, mas o XSD e exemplo usam `Tomador`. XML diferencia maiúsculas/minúsculas: usar o elemento exato validado no XSD correspondente; não renomear código somente para copiar a tabela do PDF. Grupo IBS/CBS é opcional estruturalmente, sem conclusão geral de dispensa tributária. O manual chama alíquota de percentual; o construtor usa `3.5100` para 3,51%, sem divisão por 100.

## Implementação local observada

| Arquivo | Comportamento / limite |
| --- | --- |
| `supabase/functions/_shared/webiss/rps.ts` | Gera só `GerarNfseEnvio`, RPS tipo/status 1; competência e município de incidência independentes quando fornecidos; valores emitidos limitados a serviço e alíquota; envia `CodigoNbs` opcional validado no XSD. Não envia IBSCBS, deduções, descontos, PIS/COFINS/INSS/IR/CSLL, intermediário ou construção civil. Tomador local exige documento válido. Não suporta toda a abrangência do XSD. |
| `supabase/functions/_shared/webiss/signature.ts` | XMLDSig e autoverificação criptográfica; não executa validação completa XSD. Diagnóstico de assinatura usa XML reduzido, não prova validade de RPS representativo. |
| `supabase/functions/_shared/webiss/certificate.ts` | A1 extraído no backend; conferência local exige CNPJ exato. Manual p.19 admite vínculos mais amplos de matriz/transmissor: não assumir suporte local a esses casos. |
| `supabase/functions/_shared/webiss/soap.ts` | Só `GerarNfse` e `ConsultarNfsePorRps`; mTLS, allowlist de dois endpoints, timeout30s, SOAP1.1, validação de identidade do retorno. Mensagem de rejeição é distinta de erro de transporte. |
| `supabase/functions/_shared/webiss/emission.ts` | Gera/assina antes de marcar envio; consulta pelo mesmo RPS e valida correspondência. |
| `supabase/functions/fiscal-integration/emission-action.ts` | Preparação e confirmação por RPC; falha após retorno não dispara nova emissão; consulta isolada preserva lease; anexa tentativa/cobrança na confirmação local. |
| `supabase/migrations/20260907135151_webiss_emissao_segura.sql` | Snapshot por cobrança/ambiente, lease90s, estados de tentativa; consulta prévia para tentativa que não seja falha pré-envio. RPS usa data corrente em America/Maceio na preparação inicial e código municipal2802908. Não forçar reset de snapshot para repetir envio. |
| `src/modules/gestor/configuracoes/integracao-fiscal/services/fiscalIntegrationDefaults.ts` | Padrões de TI e tributação são valores iniciais de formulário, não identidade fiscal confirmada da B&M ou de outra empresa. |

## Observação do caso e pendências

Fotos de produção apresentadas na reunião: competência09/2026, descrição de referência aos serviços contábeis08/2026 e autenticação de ATA na Junta Comercial, atividade1703, CNAE6920601, NBS vazio, ISS exigível, prestação/incidência Itabaiana. Essas são observações de uma operação, não defaults de outras empresas. O mês no texto da descrição não muda automaticamente a competência fiscal.

A revisão documental não transmitiu NFS-e. A autorização informada nesta reunião cobre consultas, sem emissão. Esse estado é histórico: releia a autorização atual da conversa, sem criar veto permanente nem pedir nova aprovação quando o usuário já autorizou a mesma ação. Não há evidência aqui de que um retorno real desse cenário já tenha validado todos os campos, a autorização CeC ou a cobertura IBS/CBS.

## Faturamento atualizado em 10/09/2026

Rascunhos independentes em `app_private.webiss_rascunhos`; migrations `20260910030106`, `20260910030107`, `20260910030109`. `Salvar e revisar` não cria cobrança nem reserva RPS. `draft-action.ts` adapta a máquina de tentativas existente, preservando snapshot/lease/reconciliação. Produção bloqueada por padrão no novo fluxo e no backend (`WEBISS_DRAFT_PRODUCTION_ENABLED`); consulta independe de configuração ativa.

`consultation.ts`, `consultation-data.ts` e `consultation-action.ts` consultam notas existentes por contexto e período. Cache e cópia não significam emissão: copie apenas os campos permitidos, escolha a competência nova e preserve a descrição para revisão. Cópia não leva RPS, protocolo, assinatura, número ou código de verificação anteriores. Grupos fiscais não traduzidos bloqueiam a cópia. Consulte `docs/integrations/webiss/06-reuniao-faturamento-2026-09-10.md` para contratos, validações e limites.
