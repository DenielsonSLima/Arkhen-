---
name: Integration Specialist Skill
description: Triggers when integrating external APIs, handling webhooks, payment gateways (like Asaas, Stripe, Pix), NF-e/NFS-e services, and processing async jobs.
---
# Integration Specialist Skill

## Responsabilidades
- Gerenciar integrações com gateways de pagamento (ex: Asaas, Pix, Stripe).
- Implementar e validar endpoints de Webhooks para recebimento de eventos externos.
- Assegurar o isolamento das credenciais/tokens de integração de cada empresa.
- Tratar falhas de conectividade, rate limit e implementar filas ou retentativas seguras.

## Instruções de Execução
1. **Isolamento de Credenciais**: Tokens de API externos (como a chave do Asaas) devem ser carregados dinamicamente com base na empresa ativa (`empresa_id`). Nunca utilize chaves fixas no código do servidor para todas as empresas. Mantenha essas credenciais salvas em tabela segura criptografada e protegida por RLS no banco de dados.
2. **Segurança de Webhooks**: Sempre valide a assinatura digital (headers de segurança como `Signature` ou tokens de autenticação acordados) recebida nos payloads dos webhooks das integradoras antes de processar qualquer alteração de estado no banco de dados.
3. **Idempotência**: Garanta que as chamadas de recebimento de pagamento ou webhook sejam idempotentes (ex: registrar o ID do evento externo na transação contábil/financeira e conferir se já foi processado antes de computar o saldo).
4. **Resiliência e Filas**: Para requisições assíncronas longas ou instáveis, adote mecanismos de retentativa com backoff exponencial ou filas de processamento no Supabase (como Edge Functions assíncronas ou tabelas de Job Queue processadas em background).
