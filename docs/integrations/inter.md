# Banco Inter no Arkhen / Contábil

Revisão e correções em 07/09/2026, com três agentes: segurança de webhook,
banco de dados e contrato da API. Houve revisão cruzada dos identificadores,
isolamento da conta, concorrência OAuth, retentativas e cancelamentos.

## Contrato consultado

- [API de cobrança oficial](https://developers.inter.co/references/cobranca-bolepix)
- [Schema oficial Pix](https://developers.inter.co/redocusaurus/swagger-api-pix-yaml.yaml)
- [Schema oficial de cobrança](https://developers.inter.co/redocusaurus/swagger-cobranca-bolepix-yaml.yaml)
- [Autenticação e limites](https://developers.inter.co/duvidas-frequentes)

Os nomes históricos `bolepix` no código identificam a API de cobrança V3 do
Inter. A interface do Arkhen mantém Boleto, Pix e Ambos.

## Decisões implementadas

- Webhook fornece identificadores. Antes de alterar o financeiro, a Edge consulta
  o Inter com OAuth/mTLS da empresa e ambiente configurados. O header recebido
  não escolhe a conta bancária; não se aprende uma conta a partir do callback.
- A conta é opcional para integração com uma única conta e pode ser informada
  para aplicações com múltiplas contas. Configuração e credenciais são isoladas.
- Cobranças usam uma tentativa durável por empresa, referência e conteúdo.
  A reserva dura 90 segundos; um token de posse impede que uma execução antiga
  envie depois que outra assumiu. Antes do envio, a tentativa torna-se incerta.
  Uma emissão incerta só admite consulta por `txid` ou `seuNumero`, nunca reenvio,
  inclusive quando a consulta devolve 404.
- O resultado bancário é salvo antes da confirmação local. Se a confirmação
  falhar, a próxima tentativa reutiliza o resultado. Recuperação preserva os dados
  originais e o ambiente, inclusive após vencimento; troca de conta ou aplicação
  exige restaurar a configuração original para consultar.
- O frontend preserva a referência após erro ou recarregamento e compartilha
  chamadas concorrentes. Após sucesso confirmado, uma nova emissão recebe outra
  referência: operações intencionais com conteúdo igual continuam permitidas.
- Juros Pix usam percentual mensal (modalidade numérica 3), multa percentual
  (numérica 2) e desconto percentual por data (string "2").
- Pix é cancelado por PATCH de `/cobv/{txid}`. Boleto usa POST de cancelamento.
  HTTP 202 e timeout não significam cancelado: somente GET com o estado final
  confirma a baixa. Pagamentos confirmados não regridem para pendente/cancelado.
- OAuth compartilha chamadas simultâneas, separa tokens por credencial/escopo
  e invalida o cache em 401 sem repetir mutações financeiras.
- O PDF público utiliza o token opaco da cobrança, conforme sua RPC restrita
  ao servidor; a função pública não exige sessão do pagador.

## Aplicação no Supabase

Projeto: `dgklhykjwzmeqxejlicz` (mesmo endereço de `src/lib/supabase.ts`).

Migrations aplicadas:

- `20260907211305_inter_webhook_verified`
- `20260907211311_inter_charge_idempotency`
- `20260907211316_inter_cancel_confirmed`

Funções publicadas: `inter-webhook` v3, `bank-create-charge` v6,
`bank-cancel-charge` v3, `inter-test-connection` v7 e `inter-charge-document` v3.
Somente webhook e documento público dispensam JWT no gateway. As operações
autenticadas validam a sessão também dentro da função.

## Verificação e limites

- `deno test supabase/functions/_shared/inter/`: 37 testes aprovados.
- `npm test`: 519 testes aprovados em 94 arquivos, incluindo 4 testes novos de
  referência persistente de cobrança e as regressões do financeiro.
- Build TypeScript/Vite aprovado; lint sem erros (avisos preexistentes em outros módulos).
- `supabase/tests/inter_charge_attempts.sql`: ensaio real com fixtures em
  transação e ROLLBACK, antes e depois da aplicação. Cobre posse, duplicidade,
  snapshot, outra empresa, pagamento terminal, enriquecimento Pix e conta vazia.
- `supabase/tests/inter_safety_contract.sql`: verifica ACL, RLS e estados exatos.
- Conferência HTTP após deploy: operações sem sessão retornam 401; webhook com
  rota inválida retorna 400; documento com token inválido retorna 404.
- Fixtures transacionais verificadas: nenhum cliente de teste permaneceu salvo.

Os testes não emitem cobranças, cancelam títulos nem efetuam pagamentos reais
no Inter. As credenciais bancárias e um ciclo real de homologação não foram
exercitados nesta revisão. A publicação do frontend segue o fluxo de deploy do
repositório GitHub e é independente do deploy das Edge Functions.
