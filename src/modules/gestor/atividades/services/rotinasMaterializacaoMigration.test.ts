import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260901040000_materializar_fila_rotinas_horizonte.sql',
), 'utf8');

describe('materialização operacional das rotinas', () => {
  it('mantém uma janela móvel de 31 dias no gatilho, cron e backfill', () => {
    expect(migration).toContain("v_hoje + 31, 'usuario'");
    expect(migration).toContain("v_hoje + 31, 'sistema'");
    expect(migration).toContain('materializar_rotinas_todas_empresas();');
    expect(migration).toContain("'materializar-atividades-operacionais-15min'");
  });

  it('sincroniza ocorrências abertas, inclusive atrasadas, e preserva concluídas', () => {
    const sync = migration.match(
      /-- Reatribuição[\s\S]+?IF v_ator_user_id IS NULL THEN/,
    )?.[0] || '';
    expect(sync).toContain("tarefa.status NOT IN ('Concluída', 'Cancelada')");
    expect(sync).not.toContain('tarefa.vencimento >= v_hoje');
    expect(sync).toContain('responsavel_user_id = NEW.responsavel_user_id');
    expect(sync).toContain('responsavel_config_usuario_id = NEW.responsavel_config_usuario_id');
  });

  it('arquiva ocorrências antigas ao reprogramar ou desativar uma rotina', () => {
    expect(migration).toContain("'Rotina reprogramada; ocorrência futura substituída.'");
    expect(migration).toContain("'Rotina desativada.'");
    expect(migration).toContain("status = 'Cancelada'");
    expect(migration).toContain('ativo = false');
  });

  it('mantém isolamento de tenant e menor privilégio no gatilho privado', () => {
    expect(migration).toContain('tarefa.empresa_id = NEW.empresa_id');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('current_user_has_permission');
  });

  it('lista a equipe inteira só para gestor e o próprio usuário para colaborador', () => {
    expect(migration).toContain("'atividades:manage'");
    expect(migration).toContain("'atividades:view'");
    expect(migration).toContain("'atividades:update-own'");
    expect(migration).toContain('(v_pode_gerenciar OR usuario.auth_user_id = auth.uid())');
    expect(migration).toContain('Sem permissão para listar responsáveis.');
  });
});
