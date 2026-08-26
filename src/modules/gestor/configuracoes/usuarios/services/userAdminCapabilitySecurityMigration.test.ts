import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  'supabase/migrations/20260826025300_alinhar_capacidade_admin_e_exclusao_usuarios.sql',
  'utf8',
);

describe('capacidade administrativa e ciclo de vida Auth', () => {
  it('expõe somente a condição administrativa do tenant atual', () => {
    expect(migrationSql).toContain('current_user_is_active_empresa_admin()');
    expect(migrationSql).toContain('current_user_is_empresa_admin(public.current_empresa_id())');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.current_user_is_active_empresa_admin()');
    expect(migrationSql).toContain('TO authenticated');
  });

  it('bloqueia DELETE autenticado de cadastro já vinculado ao Auth', () => {
    expect(migrationSql).toContain('OLD.auth_user_id IS NOT NULL');
    expect(migrationSql).toContain("NOT IN ('', 'service_role')");
    expect(migrationSql).toContain('Contas vinculadas ao login devem ser inativadas');
    expect(migrationSql).toContain('BEFORE DELETE ON public.configuracoes_usuarios');
  });
});
