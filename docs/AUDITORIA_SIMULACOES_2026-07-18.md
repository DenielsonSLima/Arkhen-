# Auditoria do módulo Simulações — 18/07/2026

## Escopo e método

Foram inventariadas e executadas, com contexto de usuário autenticado e empresa, as 18 RPCs expostas pelo módulo. A revisão comparou as fórmulas do banco, os campos da interface, os PDFs e casos de controle com legislação, tabelas e manuais oficiais vigentes em 2026.

O resultado de uma simulação só pode ser tratado como apuração quando todos os fatos geradores, cadastros, incidências, documentos e particularidades da empresa estiverem representados. Onde isso não ocorre, a interface deve chamar o resultado de estimativa ou triagem.

## Resultado executivo

- As 18 funções responderam no ensaio autenticado, sem erro de contrato ou permissão.
- INSS e IRRF usam parâmetros versionados por competência; as faixas de 2026 conferem com as tabelas oficiais.
- Foram corrigidas divergências materiais em `simular_rescisao`, `simular_tempo_empresa`, `simular_multas` e `simular_comparativo_regime`.
- A função interna do MEI deixou de ser executável pelo papel `authenticated`; o acesso passa obrigatoriamente pela validação de CNAE e tenant.
- As demais calculadoras continuam úteis como estimativas, mas algumas não possuem dados suficientes para uma apuração fiscal ou trabalhista conclusiva. As limitações estão detalhadas abaixo.

## Comparativo função por função

| Simulação / RPC | Situação após a auditoria | Comparação com a regra real e limites |
|---|---|---|
| Folha — `simular_folha` | Parcial, estimativa | INSS/IRRF 2026 conferem. FGTS CLT usa 8% e VT limita a participação do empregado a 6%. Ainda não apura corretamente todas as combinações de aprendiz, doméstico, diretor, estágio e pró-labore; encargos patronais são genéricos, adicional noturno é aplicado sobre o salário inteiro e a base da insalubridade depende da regra aplicável. Não usar como fechamento de folha/eSocial. |
| Rescisão — `simular_rescisao` | **Corrigida** | Agora separa saldo e 13º para INSS/IRRF; não tributa aviso indenizado nem férias indenizadas; conta avos com fração igual ou superior a 15 dias; projeta aviso proporcional; separa FGTS rescisório e multa de 40% do líquido do TRCT; distingue sem justa causa, justa causa e pedido de demissão. Médias, estabilidade, CCT/ACT, afastamentos e extrato do FGTS continuam exigindo conferência individual. |
| Pró-labore — `simular_prolabore` | Parcial, estimativa | Retenção previdenciária de 11% limitada ao teto e IRRF 2026 estão versionados. A CPP é um percentual genérico da parametrização e não identifica sozinha Simples Anexo III/V, Anexo IV, Lucro Presumido ou Real. Para análise societária, preferir a função avançada de lucros e dividendos. |
| DAS — `simular_das` | Fórmula-base válida, escopo limitado | Faixas dos Anexos I a V e fórmula `(RBT12 × alíquota nominal − parcela a deduzir) / RBT12` conferem. O usuário precisa informar previamente o anexo correto. A função não determina fator R, segregação das receitas, monofásico, substituição tributária, sublimite/ISS ou CPP fora do DAS no Anexo IV. |
| PIS/COFINS — `simular_pis_cofins` | Parcial, estimativa | Alíquotas gerais de 0,65%/3% e 1,65%/7,6% conferem. O valor de “créditos de entrada” não prova que cada aquisição gera crédito; incidência, exclusões, alíquota zero, monofásico e conceito de insumo precisam ser classificados documento a documento. |
| Multas e juros — `simular_multas` | **Corrigida** | Multa de mora de 0,33% ao dia, limitada a 20%, e juros pela Selic mensal a partir do mês seguinte ao vencimento mais 1% no mês do pagamento. As taxas oficiais BCB SGS 4390 foram carregadas de jan/2025 a jun/2026. Período sem taxa cadastrada agora gera erro visível em vez de inventar percentual. Confirmar a guia no Sicalc. |
| Férias — `simular_ferias` | Parcial, estimativa | Remuneração dos dias, terço constitucional, abono e adiantamento do 13º estão separados; INSS/IRRF seguem a competência. Não substitui folha porque custo patronal, incidências particulares, médias e regras de fracionamento/CCT não são integralmente modelados. |
| Tempo de empresa — `simular_tempo_empresa` | **Corrigida** | Antes acumulava férias de todos os meses históricos como se fossem provisão pendente. Agora mostra 13º do ano corrente e férias do período aquisitivo corrente. FGTS histórico é explicitamente uma estimativa com salário atual constante e inclui reflexo estimado do 13º; a fonte correta para rescisão é o extrato analítico da CAIXA. |
| Encargos trabalhistas — `simular_encargos_trabalhistas` | Parcial, triagem | Calcula CPP, RAT × FAP, terceiros, FGTS e provisão genérica. RAT/FAP/terceiros variam por estabelecimento, CNAE, FPAS e terceiros. “Simples geral = zero” não pode ser usado para Anexo IV, cuja CPP é recolhida fora do DAS. |
| CLT × PJ × estágio — `simular_contratacao` | Cenário gerencial, não conclusão jurídica | Compara números genéricos. Não avalia subordinação, pessoalidade, habitualidade, risco de vínculo, tributação efetiva do PJ, regras da Lei do Estágio, seguro, jornada e bolsa/auxílios. Não deve recomendar forma de contratação apenas pelo menor custo. |
| Regimes tributários — `simular_comparativo_regime` | **Reclassificada como triagem** | A antiga função indicava um “melhor regime” usando percentuais fixos. Agora retorna `Indeterminado` e expõe as limitações. Uma decisão real precisa de CNAE, receitas segregadas, município/ISS, fator R, créditos, benefícios, adicional de IRPJ, ajustes de Lucro Real e regras transitórias de 2026. Os três valores exibidos permanecem cenários genéricos. |
| Imposto estimado — `simular_imposto_estimado` | Apenas cenário educacional | Multiplica o faturamento pela alíquota digitada. A divisão entre tributos é uma distribuição ilustrativa fixa e não uma apuração de ICMS, ISS, IPI, PIS/COFINS, IRPJ ou CSLL. Não usar para emitir guia ou lançar obrigação. |
| Custos e break-even — `simular_custos` | Matemática gerencial básica | Ponto de equilíbrio é válido se custos fixos, percentual variável e margem desejada estiverem corretamente classificados. Não modela mix de produtos, impostos por produto, capacidade, sazonalidade ou restrições de caixa. Entradas economicamente impossíveis devem ser rejeitadas na interface. |
| Carnê-Leão — `simular_carne_leao` | Boa estimativa versionada | Usa tabela mensal, previdência, dependentes, pensão e livro-caixa limitado ao rendimento da atividade. Imposto no exterior, compensações, natureza do rendimento e despesas escrituráveis exigem documentos. Vencimento considera fim de semana, mas feriado bancário deve ser conferido. |
| IRPF anual — `simular_irpf_anual` | Boa projeção, não declaração | Compara desconto legal e simplificado com parâmetros anuais e pagamentos informados. Não representa todas as fichas, dependências, bens, rendimentos sujeitos a tratamento próprio, exterior, ganho de capital e malha. O resultado deve ser conciliado no programa oficial. |
| Pró-labore e dividendos — `simular_prolabore_dividendos` | Boa triagem versionada | Separa INSS/IRRF/CPP por regime, exige CPP informada no Anexo IV, limita distribuição ao lucro/participação e aplica a retenção de 10% quando dividendos de uma mesma fonte superam R$ 50 mil no mês em 2026. A tributação mínima anual acima de R$ 600 mil é apenas indicativa e requer todos os rendimentos, exclusões e impostos pagos. |
| Ganho de capital — `simular_ganho_capital` | Boa estimativa com ressalvas | Faixas progressivas de 15% a 22,5%, pequeno valor, único imóvel até R$ 440 mil e reinvestimento residencial em 180 dias estão modelados. Reduções por data de aquisição e situações especiais não são calculadas; conferir no GCAP. |
| MEI — `simular_mei` | Boa triagem com controle de tenant | Calcula DAS 2026, limite anual/proporcional, excesso de 20%, projeção e condições impeditivas básicas. O CNAE precisa existir como permitido no catálogo ativo da empresa. O catálogo local não substitui o Anexo XI completo nem a análise de ocupação, sócio, filial e empregado. |

## Casos de controle documentados

### Rescisão sem justa causa

Entrada: salário de R$ 3.500, admissão em 01/01/2022, desligamento em 18/07/2026, aviso indenizado e saldo anterior de FGTS de R$ 8.500.

| Item | Antes | Depois da correção |
|---|---:|---:|
| INSS da rescisão | R$ 988,09 | R$ 350,38 |
| IRRF da rescisão | R$ 1.386,21 | R$ 0,00 |
| Aviso proporcional | incluído na base indevida | 42 dias, fora de INSS/IRRF |
| FGTS rescisório estimado | não demonstrado | R$ 746,67 |
| Multa de 40% | somada ao líquido | R$ 3.698,67, separada na conta vinculada |
| Líquido das verbas do TRCT | misturava FGTS | R$ 12.094,06 |

### Tempo de empresa

Com os mesmos R$ 3.500 e referência em 18/07/2026, a provisão corrente passa a usar 7/12 de 13º e 7/12 de férias, em vez de multiplicar férias por todo o histórico. O total exibido, R$ 28.120,56, é rotulado como provisões correntes mais FGTS histórico estimado, não como passivo trabalhista fechado.

### DARF vencido

Para R$ 5.000, vencimento em 20/05/2026 e pagamento em 18/07/2026: multa de 19,47% (59 dias) e juros de 2,12% (Selic de junho de 1,12% + 1% no mês do pagamento), total de R$ 6.079,50.

## Fontes oficiais consultadas

### Trabalhista e previdenciário

- [MTE — Perguntas frequentes de proteção ao trabalho](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/proteja/duvidas-frequentes)
- [CLT — Decreto-Lei nº 5.452/1943, texto compilado](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm)
- [Lei nº 12.506/2011 — aviso prévio proporcional](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12506.htm)
- [CAIXA — Manual de recolhimentos mensais e rescisórios do FGTS](https://www.caixa.gov.br/Downloads/fgts-manuais-e-cartilhas-operacionais/Manual_de_Orientacoes_Recolhimentos_Mensais_e_Rescisorios_ao_FGTS_V18.pdf)
- [Receita Federal — incidência de contribuição previdenciária](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/emissao-e-pagamento-de-darf-das-gps-e-dae/calculo-de-contribuicoes-previdenciarias-e-emissao-de-gps/tabela-de-incidencia-de-contribuicao)
- [Receita Federal — verbas de desligamento e IR](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/malha-fiscal/antecipacao/rendimentos-recebidos-de-empresa/fui-demitido)
- [INSS — tabela de contribuição mensal 2026](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal)
- [Receita Federal — tabela mensal do IRPF 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026)

### Fiscal e tributário

- [Resolução CGSN nº 140/2018 — Simples Nacional](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278)
- [Lei Complementar nº 123/2006](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm)
- [Receita Federal — CPP no Anexo IV](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional)
- [Receita Federal — IRPJ](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/IRPJ)
- [Receita Federal — CSLL](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/CSLL)
- [Receita Federal — PIS/Pasep e Cofins](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/pis-pasep-cofins)
- [Receita Federal — cálculo de acréscimos legais](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/pagamento-em-atraso/como-calcular-juros-de-mora-acrescimos-legais)
- [Banco Central — série SGS 4390, Selic acumulada no mês](https://dadosabertos.bcb.gov.br/dataset/4390-taxa-de-juros---selic-acumulada-no-mes)

### Pessoa física, dividendos, ganho de capital e MEI

- [Lei nº 15.270/2025 — redução do IR e tributação de altas rendas/dividendos](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm)
- [Receita Federal — manual do Carnê-Leão](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/manual)
- [Receita Federal — perguntas e respostas IRPF 2026](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-0-2026-04-18.pdf)
- [Receita Federal — alíquotas de ganho de capital](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/ganhos-de-capital/aliquotas)
- [Receita Federal — operações de ganho de capital não sujeitas](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/ganhos-de-capital/operacoes-nao-sujeitas)
- [Portal do Empreendedor — contribuição mensal do MEI em 2026](https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes/pagamento-da-contribuicao-mensal-carne-mensal/qual-o-valor-das-contribuicoes)

## Critério de uso seguro

- **Pode apoiar cálculo:** rescisão e multas, desde que entradas e documentos sejam conferidos; funções avançadas de PF/MEI como projeção.
- **Pode apoiar triagem:** folha, férias, pró-labore, DAS, PIS/COFINS, encargos e tempo de empresa.
- **Não pode concluir sozinho:** regime tributário, forma CLT/PJ/estágio e “imposto estimado”. Esses cenários não contêm fatos suficientes para uma recomendação ou apuração.
