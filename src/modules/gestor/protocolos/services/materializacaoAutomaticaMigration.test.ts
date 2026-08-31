import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260831013001_materializar_rotinas_por_cron.sql?raw';

describe('materialização automática de rotinas no servidor', () => {
  it('agenda um único job a cada quinze minutos e não expõe helpers privados', () => {
    expect(migrationSql).toContain("'*/15 * * * *'");
    expect(migrationSql).toContain("jobname = 'materializar-atividades-operacionais-15min'");
    expect(migrationSql).toContain('app_private.materializar_rotinas_todas_empresas');
    expect(migrationSql).toContain('REVOKE ALL ON SCHEMA app_private');
    expect(migrationSql).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(migrationSql).toContain('atividades_rotinas_materializacao_idx');
    expect(migrationSql).toContain('app_private.materializacao_rotinas_falhas');
    expect(migrationSql).toContain("now() - interval '90 days'");
  });

  it('mantém autorização no wrapper e nunca atribui o cron a uma pessoa', () => {
    const wrapper = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.materializar_atividades_rotinas'),
      migrationSql.indexOf('CREATE EXTENSION IF NOT EXISTS pg_cron'),
    );

    expect(wrapper).toContain("public.current_user_has_permission(v_empresa_id, 'atividades:manage')");
    expect(wrapper).toContain("'usuario', auth.uid(), true");
    expect(migrationSql).toContain("'sistema', NULL, false");
    expect(migrationSql).toContain("v_ator_nome := 'Sistema — materialização automática'");
  });

  it('torna o log de sistema explícito e mantém a idempotência da tarefa', () => {
    expect(migrationSql).toContain('ALTER COLUMN ator_user_id DROP NOT NULL');
    expect(migrationSql).toContain("ator_tipo = 'sistema' AND ator_user_id IS NULL");
    expect(migrationSql).toContain('ON CONFLICT (empresa_id, rotina_id, vencimento)');
    expect(migrationSql).toContain('WHERE rotina_id IS NOT NULL AND ativo = true');
    expect(migrationSql).toContain('usuario.auth_user_id IS NOT NULL');
  });

  it('encerra rotinas únicas e materializa somente empresas e clientes ativos', () => {
    expect(migrationSql).toContain("IF v_rotina.frequencia = 'Única' THEN");
    expect(migrationSql).toContain("CASE WHEN v_rotina.frequencia = 'Única' THEN false ELSE ativa END");
    expect(migrationSql).toContain("empresa.status = 'ativo'");
    expect(migrationSql).toContain("cliente.status = 'Ativa'");
  });

  it('isola a atribuição à rotina escolhida', () => {
    expect(migrationSql).toContain('(p_rotina_id IS NULL OR rotina.id = p_rotina_id)');
    expect(migrationSql).toContain("v_empresa_id, v_hoje, 'usuario', auth.uid(), true, p_rotina_id");
  });
});
