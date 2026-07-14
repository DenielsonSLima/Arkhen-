# Registro interno de versões

## Beta 1.006 — 2026-07-14

- Adicionada a categoria Pessoa Física em Simulações, com Carnê-Leão/Livro Caixa, projeção de IRPF, pró-labore, lucros e dividendos e ganho de capital.
- Adicionada a projeção de limite e enquadramento do MEI.
- Tabelas de IRRF, INSS e demais parâmetros tributários passaram a ser versionadas por competência no Supabase.
- Cada simulador passou a consultar sua própria RPC e a registrar memória, alertas e versão dos parâmetros usados.
- Incluída a consulta protegida de Tabelas Tributárias no módulo Parametrização.
- Corrigida a tela de Categorias Financeiras, com botões padronizados e formulário de criação/edição em modal centralizado e responsivo.
- Corrigidas a projeção proporcional do MEI, as hipóteses de isenção e reinvestimento no ganho de capital e a CPP do Simples Nacional Anexo IV.
- Relatórios das novas simulações agora incluem resultados, e as tabelas tributárias podem ser consultadas por competência.

## Beta 1.005 — 2026-07-14

- Corrigidos os resumos de Financeiro e Faturamento, incluindo lançamentos manuais e baixas parciais.
- Relatórios e Planejamento Tributário passaram a consumir dados reais do escritório.
- Cálculos das simulações foram centralizados nas RPCs do Supabase.
- Ajustada a comunicação sobre NFS-e conforme configuração e disponibilidade municipal.
- Revisada a apresentação pública para remover promessas técnicas ou comerciais não comprovadas.
- Incluída a identificação discreta da versão na tela de acesso.
