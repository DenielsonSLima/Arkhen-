import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../../supabase/migrations/20260718203612_corrigir_vinculo_perfil_e_config_agenda.sql?raw';

describe('RBAC do usuário convidado', () => {
  it('não compara a membership com o perfil funcional', () => {
    expect(migrationSql).not.toContain('pa.id = u.perfil_id');
    expect(migrationSql).toContain('lower(pa.nome) = lower(u.perfil)');
  });

  it('amarra membership, usuário e perfil funcional ao mesmo tenant', () => {
    expect(migrationSql).toContain('public.is_empresa_member(p_empresa_id)');
    expect(migrationSql).toContain('p.empresa_id = p_empresa_id');
    expect(migrationSql).toContain('pa.empresa_id = u.empresa_id');
    expect(migrationSql).toContain('u.empresa_id = p_empresa_id');
    expect(migrationSql).toContain('u.auth_user_id = auth.uid()');
    expect(migrationSql).toContain("u.status = 'Ativo'");
  });
});
