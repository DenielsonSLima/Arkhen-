import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../../supabase/migrations/20260826030000_salvar_usuario_configurado_atomicamente.sql?raw';

describe('atomic accounting-user updates', () => {
  it('preserves RLS while changing membership and configuration in one RPC', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.salvar_usuario_configurado');
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain('pg_advisory_xact_lock');
    expect(migrationSql).toContain('FOR UPDATE');
    expect(migrationSql).toContain('UPDATE public.perfis');
    expect(migrationSql).toContain('UPDATE public.configuracoes_usuarios');
    expect(migrationSql).toContain('current_user_is_empresa_admin(v_empresa_id)');
    expect(migrationSql).not.toContain('SECURITY DEFINER');
  });

  it('derives authority server-side and protects tenant, self access and linked e-mail', () => {
    expect(migrationSql).toContain('profile.empresa_id = v_empresa_id');
    expect(migrationSql).toContain("v_profile_code IN ('administrador', 'gestor')");
    expect(migrationSql).toContain('target.empresa_id = v_empresa_id');
    expect(migrationSql).toContain('v_target.auth_user_id = auth.uid()');
    expect(migrationSql).toContain('conta vinculada nao pode ser alterado');
  });

  it('validates the exact payload and strict access-window shape', () => {
    expect(migrationSql).toContain("'accessConfig', 'cpf', 'email', 'nome', 'perfil', 'status', 'telefone'");
    expect(migrationSql).toContain("'days', 'enabled', 'intervals', 'message'");
    expect(migrationSql).toContain('NOT BETWEEN 1 AND 7');
    expect(migrationSql).toContain('NOT BETWEEN 1 AND 4');
    expect(migrationSql).toContain("!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'");
  });

  it('exposes only the authenticated RPC role', () => {
    expect(migrationSql).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(migrationSql).toContain('TO authenticated');
  });

  it('serializes tenant changes and counts only usable administrators', () => {
    expect(migrationSql).toContain("hashtextextended('admin-access:' || v_empresa_id::text, 0)");
    expect(migrationSql).toContain('CREATE TRIGGER a_serializar_alteracao_acesso_empresa');
    expect(migrationSql).toContain('v_empresa_id uuid := OLD.empresa_id;');
    expect(migrationSql).not.toContain('COALESCE(NEW.empresa_id, OLD.empresa_id)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.proteger_admin_utilizavel_membership');
    expect(migrationSql).toContain("other_user.status = 'Ativo'");
    expect(migrationSql).toContain("other_user.access_config ->> 'enabled'");
  });
});
