# Correção do login de administrador gerenciado

O login de uma conta gerenciada com perfil Administrador falhava ao registrar
`ultimo_acesso_em`. O trigger `proteger_administrador_configurado` exigia uma
membership `admin` mesmo quando o usuário apenas registrava seu próprio acesso.
Contas gerenciadas preservam a membership `membro` e recebem permissões pelo
perfil de acesso. Não foi necessário promover memberships ou ampliar permissões.

A migration permite exclusivamente a atualização dos metadados de acesso do
próprio usuário autenticado. A comparação da linha inteira protege os demais
campos, inclusive futuras colunas. Alterações de cadastro, credenciais, tenant,
status, permissões, horários e de outro administrador mantêm as proteções existentes.

O modal de login usava o título fixo “Acesso fora do período permitido” para
qualquer erro de autorização. Agora mostra “Acesso não autorizado” e mantém a
mensagem específica do servidor. Uma nova tentativa limpa o bloqueio anterior.

Validações:

- PGlite: login do administrador gerenciado permitido; 11 alterações indevidas
  rejeitadas; edição pelo gestor e proteção do último administrador preservadas.
- Vitest: 19 testes de login, contexto de acesso e mensagens passaram.
- Build TypeScript/Vite e lint dos arquivos alterados passaram.
- Produção: contexto autenticado da conta antes bloqueada retornou com sucesso
  após aplicar a migration `20260924140015`.
- As contas solicitadas foram configuradas com a restrição de horário desativada.
- A senha temporária solicitada foi validada via API; a troca obrigatória foi
  preservada. Nenhuma senha, token ou hash foi incluído no repositório.

Reproduzir o teste isolado com `@electric-sql/pglite@0.3.14`:

```sh
node supabase/tests/run-admin-login-guard.mjs /caminho/pglite/dist/index.js supabase/migrations/20260924140015_corrigir_registro_acesso_administrador.sql
```
