import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  'supabase/migrations/20260831013000_centralizar_protocolos_e_inicio.sql',
  'utf8',
);

describe('contrato servidor de protocolos e onboarding', () => {
  it('deriva catálogo, configuração e status no tenant autenticado', () => {
    expect(migrationSql).toContain('obter_configuracao_protocolos_cliente');
    expect(migrationSql).toContain('obter_status_configuracao_inicio');
    expect(migrationSql).toContain('public.current_empresa_id()');
    expect(migrationSql).toContain('v_regime = ANY(tipo.regimes)');
    expect(migrationSql).toContain('public.current_user_can_access_client_row');
    expect(migrationSql).toContain('public.current_user_access_allowed');
    expect(migrationSql).toContain("'atividades:view-own'");
    expect(migrationSql).toContain("'usuarios:manage'");
  });

  it('salva sem materializar e exige usuário realmente vinculado na atribuição', () => {
    const saveStart = migrationSql.indexOf(
      'CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente',
    );
    const policiesStart = migrationSql.indexOf(
      'DROP POLICY IF EXISTS atividades_rotinas_insert_manager',
    );
    const saveFunction = migrationSql.slice(saveStart, policiesStart);

    expect(saveFunction).toContain('sincronizar_rotinas_protocolos_cliente');
    expect(saveFunction).not.toContain('materializar_atividades_rotinas');
    expect(saveFunction).toContain("cliente.status = 'Ativa'");
    expect(migrationSql).toContain('usuario.auth_user_id IS NOT NULL');
    expect(migrationSql).toContain('proxima_execucao = greatest');
  });

  it('arquiva pendências desativadas e protege rotinas geradas pelo sistema', () => {
    expect(migrationSql).toContain("tarefa.status <> 'Concluída'");
    expect(migrationSql).toContain("'arquivada'");
    expect(migrationSql).toContain('protocolo_codigo IS NULL');
    expect(migrationSql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
    expect(migrationSql).toContain("pg_publication WHERE pubname = 'supabase_realtime'");
  });
});
