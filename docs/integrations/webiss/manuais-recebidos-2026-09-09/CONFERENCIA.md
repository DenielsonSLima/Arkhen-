# Conferência documental e consequências para o Arkhen

## Cadastro e homologação

O manual específico de escritório (páginas físicas 12 e 21–22) confirma cadastro prévio do responsável técnico como Pessoa Física – Avulso. A opção “Sou meu próprio contador” (p.19) pertence ao campo Contador das informações fiscais e não comprova dispensa do responsável técnico. Na sessão observada, só apareceu Pessoa Jurídica; o CPF confirmado pelo usuário retornou “Contador não encontrado”. Essa divergência depende do WebISS; não mudar CPF/perfil fiscal para contornar o cadastro.

A homologação tem credenciamento próprio. Os códigos fictícios orientados pelo portal para o cadastro não são instrução genérica para substituir identidades ou todos os municípios de qualquer XML. Cadastro aprovado, identidade do certificado e autorização do serviço precisam ser verificados separadamente.

## Versões e materiais

- Manual técnico remoto termina em V5.0 no nome, mas a capa identifica versão 5.2. Nome local registra a versão do conteúdo; nome remoto está no manifesto.
- Manual DES-IF remoto cita versão 5.1 no nome, mas a capa identifica 5.7, de 09/08/2018.
- ZIP “Material de Apoio WebService – Versão 5.0” contém PDFs ABRASF 2.02 de novembro/2012. Guardar como legado, sem usar para excluir campos adicionados na revisão IBS/CBS.
- AIDF trata de autorização para impressão de documentos; RANFS trata de registro/aceite; DES-IF trata de instituições financeiras. Não são o contrato principal do emissor NFS-e.

## XML e comunicação

Os oito XMLs são modelos incompletos: CNPJ, IM, números, datas, valores e outros campos aparecem vazios. Os exemplos de emissão/cancelamento/substituição também contêm estruturas de assinatura ilustrativas. Todos são bem-formados, mas todos reprovam o XSD atual; alguns apresentam incompatibilidades além de campos vazios. Preservar os originais e construir uma instância válida própria, validada e assinada antes de transmitir.

O manual técnico (páginas físicas18–22) separa comunicação SOAP/WSDL, autenticação por certificado e assinatura XML. WSDL público acessível não prova autenticação do certificado nem autorização fiscal. Na consulta básica anterior, o endpoint público de produção de Itabaiana respondeu HTTP200 com TLS validado e WSDL válido; nenhuma operação fiscal foi transmitida nesse teste.

As consultas disponíveis na documentação incluem RPS, faixa, serviços prestados e serviços tomados. Os oito exemplos contêm quatro consultas, duas emissões, um cancelamento e uma substituição. Para listar as últimas cinco notas de um tomador, filtrar emitente/tomador/ambiente, percorrer as páginas do período escolhido e ordenar por emissão/número; uma página isolada não comprova as cinco últimas de todo o histórico.

Há divergências de grafia entre tabelas do PDF e XSD/exemplos (como CodigoNBS/CodigoNbs e TomadorServico/Tomador). O contrato efetivo exige validação com o schema correspondente; não gerar tags copiando mecanicamente tabelas. A presença estrutural opcional de NBS/IBSCBS não determina sozinha a obrigação fiscal do cenário.

## Evidências das fotos

As capturas de produção das23:50 mostram competência09/2026 e descrição referindo08/2026, atividade1703, CNAE6920601, NBS vazio, ISS exigível e municípios de prestação/incidência em Itabaiana. São dados do formulário, não prova de emissão autorizada. Competência e descrição precisam permanecer campos independentes; não corrigir mês nem substituir enquadramento fiscal por inferência.

As capturas das23:57–23:58 demonstram a função de carregar dados de nota anterior no portal e a mistura atual de dados bancários no formulário “Somente NFS-e” do Arkhen. A adaptação deve copiar dados reutilizáveis para um novo rascunho, sem copiar número, RPS, assinatura, status autorizado ou código de verificação.

## Resultado da reunião técnica

Três agentes analisaram envio, cancelamento e revisão geral. As skills estão em `.agents/skills/arkhen-webiss-*` no projeto, com referências próprias e ativação por contexto do Arkhen.

Problemas confirmados antes da adaptação:
1. “Somente NFS-e” acionava criação de cobrança bancária.
2. Histórico derivava status fiscal e data de dados bancários.
3. Construtor acoplava competência à data do RPS e incidência à prestação.
4. Campos NBS/IBS-CBS não estavam integralmente representados no construtor.
5. Catálogo do WSDL não significava implementação de cancelamento, substituição ou lotes.

A implementação deve separar rascunho fiscal da cobrança, revisar o payload efetivo antes do envio, preservar idempotência, consultar antes de repetir resultado incerto, mostrar histórico fiscal verdadeiro e oferecer cópia das notas anteriores do tomador. Não emitir nem cancelar em produção para validar essa alteração.

## Limites da conferência

Leitura de documentos, conferência de estrutura, CRC/hash, renderização e validação XSD não equivalem a certificação fiscal, autenticação remota do A1, credenciamento ou emissão homologada. Regras municipais, obrigatoriedade por cenário e algoritmos aceitos devem ser conferidos na operação vigente. O acervo preserva as fontes; exemplos/documentos não são autorização para agir sobre notas reais.
