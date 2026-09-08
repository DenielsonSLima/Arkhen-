# Cadastro por convite: correção do HTTP 403

## Diagnóstico

Em 08/09/2026, o cadastro por e-mail retornou HTTP 403 em
`manage-employee-user`. O log PostgreSQL de 12:00:33.513 UTC identifica
SQLSTATE `42501` em `provisionar_usuario_funcionario_email` com a mensagem
`Conta Auth nao corresponde ao convite.`

O administrador e o perfil selecionado passaram pela preparação do cadastro.
Os logs Auth mostram criação da conta seguida de exclusão compensatória, sem
envio do convite. Os quatro arquivos da Edge Function publicada, versão 2,
correspondiam aos arquivos do repositório.

O banco tinha um gatilho legado, ausente das migrations locais:
`on_auth_user_created_auto_confirm`, em `auth.users`. Antes de cada inserção,
ele preenchia `email_confirmed_at`, mesmo quando a Edge solicitava
`email_confirm: false`. A RPC recusava corretamente a conta já confirmada.
As configurações públicas Auth também exigem confirmação de e-mail
(`mailer_autoconfirm: false`).

## Correção

- Remover somente o gatilho de confirmação automática. A confirmação volta a
  ser controlada pelo Supabase Auth e pelos parâmetros explícitos da API.
- Manter as verificações de identidade, empresa, perfil, versão da credencial e
  convite ainda não enviado. Não alterar RLS nem permissões administrativas.
- Exibir o erro do cadastro fora da área rolável, junto aos botões do formulário,
  preservando os dados para nova tentativa.

Não basta testar `account_type` no gatilho de inserção: a API administrativa do
Auth insere a conta antes de gravar os metadados administrativos personalizados.
A implementação oficial está em
[admin.go](https://github.com/supabase/auth/blob/master/internal/api/admin.go).
O comportamento de `email_confirm` está documentado em
[Auth admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Compatibilidade e verificação

Contas existentes permanecem intactas. A criação por CPF continua solicitando
`email_confirm: true`. O cadastro público já trata a resposta sem sessão e
orienta a confirmação por e-mail em `loginService.cadastrar` e `useLogin`.

Os testes do formulário verificam a recusa, a preservação dos dados, a mensagem
HTTP 403 e uma nova tentativa. A regressão SQL usa um banco temporário isolado,
sem envio de e-mails nem criação de usuários reais.

Validação geral: 522 testes em 95 arquivos passaram com `npm test`;
`npm run build` e `npm run lint` passaram sem erros (avisos preexistentes).
O teste SQL reproduz o erro original, provisiona o convite após a migration e
verifica nove recusas de segurança. Para executar, instale
`@electric-sql/pglite@0.3.14` em diretório temporário e rode:

```sh
node supabase/tests/run-convites-email.mjs /caminho/temporario/node_modules/@electric-sql/pglite/dist/index.js
```

## Revisão com três agentes

- Backend: reprodução da causa e migration mínima.
- Frontend: mensagem acessível após erro e teste integrado do formulário.
- Segurança: confronto com a ordem real da API Auth e revisão das proteções.

A publicação deve incluir a migration no Supabase e o código no GitHub.
Não é necessário republicar a Edge Function: sua validação estava correta.

A aplicação no Supabase ficou pendente de autorização explícita: a revisão
automática bloqueou a remoção do gatilho de produção por afetar a confirmação
das novas contas. A solicitação bloqueada não alterou o banco.
