import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260929031513_rotinas_responsaveis_e_exclusao_obrigacoes.sql',
), 'utf8');

describe('reatribuição auditável de rotinas', () => {
  it('transfere somente tarefas abertas e registra os responsáveis anterior e novo', () => {
    expect(migration).toContain("tarefa.status NOT IN ('Concluída', 'Cancelada')");
    expect(migration).toContain("'responsavel_alterado'");
    expect(migration).toContain("'responsavelAnteriorConfigUsuarioId'");
    expect(migration).toContain("'responsavelNovoConfigUsuarioId'");
    expect(migration).toContain('FOR UPDATE');
  });

  it('mantém isolamento por tenant, permissão gerencial e menor privilégio', () => {
    expect(migration).toContain("public.current_user_has_permission(v_empresa_id, 'atividades:manage')");
    expect(migration).toContain('rotina.empresa_id = v_empresa_id');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('FROM PUBLIC, anon');
  });

  it('não repete manualmente a materialização já executada pelo trigger', () => {
    const assignment = migration.match(
      /CREATE OR REPLACE FUNCTION public\.atribuir_responsavel_rotina[\s\S]+?REVOKE ALL ON FUNCTION public\.atribuir_responsavel_rotina/,
    )?.[0] || '';
    expect(assignment).not.toContain('PERFORM app_private.materializar_rotinas_empresa');
  });
});

describe('exclusão segura de obrigações', () => {
  it('remove catálogo e configurações, mas preserva tarefas concluídas', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.excluir_obrigacao_unificada');
    expect(migration).toContain("item.valor ->> 'entregaId' IS DISTINCT FROM v_codigo");
    expect(migration).toContain("tarefa.status NOT IN ('Concluída', 'Cancelada')");
    expect(migration).toContain("'historicoPreservado', true");
  });

  it('restringe exclusão ao tenant e ao gestor de parametrização', () => {
    expect(migration).toContain("public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage')");
    expect(migration).toContain('tipo.empresa_id = v_empresa_id');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.excluir_obrigacao_unificada(uuid)');
  });
});
