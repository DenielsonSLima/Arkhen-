# Revisão do faturamento recorrente e emissão WebISS

Data: 10/09/2026. Reunião com `auditoria_recorrencias`, `auditoria_contrato` e `auditoria_retorno`. Coordenação principal: comparação entre código local e publicado, leitura delimitada do banco, interface, validação e publicação.

## Conclusão do trabalho local

O ciclo durável de recorrência foi implementado: contrato e preferências persistidos, execução única por contrato/competência, cobrança, preparação do rascunho e etapa fiscal conforme o modo escolhido. A recuperação usa os mesmos identificadores depois de falha ou recarga da página. O envio WebISS passa por validação XSD e assinatura; o retorno conserva XML e situação municipal, incluindo cancelamento e substituição.

**Implementação e testes locais não comprovam emissão autorizada nem liberam produção.** A publicação do conjunto e sua verificação final permanecem pendentes nesta versão do relatório. O escritório ainda precisa da comprovação de credenciamento/configuração no ambiente pretendido e de uma emissão autorizada em homologação, seguida de consulta consistente pelo mesmo RPS. Nenhuma transmissão fiscal foi realizada na revisão.

## Diagnóstico inicial — antes das correções

As constatações abaixo registram o ponto de partida; não descrevem o código local final.

- Git local/remoto na primeira conferência: `8b219d79599b5e91f82e792877de3ebcf2fec850`.
- Frontend público: `index-BnKH5uxS.js` / `index-D9tuyK7a.css`; não continha a nova prévia PDF. Alterações da sessão estavam no diretório de trabalho.
- Edge `fiscal-integration` ativa, versão 8; os 20 arquivos comparados coincidiam com os locais antes das correções desta revisão.
- Tenant do escritório: configuração WebISS própria em homologação e inativa, com referências de certificado/senha. Os segredos não foram lidos; presença de referências não comprova validade ou CeC.
- Dez notas importadas de produção, nenhuma tentativa em `webiss_emissoes` e nenhum rascunho naquela leitura. Importação não comprova emissão feita pelo Arkhen.
- Não existia cron de recorrência financeira/fiscal; o cron observado materializava atividades.
- Cadastro antigo salvava contrato e podia gerar a primeira cobrança. Não havia ciclo mensal durável, e as preferências de pagamento não eram integralmente preservadas.
- O envio fazia validações parciais, sem XSD no caminho efetivo. Consulta de nota confirmada retornava cache. O parser podia tratar retorno cancelado/substituído como emitido.

## O que foi corrigido

| Área | Resultado implementado |
| --- | --- |
| Recorrências | Contrato, condições bancárias, parâmetros fiscais, primeira competência, dia de processamento e regra de competência persistidos. Unicidade por empresa/contrato/competência e chave idempotente de salvamento. |
| Recuperação | Fila durável com etapas, lease, tentativas e mensagem; cobrança e RPS preservados no retry. Operações que aguardam pagamento ou revisão não avançam por um clique de retomada. |
| Agendamento | Materialização de competências e worker; cron usa capacidade aleatória, descartável, com hash e expiração, sem chave de usuário ou service role no agendamento. Contratos anteriores continuam sem ativação automática. |
| Interface | Campos de competência e agendamento, editor de condições e painel Execuções por competência. Novo contrato começa com agendamento desmarcado e Somente cobrança; o editor de contrato sem preferência sugere rascunho fiscal para revisão. |
| XML de envio | Validação pelo XSD WebISS/ABRASF 2.02 com XMLDSig antes do SOAP, além da verificação criptográfica. Competência explícita; não inferida do texto REF. Cenários não suportados são bloqueados. |
| Arquivo de envio | XML final assinado arquivado na tentativa antes do SOAP. Falha do arquivo impede transmissão. Só falha comprovadamente anterior ao envio permite limpar o arquivo; incerteza preserva a evidência. |
| Retorno | Correlação de prestador/CNPJ/IM, RPS, tomador e valor com o snapshot. XML retornado e situação municipal persistidos atomicamente. Número/código divergentes ou tentativa substituída são rejeitados. |
| Situação fiscal | `confirmada`, `cancelada` e `substituida` são projetadas no histórico a partir da evidência, mantendo separado o estado operacional da tentativa. Cancelamento/substituição não autorizam nova emissão. Regressões para situação ativa são bloqueadas. |
| Consulta | Consulta explícita de nota confirmada usa WebISS e mantém snapshot/RPS/token; não envia `GerarNfse`. XML e situação são atualizados, com proteção para evidência terminal anterior. |
| Documentos | CNPJ/CPF sob o parceiro, prévia PDF em modal, download opcional, barras sustentadas pela chave real e QR com payload recebido ou fallback identificado. Documento permanece vinculado a empresa/origem/ambiente. |

A correção inicial de retorno apenas bloqueava a confirmação de uma nota cancelada/substituída. Ela foi substituída pela persistência completa do XML e da situação fiscal; essa limitação inicial foi resolvida no código final.

## Fluxo operacional implementado

1. Salvar o contrato com primeira competência, processamento, vencimento, condições de pagamento e tratamento fiscal.
2. Solicitar a primeira competência, se desejado, e ativar separadamente o agendamento das próximas mensalidades.
3. Materializar uma execução única e preservar o snapshot daquela competência.
4. Gerar/reconciliar a cobrança com sua chave idempotente.
5. Preparar o rascunho fiscal quando escolhido; no modo de revisão, aguardar a conferência do usuário.
6. No modo de emissão na data ou após pagamento, respeitar o gatilho configurado, o ambiente e todas as travas fiscais antes do envio.
7. Validar XML, assinar, arquivar e transmitir; em incerteza, consultar o mesmo RPS antes de qualquer tentativa de novo envio.
8. Conferir retorno, situação municipal, XML e PDF. Conclusão da execução depende do modo: somente cobrança não equivale a NFS-e emitida.

Alterações no contrato valem para competências ainda não geradas. Pausar agendamento não desfaz cobranças/notas existentes nem interrompe retroativamente uma chamada já despachada. Recuperação usa Execuções por competência; não se cria outro contrato para contornar uma falha.

## Revisão de segurança e isolamento

- Tabelas da fila, capacidades e tentativas permanecem privadas, com RLS e sem acesso direto de `anon`/`authenticated`.
- Operações manuais exigem permissão financeira/faturamento e contexto da empresa. O worker obtém empresa, autorizador, condições e identificadores do banco, não do corpo da requisição.
- A autorização do usuário que programou a recorrência é revalidada na aquisição das etapas.
- A revisão cruzada identificou que novas colunas de recorrência poderiam ser alteradas pela Data API sob a política antiga de membership. O código agora protege escrita direta e o editor legado, impedindo ativação ou troca do autorizador por esse caminho.
- Capacidades do cron são de uso único e expiram; o worker manual exige autenticação e escopo da execução. Nenhuma capacidade permite escolher tenant ou payload bancário/fiscal arbitrário.
- RPCs antigas de confirmação usadas internamente perderam permissão de chamada direta; wrappers preservam tenant, locks e tentativa e validam situação/identidade antes da persistência.

## Conferências técnicas e limites

Presentes: SOAP 1.1, ABRASF 2.02, mTLS A1, endpoints fixos por ambiente, RSA-SHA1/SHA1/C14N, alíquota percentual, timeout e limite de resposta. HTTP 200 não é tratado como autorização por si só. Erro de transporte ou confirmação local deixa resultado incerto; consulta isolada não libera lease de outra emissão.

O conjunto não pretende cobrir todos os cenários do XSD: IBS/CBS, retenções federais, descontos/deduções, intermediário, construção civil e outros grupos exigem tradução fiscal específica antes de transmitir quando aplicáveis. Ocorrência opcional no schema não equivale a dispensa tributária. O A1 continua limitado ao CNPJ compatível com o emitente suportado; não se afrouxou identidade de certificado.

A existência dos modos de transmissão recorrente e do seletor Produção não libera produção. Homologação exige autorização municipal própria. Cancelamento e substituição recebidos em consulta são reconhecidos; isso não significa que emitir pedidos de cancelamento/substituição esteja implementado ou autorizado.

## Validações executadas

- Contrato/XSD: 19 testes Deno de schema, builder e certificado passaram; o worker passou em nove testes, conforme revisão do agente de contrato. O bundle conserva o SHA-256 dos schemas oficiais; validação usa libxml2-wasm com resolução local dos imports, sem rede, e bloqueia DTD/entidades e documentos acima do limite.
- Guia interno: seis testes de navegação e referências de imagens passaram após atualizar os tutoriais de recorrência.
- Retorno/persistência: 23 testes Deno de SOAP, emissão e adapter de rascunho passaram, com tipagem, incluindo consulta real de confirmada, correlação tomador/valor, arquivo antes de envio e estados fiscais.
- PGlite isolado: runner `run-webiss-drafts.mjs` passou com a migration de retorno completo e `webiss-return-cases.mjs`. Casos incluem XML arquivado, limpeza apenas pré-envio, preservação em incerteza, consulta mantendo RPS, cancelamento/substituição no histórico/documento/cobrança, bloqueio de regressão, idempotência e isolamento de tenant/RPC.
- Validações anteriores da revisão: 62 testes Deno e 73 Vitest, build, lint focal e whitespace passaram antes da ampliação do pipeline. Esses números registram execuções anteriores; não substituem a bateria final do conjunto nem devem ser somados como testes únicos.
- XML representativo assinado com certificado descartável foi validado contra XSD e assinatura. Fixture local não é evidência de autorização fiscal real.
- Bateria final: 96 testes Deno, 89 testes Vitest e os dois runners SQL PGlite passaram. Build TypeScript/Vite aprovado também em cópia isolada contendo apenas os arquivos desta publicação; alerta preexistente de tamanho de chunks permanece.

## Publicação do backend e conferência posterior

As quatro migrations foram aplicadas em 10/09/2026. Função `fiscal-integration` v9 e `recurrence-worker` v1 ativas. RLS conferida nas três tabelas privadas; scheduler ativo a cada minuto. Após a publicação do backend: zero contratos com agendamento ativo, zero execuções, dez notas importadas preservadas. Nenhuma cobrança ou transmissão foi realizada. O frontend acompanha o commit desta alteração, com verificação de implantação registrada após sua conclusão.

Próxima validação fiscal, quando expressamente autorizada: nota concreta de homologação, dados revisados, retorno autorizado, consulta do mesmo RPS e comparação XML/PDF. Nenhuma etapa desse documento autoriza emissão real ou produção.

## Fontes e arquivos principais

- Manual local WebISS ABRASF 2.02 IBS/CBS v5.2, páginas físicas 19–21, 31, 39–41 e 57: `docs/integrations/webiss/manuais-recebidos-2026-09-09/02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.pdf`.
- XSD e XMLDSig: `docs/integrations/webiss/fontes/oficial/` e bundle validado do backend.
- Backend: `supabase/functions/_shared/webiss/`, `fiscal-integration/`, `recurrence-worker/`.
- Migrations: `20260910150651_financeiro_recorrencias_duraveis.sql`, `20260910150700_webiss_retorno_fiscal_completo.sql`, `20260910150708_financeiro_recorrencias_worker.sql`, `20260910150715_financeiro_recorrencias_scheduler.sql`.
- Interface: `RecorrenciaScheduleFields.tsx`, `RecorrenciaConfigForm.tsx`, `RecorrenciaExecucoes.tsx`; guia interno atualizado por tarefa.
