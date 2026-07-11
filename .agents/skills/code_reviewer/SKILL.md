---
name: General Reviewer Skill
description: Triggers when reviewing code layout, folder structures, file lines limit, imports sanity, and quality assurance.
---
# General Reviewer Skill

## Responsabilidades
- Validar a aderência às regras de modularidade e subdivisão de arquivos do projeto.
- Garantir que nenhum arquivo de código ultrapasse o limite estrito de 500 linhas.
- Conferir integridade dos imports e remover imports não utilizados ou dependências circulares.
- Assegurar que componentes visuais não contenham lógica de cálculo ou fórmulas matemáticas embutidas.
- Garantir que o agente não abra navegadores para testar alterações visualmente (Proibição Total de Teste via Browser).

## Instruções de Execução
1. **Controle de Linhas**: Antes de finalizar qualquer arquivo, verifique a contagem total de linhas. Se ultrapassar ou estiver muito próximo de 500 linhas, quebre-o imediatamente em arquivos menores e modulares.
2. **Estrutura de Pastas**: Verifique se a estrutura física segue rigorosamente a convenção modular estabelecida:
   - `services/` isolado.
   - `hooks/` isolado.
   - `queries/` isolado.
   - `forms/` estruturado com subpastas para cards e sub-formulários (Adição, Edição).
3. **Frontend Clean**: Se encontrar qualquer cálculo de negócios, soma de valores financeiros, percentual ou imposto sendo computado no frontend, barre a implementação e force o refactor para utilizar uma RPC no banco de dados.
4. **Proibição de Navegador**: Certifique-se de que nenhum navegador ou subagente de browser seja aberto para testar visualmente ou validar as alterações. Toda a validação deve ser feita estática ou por build.
