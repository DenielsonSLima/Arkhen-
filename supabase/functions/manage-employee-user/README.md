# manage-employee-user

Edge Function para contas de funcionário autenticadas por CPF, sem usar e-mail ou
telefone como credencial. O Supabase Auth recebe internamente um alias HMAC-SHA256,
derivado por uma RPC restrita a `service_role` com segredo persistido no schema
`private`; ele não é exposto pelas tabelas públicas, UI ou resposta explícita.
Depois de autenticado, porém, o titular pode observá-lo em `user.email`/JWT; por
isso o alias não é uma fronteira de segurança.

## Variáveis obrigatórias

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS` (JSON automático com uma chave `default` do tipo
  `sb_secret`; a função rejeita chaves legadas)
- `SUPABASE_SERVICE_ROLE_KEY` (somente ações administrativas)

O segredo do alias é criado uma única vez pela migration, com 32 bytes aleatórios,
e acompanha o backup do banco. Não o regenere nem altere o domínio técnico sem uma
migração coordenada dos aliases existentes no Auth e no banco.

Antes do deploy, crie/mantenha uma Secret API Key nomeada `default` e habilite
**Auth > Rate Limits > IP Address Forwarding** no dashboard do Supabase. O login
repassa o `x-forwarded-for` recebido como `Sb-Forwarded-For`; se a chave ou o IP
de origem não estiver disponível, responde `503` sem tentar autenticar.

## Contratos HTTP

Todas as chamadas usam `POST` com JSON e respostas `Cache-Control: no-store`.

### Login público

Entrada:

```json
{ "action": "login", "cpf": "52998224725", "password": "senha" }
```

Sucesso:

```json
{ "ok": true, "access_token": "...", "refresh_token": "..." }
```

O cliente usa os tokens com `supabase.auth.setSession`. Antes de devolver a
sessão, a função chama `obter_contexto_usuario_atual` com o client autenticado;
status, membership, perfil e janela precisam estar válidos no servidor. Erros de
CPF, conta, senha ou acesso são genéricos. A autenticação chama
`signInWithPassword`, portanto as proteções e o rate limit do GoTrue continuam no
caminho.

### Criar funcionário

Exige `Authorization: Bearer <JWT do gestor>`.

```json
{
  "action": "create",
  "nome": "Funcionário",
  "cpf": "52998224725",
  "password": "SenhaForte1",
  "perfil_id": "uuid",
  "email": null,
  "telefone": null,
  "status": "Ativo",
  "access_config": { "enabled": false }
}
```

O Auth é criado apenas no servidor. Se a RPC transacional falhar, a função
reconcilia por `auth_user_id` antes de excluir somente o Auth recém-criado.

### Redefinir senha

Exige JWT do gestor:

```json
{ "action": "reset_password", "usuario_id": "uuid", "password": "NovaSenha1" }
```

Não há recuperação por e-mail/telefone; a redefinição é assistida pelo gestor.

### Alterar a própria senha CPF

Exige o JWT do próprio funcionário CPF e valida novamente status, membership,
perfil, janela, identidade Auth e a regra dinâmica que proíbe incluir o CPF no
caminho oferecido pela aplicação:

```json
{ "action": "change_own_password", "password": "NovaSenha1" }
```

Sucesso:

```json
{ "ok": true, "usuario_id": "uuid", "must_change_password": false }
```

Contas com login por e-mail continuam usando o fluxo Auth tradicional. Configure
também a política global do Supabase Auth com no mínimo 10 caracteres, letra e
número: um titular autenticado pode chamar diretamente a API padrão do Auth, que
não suporta a regra dinâmica de comparar a nova senha com o próprio CPF.

## Segurança operacional

`verify_jwt = false` é necessário porque `login` é público. As ações `create`,
`reset_password` e `change_own_password` validam o JWT manualmente e as RPCs
administrativas são executáveis somente por `service_role`. Nunca registre CPF,
senha, alias ou tokens.
