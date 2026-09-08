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

A primeira correção publicou a migration no Supabase e o código no GitHub,
preservando a validação original da Edge Function.

Após autorização explícita do responsável, a migration foi aplicada no Supabase
em 08/09/2026 e registrada com a versão `20260908121459`. A verificação posterior
confirmou a ausência do gatilho e a preservação da quantidade de contas e do
estado de confirmação de todas as contas existentes. O arquivo local usa a mesma
versão registrada no banco.

Nenhum convite foi enviado durante a validação; uma nova tentativa de cadastro
pelo administrador executará o fluxo normal de envio.

## Segunda falha: cadastro pendente sem envio

A tentativa de 09:18 retornou HTTP 503 depois do provisionamento. O cadastro
permaneceu `Pendente`, mas `invited_at` e `confirmation_sent_at` estavam nulos.
A mensagem posterior identificou a falha em `inviteRedirectUrl`: `APP_URL`
ausente ou inválido era verificado somente depois de gravar Auth e vínculo.

A Edge agora tem destino canônico quando a configuração opcional não existe e
valida um valor explícito antes de qualquer criação. Falhas de transporte no envio
também seguem a compensação protegida, que não apaga um convite já enviado.

Uma nova consulta autorizada mostra o estado real do convite. O gestor pode
enviar/reenviar convites ainda não aceitos pela mesma conta pendente, sem apagar
ou recriar os cadastros. A interface diferencia ausência de envio, data registrada,
aceite com senha pendente e falha na consulta. Não há reenvio automático.

O redirecionamento remoto foi conferido com token sintético inválido, sem seguir
ou consumir link real: Supabase respondeu 303 para
`https://arkhen.vercel.app/redefinir-senha` com erro de token expirado. A página
respondeu HTTP 200. Os testes de callback/primeira senha passaram; nenhum e-mail
real foi disparado nessa verificação. Essa segunda correção requer publicação
da Edge Function e do frontend.

O deploy dessa segunda correção foi bloqueado pela revisão automática por exigir
autorização explícita para publicar as alterações de envio/reenvio. A Edge de
produção continua na versão 2. O código fica preparado em branch de revisão; a
publicação da função deve preceder a integração do frontend na `main`.
