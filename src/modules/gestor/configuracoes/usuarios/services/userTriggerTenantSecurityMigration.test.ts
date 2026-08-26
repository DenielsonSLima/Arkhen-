import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../../supabase/migrations/20260826030200_fixar_tenant_real_triggers_usuarios.sql?raw';

describe('user trigger tenant identity', () => {
  it('uses NEW only for inserts and the persisted OLD tenant for updates and deletes', () => {
    const declarations = migrationSql.match(
      /v_empresa_id uuid := CASE[\s\S]*?WHEN TG_OP = 'INSERT' THEN NEW\.empresa_id[\s\S]*?ELSE OLD\.empresa_id[\s\S]*?END;/g,
    );
    expect(declarations).toHaveLength(2);
    expect(migrationSql).not.toContain('COALESCE(NEW.empresa_id, OLD.empresa_id)');
  });

  it('keeps trigger functions private and validates usable administrators', () => {
    expect(migrationSql).toContain("other_user.status = 'Ativo'");
    expect(migrationSql).toContain("other_user.access_config ->> 'enabled'");
    expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.enforce_membership_privilege_integrity\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.enforce_user_configuration_privilege_integrity\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  });
});
