# Revisão nacional no faturamento

Acesso: preparação WebISS **vinculada a cobrança**, após seleção de emitente,
via botão `Revisar no padrão nacional`. Não traduz enquadramentos/códigos
WebISS nem transforma uma nota ou um RPS já processado em DPS.

O formulário coleta escolhas explícitas do contrato `NationalDraftFields`.
Apenas serializa strings e opções; cálculo e validação fiscal permanecem no
backend. Não atribui série/número/data de emissão, não usa segredos e não emite.
O backend deve comparar identidade, valores e vínculo com a cobrança autorizada.

`national-review-draft` recebe config, cobrança, UUID estável da revisão e
campos. A resposta só é aceita como sucesso se indicar `REVIEWED_ONLY`,
`submitted:false` e `liveReady:false`. Os dados ficam na tela em erro; botão
repetido e fechamento são bloqueados enquanto a solicitação está pendente.
A edição invalida a confirmação. Fechar a janela descarta os campos locais.

Requer publicação do handler e migrations correspondentes. Esta tarefa **não**
publicou nem aplicou migrations. Se indisponível, o formulário mostra erro e
não afirma que salvou. Não existe lista/reabertura de revisões nacionais nesta
etapa, nem preparação avulsa sem cobrança, substituição ou compra governamental.
Nenhuma destas limitações altera o fluxo WebISS existente.
