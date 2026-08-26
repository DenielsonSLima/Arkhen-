import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826030100_alinhar_leitura_documentos_e_modulos.sql?raw';

describe('document metadata read policy', () => {
  it('keeps every permission inside the active tenant and document scope', () => {
    expect(migrationSql).toContain('empresa_id = (SELECT public.current_empresa_id())');
    expect(migrationSql).toContain("'documentos:view'");
    expect(migrationSql).toContain("'documentos:manage'");
    expect(migrationSql).toContain("'documentos:view-own'");
    expect(migrationSql).toContain("'documentos:create'");
    expect(migrationSql).toContain('owner_user_id = (SELECT auth.uid())');
    expect(migrationSql).toContain('public.current_user_can_access_client_row(empresa_id, cliente_id)');
    expect(migrationSql).toContain('public.current_user_is_client_scoped(empresa_id)');
    expect(migrationSql).toContain('public.current_user_has_client_access(empresa_id, cliente_id)');
  });

  it('only enables Conformidade when its activity source is readable', () => {
    expect(migrationSql).toContain("catalogo.modulo = 'conformidade'");
    expect(migrationSql).toContain("'conformidade:view'");
    expect(migrationSql).toContain("'atividades:view'");
    expect(migrationSql).toContain("'atividades:view-own'");
    expect(migrationSql).toContain("'atividades:manage'");
  });
});
