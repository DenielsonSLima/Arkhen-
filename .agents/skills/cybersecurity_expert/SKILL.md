---
name: Cybersecurity Expert Skill
description: Triggers when analyzing security boundaries, multi-tenancy controls, SQL injections, input validations, RLS validation, and data sanitation.
---
# Cybersecurity Expert Skill

## Responsabilidades
- Auditar a segurança das tabelas no banco de dados e garantir a inexistência de caminhos que burlem o RLS.
- Prevenir vulnerabilidades comuns de segurança (OWASP Top 10) como SQL Injection, Broken Object Level Authorization (BOLA/IDOR), e XSS.
- Assegurar validação robusta de entradas em ambas as pontas (Zod no frontend e validações na RPC/DB).
- Auditar vazamentos de credenciais e segurança de variáveis de ambiente.

## Instruções de Execução
1. **Controle de Tenant Isolado**: A separação de dados corporativos é crítica. Garanta que todo acesso ao banco valide o vínculo do `auth.uid()` com a empresa correta. Uma empresa NUNCA pode ter acesso a dados da empresa M.
2. **Prevenção de SQL Injection**: Utilize obrigatoriamente prepared statements ou a API nativa do cliente Supabase. Nunca concatene strings de input do usuário diretamente em consultas SQL.
3. **Controle de Segurança de RPC**: Ao escrever funções SQL com `SECURITY DEFINER`, sempre configure o `search_path` de forma explícita para evitar o sequestro do caminho de busca (search_path hijacking) e valide manualmente se o usuário solicitante pertence ao tenant correspondente.
   ```sql
   CREATE OR REPLACE FUNCTION schema.minha_funcao()
   RETURNS void AS $$
   BEGIN
     -- Validação manual redundante de tenant
     IF NOT EXISTS (SELECT 1 FROM perfis WHERE user_id = auth.uid() AND empresa_id = p_empresa_id) THEN
       RAISE EXCEPTION 'Acesso não autorizado';
     END IF;
     ...
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
   ```
4. **Sanitização de Dados**: Inputs que serão renderizados como HTML no frontend devem ser limpos para evitar Cross-Site Scripting (XSS).
