# Isolamento multicliente

## Modelo de acesso

O sistema possui dois níveis de contexto:

- **Empresa/tenant:** usuários internos do escritório podem acessar os dados do tenant conforme o perfil.
- **Cliente:** usuários externos possuem vínculo explícito em `cliente_usuario_acessos` e só podem acessar os clientes mapeados.

O RPC `current_access_context()` informa ao frontend:

- tipo do contexto: `empresa` ou `cliente`;
- empresa do usuário;
- cliente principal;
- clientes autorizados;
- nome e logo que devem identificar a sessão.

## Regras obrigatórias

1. Toda tabela operacional deve possuir `empresa_id`.
2. Dados pertencentes a um cliente devem possuir `cliente_id` ou `cliente_empresa_id`.
3. Contas externas nunca dependem apenas de `is_empresa_member()`.
4. Políticas de cliente usam `current_user_can_access_client_row()`.
5. RPCs de leitura e escrita devem respeitar RLS ou validar tenant, cliente e permissão explicitamente.
6. Funções `SECURITY DEFINER` devem fixar `search_path=public,pg_temp`.
7. E-mails compartilhados não devem substituir contas individuais quando a autoria for relevante.

## Validação executada

Foi criada uma identidade temporária vinculada exclusivamente ao cliente fictício AgroVale.

Resultados:

- visualizou exatamente um cliente: AgroVale;
- não visualizou a B&M;
- atividades, tarefas, instâncias, cobranças e lançamentos retornaram apenas linhas da AgroVale;
- a identidade temporária foi removida imediatamente após o teste.

A conta externa da B&M visualizou:

- exatamente um cliente: B&M;
- um modelo, uma rotina, uma tarefa e uma instância vinculados à B&M;
- nenhum lançamento, cobrança, conta bancária ou configuração interna de outro cliente.

O administrador interno continuou visualizando os quatro clientes do tenant.

## Logo

Logomarcas são ativos públicos de marca e podem permanecer em bucket público para renderização direta. O objeto legado da B&M recebeu proprietário e metadados de identificação no ambiente.

Novos uploads devem seguir:

```text
<empresa_id>/cliente-logos/<cliente_id>/<arquivo>
```

A cópia física do objeto legado para o novo caminho deve ser feita pela API de Storage, preservando o conteúdo binário. Não altere apenas `storage.objects.name`, pois isso não move o objeto no provedor de armazenamento.
