# Acervo WebISS recebido em 09/09/2026

Downloads e conferência concluídos em 10/09/2026. Foram recebidos nove links de arquivos e uma pasta do Drive com oito XMLs. O conteúdo original foi preservado; nomes locais foram simplificados. Nenhum XML foi transmitido ao WebISS.

## Organização

- `01-cadastro-cec/`: cadastro do escritório contábil e de pessoa jurídica.
- `02-integracao-webservice/`: guia rápido, manual revisado (conteúdo versão 5.2) e XSD atual usado na conferência.
- `03-exemplos-xml/`: oito originais separados por consulta, emissão, cancelamento e substituição. Consulte o índice próprio.
- `04-material-apoio-legado/`: ZIP original e conteúdo extraído, inclusive schemas/WSDL internos. Os dois PDFs de integração/modelo conceitual são de novembro/2012.
- `05-manuais-complementares/`: AIDF, operação NFS-e no portal, RANFS e DES-IF.
- `06-textos-extraidos/`: texto pesquisável, com quebra de página dos PDFs.
- `07-evidencias-do-usuario/`: capturas fornecidas pelo usuário para análise do fluxo; não são prova de NFS-e autorizada.
- `00-controle/`: origens, hashes SHA-256, inventário, validações e prévias de leitura.

## Leitura recomendada

1. [Conclusões e pendências](CONFERENCIA.md).
2. [Manual CeC do escritório](01-cadastro-cec/manual-cec-escritorio-contabilidade.pdf), páginas 12 e 21–22: responsável técnico.
3. [Manual técnico v5.2](02-integracao-webservice/manual-integracao-abrasf-202-ibscbs-v5.2.pdf): comunicação, assinatura, campos, serviços e retornos.
4. [Guia de atualização](02-integracao-webservice/guia-tecnico-rapido-abr-asf-202-ibscbs.pdf): alterações IBS/CBS e identificadores.
5. [Exemplos XML por operação](03-exemplos-xml/README.md).

## Integridade e origem

- Todos os nove arquivos foram obtidos por download HTTP 200 e reconhecidos como oito PDFs e um ZIP.
- Oito XMLs: bytes conferem com a listagem pública do Drive; todos são XML bem-formado.
- Dez PDFs no total, contando dois dentro do ZIP: leitura e renderização de capa concluídas. Foram inspecionadas visualmente páginas relevantes do CeC e capas do manual técnico.
- ZIP principal e dois ZIPs internos: CRC íntegro; extração com proteção de caminho.
- Planilha do pacote abre e contém a aba `Erros e Alertas`.
- O XSD atual foi baixado adicionalmente do link indicado pelos documentos. Seu import XMLDSig foi copiado da fonte oficial já arquivada no projeto, com hash próprio.
- Validação XSD dos oito XMLs originais: **nenhum aprovado**, por campos vazios e inconsistências de modelos. Isso não significa corrupção do download. Logs completos em `00-controle/validacao-xsd/`.

O manifesto `00-controle/manifest-arquivos.json` preserva URL, ID do Drive, nome remoto, nome local, tamanho e hash dos nove arquivos; `manifest-xml.json` faz o mesmo para os oito XMLs. `inventario-integridade.json` inclui os materiais extraídos e complementares. Os originais não foram corrigidos silenciosamente.
