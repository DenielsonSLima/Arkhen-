# Exemplos XML WebISS

Originais obtidos da [pasta oficial compartilhada](https://drive.google.com/drive/u/0/folders/1sJeZC_iB5GPz1ox4q9BEd9zppbG3olls). Downloads conferidos por tamanho, hash e parser XML. Não são notas emitidas nem payloads prontos para transmissão.

| Arquivo | Operação SOAP | Finalidade | Erros XSD no original |
|---|---|---|---|
| [CancelarNfseEnvio.xml](03-cancelamento/CancelarNfseEnvio.xml) | `CancelarNfse` | Cancelamento | 6 |
| [ConsultarNfseFaixaEnvio.xml](01-consultas/ConsultarNfseFaixaEnvio.xml) | `ConsultarNfsePorFaixa` | Consulta | 5 |
| [ConsultarNfseRpsEnvio.xml](01-consultas/ConsultarNfseRpsEnvio.xml) | `ConsultarNfsePorRps` | Consulta | 5 |
| [ConsultarNfseServicoPrestadoEnvio.xml](01-consultas/ConsultarNfseServicoPrestadoEnvio.xml) | `ConsultarNfseServicoPrestado` | Consulta | 10 |
| [ConsultarNfseServicoTomadoEnvio.xml](01-consultas/ConsultarNfseServicoTomadoEnvio.xml) | `ConsultarNfseServicoTomado` | Consulta | 12 |
| [EnviarLoteRpsSincronoEnvio.xml](02-emissao/EnviarLoteRpsSincronoEnvio.xml) | `RecepcionarLoteRpsSincrono` | Emissão | 65 |
| [GerarNfseEnvio.xml](02-emissao/GerarNfseEnvio.xml) | `GerarNfse` | Emissão | 58 |
| [SubstituirNfseEnvio.xml](04-substituicao/SubstituirNfseEnvio.xml) | `SubstituirNfse` | Substituição (gera outra nota) | 67 |

Os erros estão preservados em `../00-controle/validacao-xsd/`. Campos vazios, alternativas incompatíveis e assinaturas ilustrativas exigem montagem de dados próprios. Nenhum original foi preenchido ou enviado.

As consultas não criam NFS-e. Emissão, cancelamento e substituição têm efeitos distintos e não devem ser acionados para testar conexão.
