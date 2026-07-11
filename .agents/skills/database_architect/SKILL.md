---
name: Database Architect Skill
description: Triggers when working with SQL database migrations, schemas, Supabase configurations, RLS policies, and Database RPC functions.
---
# Database Architect Skill

## Responsabilidades
- Criar e gerenciar tabelas, relacionamentos e restrições no banco de dados.
- Implementar e verificar políticas de Row Level Security (RLS) para isolamento multi-empresa.
- Desenvolver funções RPC para processamento de cálculos contábeis ou de negócios no banco de dados (backend/db).
- Configurar logs e auditorias das operações do banco.

## Instruções de Execução
1. Toda tabela criada deve conter obrigatoriamente um campo de referência à empresa (ex: `empresa_id uuid REFERENCES empresas(id)` ou `tenant_id uuid`).
2. Habilitar RLS em toda nova tabela:
   ```sql
   ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
   ```
3. Criar políticas RLS garantindo que o usuário autenticado só acesse registros de sua respectiva empresa:
   ```sql
   CREATE POLICY select_tenant_policy ON nome_tabela
     FOR ALL
     USING (empresa_id = (SELECT empresa_id FROM perfis WHERE user_id = auth.uid()));
   ```
4. Implementar lógicas de cálculo complexas como funções PL/pgSQL executáveis via RPC no Supabase:
   ```sql
   CREATE OR REPLACE FUNCTION calcular_valores_contabeis(p_empresa_id uuid, p_filtros jsonb)
   RETURNS jsonb AS $$
   DECLARE
     v_resultado jsonb;
   BEGIN
     -- Lógica de cálculo puramente no banco de dados
     ...
     RETURN v_resultado;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
