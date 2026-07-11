# Memória do Agente Frontend

Esta é a memória persistente do **Agente Frontend**. Ela serve para rastrear decisões arquiteturais de UI, componentes, estado de formulários e controle de hooks do projeto Contabil.

## 📌 Estado Atual do Frontend
* **Status**: Módulo Configurações começou a migração de mocks/localStorage para Supabase + TanStack Query.
* **Módulos atualizados**:
  - `configuracoes/integracao-bancaria`: Substituiu `integracao-asaas`. Implementa abas e controle de saldo inicial.
  - `parceiros`: Filtros, abas, alternador e BrasilAPI.
  - `parametrizacao`: substitui a pasta antiga `cadastros` no frontend. A barra lateral usa o id pai `parametrizacao` e submódulos `parametrizacao-*`.
  - `atividades`: serviços principais migrados para Supabase (`atividades_modelos`, `atividades_rotinas`, `atividades_tarefas`, `atividades_instancias`, `atividades_fechamentos`). O workspace de rotinas/tarefas usa TanStack Query e realtime. Não deve semear dados fictícios no frontend.
    1. **Folha de Pagamento** (`atividades-folha`)
    2. **Pró-Labore** (`atividades-prolabore`)
    3. **Obras** (`atividades-obras`)
    4. **DCTFWeb / Tributos** (`atividades-dctfweb`): Com visualização e preenchimento de valores fiscais de INSS, IRRF e REINF.
    5. **Obrigações Mensais** (`atividades-obrigacoes`)
    6. **Tarefas Internas** (`atividades-tarefas`)
    7. **Configurar Fluxos** (`atividades-config`): Painel administrativo para customização das etapas dos modelos e vinculação dos fluxos às empresas clientes.

## 🎨 Padrões de Interface Adotados
* **Submenus Expansíveis sem Navegação Pai**: No `GestorLayout.tsx`, "Parametrização" e "Atividades" são pastas expansíveis que não realizam navegação própria, garantindo que o usuário acesse diretamente os submódulos corretos.
* **Checklists Dinâmicos com Barra de Progresso**: O componente de checklist calcula a porcentagem de conclusão (`(itens_marcados / total_itens) * 100`) e exibe uma barra de progresso dourada que se torna verde ao atingir 100% de conclusão.
* **Tabelas Customizadas**: No submódulo `DCTFWeb`, a tabela exibe colunas exclusivas para os impostos declarados na competência (INSS, IRRF, REINF).
* **Painel de Configuração de Modelos**: Interface interativa que permite gerenciar checklists dinâmicos adicionando e removendo etapas em tempo real, cujas mudanças são refletidas de forma imediata.

## 🔄 Fluxos de Consulta e Mutação (TanStack Query)
* `QueryClientProvider` está ativo em `src/main.tsx`.
* Query keys do módulo Configurações ficam em `src/modules/gestor/configuracoes/queries/configuracoesKeys.ts`.
* `Dados da Empresa` usa `useEmpresaQuery` e `useUpdateEmpresaMutation`, com invalidação de `configuracoesKeys.empresa()`.
* `Marca d'Água` usa `useMarcaDaguaQuery` e `useUpdateMarcaDaguaMutation`, com invalidação de `configuracoesKeys.marcaDagua()`.
* `Perfis de Acesso` usa `usePerfisAcessoQuery`, `useSavePerfilAcessoMutation` e `useDeletePerfilAcessoMutation`, consumindo RPCs Supabase.
* `Permissões do Sistema` lê a mesma fonte de perfis/RBAC do Supabase e não usa `localStorage`.
* A ação visual de remoção em Perfis de Acesso representa inativação (`ativo = false`), não exclusão física.
* `useConfiguracoesRealtime` assina alterações em `configuracoes_empresa`, `configuracoes_marca_dagua` e `configuracoes_perfis_acesso` e invalida queries correspondentes.
* `useAtividadesRealtime` assina alterações em `atividades_modelos`, `atividades_rotinas`, `atividades_tarefas`, `atividades_instancias` e `atividades_fechamentos`, invalidando `atividadesKeys`.
* `useAgendaRealtime` assina alterações em `agenda_eventos`, `agenda_tipos_evento`, `agenda_categorias_evento`, `agenda_responsaveis` e `atividades_tarefas`, invalidando `agendaKeys`.
* Agenda e Atividades não geram mais dados automáticos no frontend. Banco vazio deve resultar em telas vazias/empty states, sem TechCorp, prazos fiscais hardcoded, colaboradores fictícios ou rotinas demo.
* A pasta física `src/modules/gestor/cadastros` foi removida/renomeada para `src/modules/gestor/parametrizacao`; imports de outros módulos agora apontam para `../../parametrizacao/...`.
* `src/modules/gestor/agenda/services/agenda.mock.ts` foi renomeado para `agenda.defaults.ts`; nomenclatura `MOCK_*` removida da Agenda.
* Removido `window.location.reload()` do fluxo de vincular rotina em Atividades; a tela atualiza via estado do hook.
* Pendência explícita: módulos legados não roteados dentro de `src/modules/gestor/atividades/{diarias,semanais,mensais,internas,por-funcionarios,rotinas}` ainda existem no repositório, mas o fluxo atual do layout usa `AtividadesPage` com componentes migrados. Não reativar essas telas antigas sem convertê-las para Supabase.

## ⚠️ Histórico de Impedimentos e Decisões
* **Uso Proibido de Diálogos Nativos**: Modais estilizados de backdrop com desfoque de fundo e botões dourados/vermelhos são usados para todas as interações e caixas de diálogo, banindo `window.confirm`, `window.alert`, `window.prompt`, `confirm()`, `alert()` e `prompt()`.
* **Quick Modal Global**: Confirmações de exclusão e avisos bloqueantes devem usar `src/modules/gestor/components/SystemQuickModal.tsx`, renderizado via portal em `document.body`, para cobrir a tela inteira e manter o mesmo padrão visual do modal "Sair do Sistema".
* **Proibição de Testes em Navegador / Abertura de Browser**: O agente frontend é expressamente proibido de testar abrindo o navegador (browser/web page) ou utilizando ferramentas de simulação visual (browser subagents). Toda verificação deve ser feita puramente por build e código estático.
