# Correção do fluxo WebISS — 21/09/2026

Os três problemas da [revisão](revisao-fluxo-emissao-2026-09-21.md) foram corrigidos com três agentes e revisão cruzada. A autorização foi para implementar e publicar o código, sem emitir notas.

## Comportamento entregue

- O botão existente “Emitir NFS-e” nas cobranças abre o formulário fiscal de preparação/revisão. Não chama mais a emissão direta sem competência.
- A RPC legada de emissão foi bloqueada antes de qualquer reserva de RPS. O acesso direto à implementação antiga também foi revogado para `service_role`; a consulta de tentativas antigas permanece disponível.
- Reabrir uma cobrança recupera o rascunho já vinculado. A troca de ambiente busca o rascunho correspondente, sem duplicar o vínculo. A leitura exige sessão, empresa e cobrança compatíveis; não retorna certificado ou snapshot privado.
- Trocar emitente ou copiar dados de uma nota anterior preserva a identidade do rascunho vinculado. Rascunhos já processados continuam sem edição.
- O serviço financeiro preserva a situação devolvida pelo backend. Mensagens distinguem nota confirmada, cancelada e substituída. Uma resposta antiga sem situação não é apresentada como confirmação fiscal.
- O PDF financeiro identifica cancelamento/substituição pelo XML e pelo resultado fiscal conhecido, com os rótulos já existentes. Substituição tem precedência quando os dois estados aparecem.
- Alterar cobrança, empresa, número ou situação descarta resultados antigos da interface. Uma resposta atrasada não abre o formulário ou apresenta o PDF de outro contexto.
- Emissão/consulta atualizam os caches de Faturamento, Financeiro e Início, inclusive após falha, sem repetição automática da operação fiscal.
- A revisão SQL verifica limites e formatos do cadastro, comprimentos compatíveis com o builder, espaços em campos obrigatórios e caracteres inválidos para XML antes de reservar RPS. O painel existente passa a exibir endereço e contato efetivamente utilizados.

## Preservação visual

Nenhuma regra CSS foi alterada. A importação do CSS do rascunho foi mantida no ponto original da cascata do Faturamento, para que o novo acesso pelo Financeiro não mudasse sua precedência.

O build final gerou `index-BjdSW4gX.css`, com **459.174 bytes**, idêntico byte a byte ao CSS publicado antes das correções. Foram reutilizados formulário, botões e marcações fiscais existentes.

## Verificação

- `npm test`: **746 testes em 129 arquivos passaram**.
- `npm run build`: TypeScript e build aprovados. Permanece o aviso já existente de chunks grandes.
- `npm run lint`: sem erros; avisos existentes fora dos arquivos corrigidos.
- `supabase/tests/run-webiss-drafts.mjs`, em PGlite isolado: aprovado com as duas novas migrations. Inclui **18 entradas inválidas** bloqueadas antes de criar tentativa/snapshot ou avançar o contador, além de limites válidos, tenant, permissões, retomada por ambiente e proteção da emissão legada.
- PDFs sintéticos cancelado e substituído: três páginas cada, com situação e homologação presentes em todas as páginas por extração de texto. A primeira página substituída também foi renderizada e inspecionada localmente.
- Nenhum teste utilizou navegador ou transmissão fiscal. Os testes usam mocks/banco isolado; não comprovam nova autorização municipal.

## Banco publicado

Migrations aplicadas ao projeto Contabil/Arkhen, com nomes locais alinhados ao histórico remoto:

1. `20260922022810_webiss_revisao_dados_xml.sql`.
2. `20260922022843_webiss_desativar_emissao_legada.sql`.

Após a aplicação, os corpos das três funções novas/alteradas foram comparados por hash com o código local e corresponderam. As permissões foram conferidas: emissão legada interna não executável por clientes ou `service_role`; consulta antiga continua disponível ao backend; retomada autenticada mantém validação de sessão e tenant.

A revisão de permissões segue a [documentação de funções do Supabase](https://supabase.com/docs/guides/database/functions). Advisors foram consultados antes/depois. O aviso genérico de função `SECURITY DEFINER` autenticada também abrange a nova leitura; a função foi revisada quanto a sessão, escopo, `search_path` vazio e DTO sem segredos. Os demais avisos preexistentes não foram alterados por este trabalho.

Não houve mudança na Edge Function de transporte WebISS, nem acesso ao conteúdo do certificado. Não foi necessário republicar o emissor para essas alterações de banco e interface.

## Limites preservados

Nenhuma NFS-e emitida, consulta SOAP, reserva real de RPS, alteração de certificado ou habilitação de produção foi realizada. A produção permanece bloqueada no formulário novo, como antes. A ampliação para cenários fiscais ainda não suportados e a liberação de transmissão de produção são etapas distintas destas correções.
