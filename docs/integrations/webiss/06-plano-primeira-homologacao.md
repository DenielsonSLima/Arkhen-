# Reunião: primeira emissão em homologação — 09/09/2026

Participantes: coordenação, etapas_acesso_webiss, etapas_emissor e fiscal_nfse.

## Decisão e etapas

1. **Desbloquear o certificado (prioridade após os prints enviados).** Corrigido no banco o uso de `digest` sem schema nas RPCs de configuração e upload. Migração `20260910013830_fix_fiscal_digest_schema.sql` aplicada. Chamada SHA256, definições e permissões verificadas; regressão SQL sem gravação aprovada. Usuário deve preencher a senha, selecionar novamente o A1 e conferir o resultado.
2. **Conferir o pedido WebISS.** Usuário envia o comprovante/status do pedido já feito. Distinguir criação de usuário, CeC solicitado e CeC aprovado em homologação; não repetir cadastro existente. [Procedimento oficial](https://itabaianase.webiss.com.br/externo/manual/visualizar).
3. **Completar o cadastro fiscal.** A empresa do sistema corresponde à prestadora B&M do PDF; CNPJ e IM já disponíveis. Conferir certificado, serviço, regime, alíquota, retenções e série/próximo RPS. Parâmetros padrão da tela não comprovam a tributação da empresa. Após upload, reconferir e salvar os parâmetros: campos ainda não salvos podem ser substituídos pelo retorno do servidor.
4. **Preparar um cenário e disponibilizar ajustes.** Definir tomador, descrição, valor e municípios. Completar campos exigidos pelo cenário, validar XML/XSD/assinatura e disponibilizar frontend/função compatíveis. Layout/parser mais completos não significam que todos os campos já são enviados pelo builder. Diagnósticos de certificado e WSDL não comprovam credenciamento fiscal.
5. **Emitir uma vez após CeC aprovado.** Enviar em homologação, consultar o mesmo RPS, preservar XML e conferir PDF com marca d'água da empresa e identificação do ambiente. Se o resultado for incerto, consultar o mesmo RPS antes de repetir.

## Limites da verificação do certificado

O erro mostrado era de persistência no banco. A correção não comprova sozinha o upload completo ou o teste de assinatura do certificado real. O teste sintético com gravação nas RPCs foi rejeitado pela revisão automática por possível efeito no Vault e não foi executado; foi substituído por verificações sem gravação. Permissões e search_path permanecem iguais, e os avisos de segurança não aumentaram.

Nenhuma emissão foi feita nesta etapa. Os ajustes anteriores de frontend/PDF e função fiscal ainda precisam de publicação coordenada.
