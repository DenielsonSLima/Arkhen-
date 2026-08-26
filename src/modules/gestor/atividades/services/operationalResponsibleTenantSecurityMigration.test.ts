import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826025400_vincular_responsaveis_operacionais_tenant.sql?raw';

describe('migration de responsáveis operacionais por tenant', () => {
  it('usa FKs compostas para rotinas, tarefas e agenda', () => {
    expect(migrationSql).toContain('FOREIGN KEY (responsavel_config_usuario_id, empresa_id)');
    expect(migrationSql).toContain('FOREIGN KEY (config_usuario_id, empresa_id)');
    expect(migrationSql).toContain('REFERENCES public.configuracoes_usuarios (id, empresa_id)');
  });

  it('deriva nome e usuário Auth do cadastro server-side', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.derivar_responsavel_atividade_tenant()');
    expect(migrationSql).toContain('NEW.responsavel_user_id := v_usuario.auth_user_id');
    expect(migrationSql).toContain('NEW.responsavel_nome := v_usuario.nome');
    expect(migrationSql).toContain('BEFORE INSERT ON public.atividades_rotinas');
    expect(migrationSql).toContain('BEFORE INSERT ON public.atividades_tarefas');
  });

  it('aborta se houver vínculo cruzado antes de trocar as constraints', () => {
    const guardPosition = migrationSql.indexOf('Existem responsáveis operacionais vinculados a outro tenant');
    const constraintPosition = migrationSql.indexOf('atividades_rotinas_responsavel_tenant_fkey');
    expect(guardPosition).toBeGreaterThan(0);
    expect(constraintPosition).toBeGreaterThan(guardPosition);
  });

  it('limpa o Auth órfão quando a FK desvincula um responsável excluído', () => {
    expect(migrationSql).toContain("TG_OP = 'UPDATE'");
    expect(migrationSql).toContain('OLD.responsavel_config_usuario_id IS NOT NULL');
    expect(migrationSql).toContain('NEW.responsavel_user_id := NULL');
    expect(migrationSql).toContain('NEW.responsavel_nome := OLD.responsavel_nome');
  });
});
