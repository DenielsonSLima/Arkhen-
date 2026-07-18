# Relatório de testes para apresentação — 20/07/2026

Data da execução: 18/07/2026

## Resultado executivo

Estado geral após as correções: **aprovado tecnicamente para demonstrar o fluxo de Gestor, Agenda e Atividades na base de homologação**.

A aplicação compila, o lint não apresenta erros e o pacote de produção responde HTTP 200 nas rotas públicas verificadas. O Supabase correto (`dgklhykjwzmeqxejlicz`) foi acessado pelo MCP `contabil`, recebeu as migrations de correção e passou por nova rodada de CRUD autenticado. Todos os registros descartáveis foram removidos ou executados em transações com rollback.

Permanece uma ressalva operacional: só existe uma conta real em `auth.users`, que é administradora. O papel Funcionário passou no teste RLS por simulação autenticada e rollback, mas ainda é necessário criar uma segunda conta real para demonstrar dois logins simultâneos.

## Atualização pós-correção — 18/07/2026

Foram aplicadas onze migrations pelo MCP `contabil`:

1. `20260718202757_corrigir_agenda_atividades_rbac`
2. `20260718203612_corrigir_vinculo_perfil_e_config_agenda`
3. `20260718203853_filtrar_modulos_por_permissao`
4. `20260718204233_restringir_execucao_funcoes_rbac`
5. `20260718204524_exigir_membresia_em_documentos_do_proprietario`
6. `20260718204902_validar_cliente_documento_sem_expor_carteira`
7. `20260718205236_vinculo_operacional_sem_ambiguidade_e_storage`
8. `20260718210217_endurecer_documentos_e_gestao_modulos`
9. `20260718210431_remover_senha_compartilhamento_texto_plano`
10. `20260718210639_restringir_security_definer_anonimas`
11. `20260718210912_restaurar_acl_funcoes_internas`

Correções confirmadas:

- os triggers de `agenda_responsaveis`, `agenda_eventos`, `atividades_rotinas` e `atividades_tarefas` agora atualizam `atualizado_em`;
- tarefas, rotinas e responsáveis usam `auth_user_id` e `config_usuario_id`, sem depender de nomes que podem se repetir;
- a Agenda identifica o responsável atual pelo usuário autenticado, sem usar o primeiro registro da lista;
- edição de evento persiste responsável, cliente, recorrência e demais metadados;
- eventos manuais podem ser concluídos e reabertos pela interface;
- “Minha Fila” recebe do banco apenas tarefas do usuário comum;
- o cliente informado ao criar tarefa pela equipe não é mais substituído por `Escritório`;
- módulos do menu são filtrados pelas permissões do perfil;
- cada card de Configurações aplica sua própria permissão e permanece fechado enquanto as permissões carregam;
- funcionário não acessa as telas de equipe, padrões e configurações da Agenda;
- RLS administrativo foi separado por ação e permissão para clientes, usuários, perfis, documentos, Agenda e Atividades;
- upload, alteração e exclusão no Storage respeitam tenant, proprietário e permissões de documentos;
- documentos não podem trocar tenant, proprietário, escopo ou arquivo físico durante uma edição de metadados;
- links protegidos usam senha criptograficamente aleatória de 128 bits, exibida somente na criação, e persistem apenas o hash;
- cadastros duplicados para o mesmo login foram consolidados e um índice impede novas duplicidades;
- funções RBAC, administrativas, financeiras, fiscais e de integração não podem ser executadas pelo papel anônimo;
- somente as consultas públicas por token de cobrança e documento continuam disponíveis sem login; rotinas internas permanecem exclusivas do `service_role`.

### Reteste de Gestor

O CRUD autenticado de responsável, rotina, tarefa e evento passou em todas as etapas: criar, editar, concluir/alterar status e excluir. A consulta final retornou zero registro de teste nas quatro tabelas.

### Reteste de Funcionário

O usuário administrador foi rebaixado temporariamente para `membro`/`Funcionário` dentro de uma transação com rollback. Resultado:

| Operação | Resultado esperado | Resultado obtido |
|---|---|---|
| Visualizar Agenda e própria fila | Permitido | Passou |
| Criar evento próprio | Permitido | Passou |
| Criar tarefa própria | Permitido | Passou |
| Criar cliente | Negado | Passou |
| Criar outro usuário | Negado | Passou |
| Criar evento para outro responsável | Negado | Passou |
| Criar tarefa sem vínculo com o usuário | Negado | Passou |
| Editar tipos globais da Agenda | Negado | Passou |
| Criar, editar e excluir documento próprio da empresa | Permitido | Passou |
| Receber módulos conforme o perfil | Permitido | `inicio, atividades, protocolos, documentos, agenda, configuracoes` |

O rollback foi verificado: o usuário real permanece `admin` e ativo. Na correção definitiva, o cadastro administrativo duplicado foi preservado como inativo e sem vínculo de login; existe agora somente um cadastro ativo por conta e empresa.

### Validação técnica final

- `npm run build`: passou, 3.166 módulos transformados;
- `npm run lint`: passou sem erros; permanecem avisos preexistentes fora das correções realizadas;
- auditoria de ACL: funções RBAC acessíveis somente por `authenticated`/`service_role`, e funções de trigger apenas pelo banco;
- índices por `empresa_id, responsavel_user_id` criados para a fila e rotinas.

## Resultados da rodada inicial — antes das correções

## Etapa 1 — Base técnica

| Verificação | Resultado | Evidência |
|---|---|---|
| TypeScript + build de produção | Passou | `npm run build`, 3.166 módulos transformados |
| Lint | Passou com ressalvas | 0 erros e 44 avisos |
| Inicialização do pacote compilado | Passou | `vite preview` iniciou em `127.0.0.1:4173` |
| Rotas `/`, `/login`, `/signup`, `/demo-publico`, `/shared/teste`, `/cobranca/teste` | Passou | HTTP 200 e `text/html` |
| Suíte automatizada | Bloqueada | Não existe Vitest, Jest, Playwright ou Cypress configurado |
| Banco de dados remoto | Passou com falhas funcionais | MCP `contabil` confirmou o projeto `dgklhykjwzmeqxejlicz` |

Ressalvas de qualidade encontradas:

- 17 arquivos de código ultrapassam o limite interno de 500 linhas.
- O maior arquivo possui 1.994 linhas (`SimulacoesCalculosPage.tsx`).
- Há 11 usos de `alert()` nativo, principalmente no Financeiro.
- O bundle principal minificado possui aproximadamente 3 MB; o build alerta para chunks acima de 500 kB.

## Etapa 1.1 — CRUD real no Supabase

Todos os registros receberam IDs fixos e prefixo `TESTE CODEX 20260718`. Foram testados:

| Objeto | Criar | Editar | Excluir | Resultado |
|---|---:|---:|---:|---|
| Empresa atendida/cliente | Passou | Passou | Passou | Nome, status, telefone, cidade e UF foram alterados |
| Usuário configurado sem papel de gestor | Passou | Passou | Passou | Perfil, status, telefone e janela de acesso foram alterados |
| Biblioteca pessoal | Passou | Passou | Passou | Documento foi renomeado e movido de pasta |
| Biblioteca da empresa/cliente | Passou | Passou | Passou | Documento foi renomeado e movido de pasta |
| Responsável da Agenda | Passou | Falhou | Passou | Trigger tenta escrever coluna inexistente `updated_at` |
| Rotina de Atividades | Passou | Falhou | Passou | Mesmo defeito de trigger |
| Tarefa atribuída | Passou | Falhou | Passou | Concluir, reabrir, checklist e edição falham no trigger |
| Evento da Agenda | Passou | Falhou | Passou | Editar, concluir e reabrir falham no trigger |

Falha reproduzida nas quatro tabelas operacionais:

```text
ERROR: record "new" has no field "updated_at"
PL/pgSQL function set_updated_at()
```

As tabelas usam `atualizado_em`, mas seus triggers chamam uma função que escreve exclusivamente em `NEW.updated_at`.

Limpeza comprovada após os testes: 0 clientes, usuários, responsáveis, rotinas, tarefas, eventos ou documentos com o prefixo de teste. As contagens finais voltaram para 3 clientes, 5 usuários, 6 documentos, 4 rotinas, 7 tarefas e 0 eventos manuais.

## Etapa 2 — Perfis de gestor e funcionário

Resultado: **reprovado na análise estática**.

1. A matriz de permissões é exibida em Configurações, mas não é consumida pelo layout para autorizar módulos ou ações.
2. O menu considera apenas se o módulo está habilitado para a empresa. Ele não considera as permissões do perfil autenticado.
3. O perfil exibido no layout vem do armazenamento persistido e possui fallback local como `Administrador`.
4. As policies locais de `configuracoes_usuarios` e `configuracoes_perfis_acesso` permitem todas as operações para qualquer membro autenticado da mesma empresa; não exigem papel de gestor.
5. O fluxo de Agenda considera o primeiro registro de `agenda_responsaveis` como usuário atual, em vez de localizar o usuário autenticado.
6. Um perfil não reconhecido pela hierarquia da Agenda recebe nível 5 como fallback, equivalente ao maior nível.
7. Existe somente uma conta em `auth.users`, e ela é administradora. Funcionário, Financeiro e Analista Fiscal existem apenas em `configuracoes_usuarios`, sem login real vinculado.

### Simulação autenticada de membro comum

O único usuário autenticado foi temporariamente rebaixado para `membro`/`Funcionário` dentro de transações que terminaram com rollback. A RPC administrativa retornou `can_manage = false`, mas o RLS ainda permitiu:

- ler todos os 4 clientes, 6 usuários, 8 tarefas e 1 evento existentes durante o teste;
- criar cliente, usuário, responsável, rotina, tarefa, evento e documento empresarial;
- editar cliente, usuário e documentos pessoais/empresariais;
- excluir cliente, usuário, responsável, rotina, tarefa, evento e documentos.

O rollback foi confirmado: o perfil voltou a `admin`, os dados reais permaneceram intactos e os registros de teste continuaram disponíveis apenas até a limpeza controlada.

Impacto na apresentação: um funcionário pode receber menus ou ações de gestor; o teste por perfil não pode ser considerado confiável antes de correção e reteste no Supabase correto.

## Etapa 3 — Atividades, tarefas e divisão de trabalho

| Fluxo | Resultado | Observação |
|---|---|---|
| Listar tarefas e rotinas | Passou no banco, com falha de isolamento | O serviço e o membro comum leem todas as tarefas ativas da empresa |
| Criar tarefa própria | Passou no banco | Responsável é salvo por nome |
| Dividir/atribuir tarefa para funcionário | Reprovado na análise | Atribuição usa apenas `responsavel_nome`, sem vínculo estável com `auth_user_id` |
| “Minha Fila” do funcionário | Reprovado na análise | A tela recebe todas as tarefas e não filtra pelo usuário autenticado |
| Criar tarefa pela visão de equipe | Falha encontrada | O cliente informado no formulário é substituído por `Escritório` |
| Editar status/notas/checklist | Reprovado no banco | Trigger usa coluna inexistente e cancela toda atualização |
| Marcar concluída/reabrir | Reprovado no banco | A atualização falha antes de persistir o status |
| Excluir tarefa | Passou no banco | Exclusão real de teste passou; frontend usa exclusão lógica sem confirmação em várias telas |
| Excluir rotina | Passou no banco | Exclusão real de teste passou; frontend usa exclusão lógica |
| Sincronizar tarefa com Agenda | Parcial | A Agenda lê tarefas, mas edição/conclusão deve ser feita em Atividades |

## Etapa 4 — Agenda

| Fluxo | Resultado | Observação |
|---|---|---|
| Criar evento | Passou no banco | Persistiu título, data, tipo, responsável, cliente e metadados |
| Editar título, descrição, tipo, categoria e data | Reprovado no banco | Trigger `set_updated_at` impede a atualização |
| Alterar responsável do evento | Reprovado | O formulário envia, mas o serviço de edição ignora `responsavel_id` |
| Alterar empresa vinculada | Reprovado | O formulário envia, mas o serviço de edição ignora `cliente_id` |
| Alterar recorrência | Reprovado | O serviço de edição não atualiza os metadados de recorrência |
| Marcar evento como concluído/confirmado | Reprovado | Interface não chama a função e o banco também rejeita o update pelo trigger |
| Excluir evento manual | Passou no banco | Frontend possui modal personalizado de confirmação |
| Excluir tarefa exibida na Agenda | Protegido | A Agenda orienta excluir no módulo Atividades |
| Permitir padrões somente ao gestor | Parcial | A área de padrões usa RPC de autorização; os eventos manuais não têm a mesma proteção explícita no frontend |

## Etapa 5 — Usuários, perfis e configurações

| Fluxo | Resultado | Observação |
|---|---|---|
| Criar/editar usuário | Passou no banco | Serviço e formulário presentes |
| Inativar usuário | Passou no banco | Atualiza status para `Inativo` |
| Excluir usuário sem histórico | Passou no banco | Registro descartável foi removido |
| Proteger exclusão de usuário com histórico | Implementado | Orienta usar inativação |
| Criar/editar/inativar perfil | Implementado via RPC | Não executado no banco correto |
| Aplicar permissões do perfil no sistema | Reprovado | Matriz é consultiva; layout e ações não usam as permissões |
| Restringir acesso por dia/horário | Não comprovado | Configuração é salva, mas não foi localizada aplicação efetiva no login/layout |
| Habilitar/desabilitar módulos | Implementado por empresa | Não substitui o RBAC por perfil |

## Etapa 6 — Demais módulos

| Módulo | Compilação/rota | Funcional com banco | Pontos de atenção |
|---|---|---|---|
| Início | Passou | Pendente | Alterações locais anteriores foram preservadas |
| Clientes/Gestão Empresarial | Passou | Pendente | CRUD precisa de conta e banco de teste |
| Conformidade | Passou | Pendente | Arquivo de serviço com 559 linhas |
| Protocolos | Passou | Pendente | Serviço com 524 linhas; lint alerta dependências de hooks |
| Simulações e Cálculos | Passou | Pendente | Página com 1.994 linhas e cálculos a revisar contra regra de RPC |
| Planejamento Tributário | Passou | Pendente | Depende de RPCs remotas |
| Reforma Tributária | Passou | Pendente | Depende de XML e RPCs remotas |
| Faturamento | Passou | Pendente | Integrações e mutações financeiras não foram disparadas |
| Financeiro | Passou com ressalvas | Pendente | Usa `alert()` nativo em 10 pontos de fluxos financeiros |
| Documentos | Passou com bloqueador de segurança | Pendente | Senha de compartilhamento é persistida também em texto puro (`senha_visualizacao`) |
| Parametrização | Passou | Pendente | CRUD e regras precisam do banco correto |
| Relatórios | Passou | Pendente | RPCs e dados remotos não verificados |
| Guia de Ajuda | Passou | Não depende de CRUD crítico | Inspeção estática concluída |
| Integrações bancária/fiscal | Passou | Não executar na apresentação sem sandbox | Podem criar cobrança, testar credenciais ou emitir/cancelar documento fiscal |

## Situação dos bloqueadores da rodada inicial

1. Triggers de Agenda e Atividades: **resolvido e retestado**.
2. Policies de escrita e exclusão administrativas: **resolvido e retestado**.
3. Permissões por perfil nos módulos e ações principais: **resolvido e retestado por simulação RLS**.
4. Conta real separada de Funcionário: **pendente para demonstração com dois logins**; o comportamento foi validado por transação autenticada com rollback.
5. Identificação do usuário autenticado na Agenda: **resolvido**.
6. Isolamento de “Minha Fila”: **resolvido no banco e frontend**.
7. Vínculo estável da tarefa com `auth_user_id`: **resolvido**.
8. Edição completa da Agenda: **resolvido**.
9. Concluir/reabrir evento pela interface: **resolvido**.
10. Senha de compartilhamento em texto puro: **resolvido**; a coluna legada foi removida e somente o hash permanece.

## Roteiro de reteste autenticado

### Gestor

1. Entrar com conta Gestor.
2. Confirmar acesso apenas aos módulos permitidos pelo perfil.
3. Criar uma tarefa `TESTE APRESENTAÇÃO`, atribuir ao funcionário e vincular a um cliente.
4. Editar prazo, prioridade, responsável, cliente, checklist e observações.
5. Marcar como concluída, reabrir e verificar atualização na Agenda e nos indicadores.
6. Excluir a tarefa e confirmar que sai das visões de fila, equipe, painel e Agenda.
7. Criar evento na Agenda; editar todos os campos; concluir, reabrir e excluir.
8. Criar/editar/inativar um usuário de teste e conferir a matriz do perfil.

### Funcionário

1. Entrar com conta Funcionário em sessão separada.
2. Confirmar que Financeiro, Faturamento e gestão de equipe não aparecem quando não permitidos; em Configurações, somente “Meu Perfil” deve ficar disponível.
3. Confirmar que “Minha Fila” contém somente tarefas atribuídas a esse usuário.
4. Abrir a tarefa criada pelo gestor, marcar checklist, incluir observação e concluir.
5. Confirmar que não pode editar/excluir tarefa de outro funcionário nem atribuir tarefa para perfil superior.
6. Confirmar que a própria Agenda não permite administrar padrões globais.

### CRUD seguro por módulo

Usar registros prefixados com `TESTE APRESENTAÇÃO` em Clientes, Protocolos, Documentos, Parametrização, Faturamento e Financeiro. Em integrações bancárias/fiscais, usar somente sandbox e nunca emitir cobrança ou documento fiscal real durante a demonstração.

## Condição para aprovação final

O sistema está pronto para a demonstração do Gestor. Para uma apresentação completa com troca real de sessão entre perfis, ainda é necessário:

- criar e vincular uma conta real de Funcionário;
- repetir o roteiro visual com as duas sessões;
- evitar integrações bancárias/fiscais fora de sandbox;
- compartilhar a senha somente uma vez, junto com o link, pois ela não pode ser recuperada depois da geração.
