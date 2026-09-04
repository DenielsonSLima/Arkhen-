# manage-employee-user

Edge Function para provisionar e concluir o primeiro acesso de contas gerenciadas.
Quem possui e-mail recebe um convite para criar a própria senha. Quem possui somente
CPF recebe uma senha temporária gerada no servidor e precisa substituí-la no primeiro
login. Para o login por CPF, o Supabase Auth recebe internamente um alias HMAC-SHA256;
o alias não é tratado como fronteira de segurança.

## Variáveis obrigatórias

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS` (JSON automático com uma chave `default` do tipo
  `sb_secret`; a função rejeita chaves legadas)
- `SUPABASE_SERVICE_ROLE_KEY` (somente ações administrativas)
- `APP_URL` (origem HTTPS usada no redirect do convite, por exemplo
  `https://app.exemplo.com`)

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

### Criar funcionário somente com CPF

Exige `Authorization: Bearer <JWT do gestor>`.

```json
{
  "action": "create",
  "nome": "Funcionário",
  "cpf": "52998224725",
  "perfil_id": "uuid",
  "email": null,
  "telefone": null,
  "access_config": { "enabled": false }
}
```

O Auth e a senha temporária são criados apenas no servidor. A resposta contém
`temporary_password` uma única vez e usa `Cache-Control: no-store`; ela não é
persistida no banco nem registrada em logs. A conta permanece sem acesso aos dados
da empresa até a criação da senha definitiva.

### Convidar funcionário por e-mail

Exige `Authorization: Bearer <JWT do gestor>`.

```json
{
  "action": "invite_email",
  "nome": "Usuário gestor",
  "email": "usuario@empresa.com",
  "cpf": "52998224725",
  "perfil_id": "uuid",
  "telefone": "79999999999",
  "access_config": { "enabled": false }
}
```

O vínculo é criado como pendente e inativo antes do envio. O link redireciona para
`/redefinir-senha`, onde uma sessão isolada chama `complete_first_access`. Se o
envio falhar, a função compensa o vínculo e o usuário Auth recém-criados.

### Concluir primeiro acesso

Exige o JWT da própria conta `employee_cpf` ou `employee_email`:

```json
{ "action": "complete_first_access", "password": "SenhaDefinitiva1" }
```

A confirmação usa uma versão de credencial rotativa entre banco, Auth e JWT. Isso
mantém o acesso bloqueado durante qualquer falha parcial e permite repetir com
segurança uma atualização transitória que tenha parado antes de concluir o Auth.

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

Configure também a política global do Supabase Auth com no mínimo 10 caracteres,
letra e número: um titular autenticado pode chamar diretamente a API padrão do Auth,
que não suporta a regra dinâmica de comparar a nova senha com o próprio CPF.

## Segurança operacional

`verify_jwt = false` é necessário porque `login` é público. Todas as demais ações
validam o JWT e, para contas gerenciadas, a versão atual da credencial. As RPCs
administrativas são executáveis somente por `service_role`. Nunca registre CPF,
senha, alias, tokens ou o conteúdo de `temporary_password`.
