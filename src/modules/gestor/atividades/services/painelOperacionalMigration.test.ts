import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260904050500_consolidar_painel_operacional_sem_conformidade.sql',
), 'utf8');
const cleanupMigration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260904050530_finalizar_desativacao_conformidade_realtime.sql',
), 'utf8');

describe('consolidação do painel operacional', () => {
  it('calcula métricas e risco no PostgreSQL com escopo de tenant', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.obter_painel_operacional');
    expect(migration).toContain('tarefa.empresa_id = v_empresa_id');
    expect(migration).toContain('current_user_can_access_client_row');
    expect(migration).toContain("'atividades:manage'");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('SET row_security = on');
  });

  it('usa a conclusão real para calcular a taxa de entrega no prazo', () => {
    expect(migration).toContain(
      'coalesce(tarefa.concluido_em, tarefa.data_hora_conclusao) AS concluida_em',
    );
    expect(migration).toContain('concluida_em::date <= prazo_legal');
  });

  it('remove Conformidade do catálogo sem apagar o histórico', () => {
    expect(migration).toContain(
      "array_remove(permissoes, 'conformidade:view')",
    );
    expect(migration).toContain(
      "DELETE FROM public.configuracoes_modulos_sistema WHERE modulo = 'conformidade'",
    );
    expect(cleanupMigration).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE',
    );
    expect(migration).not.toContain('DROP TABLE public.conformidade_obrigacoes');
  });

  it('revoga a leitura legada e mantém o relatório independente intacto', () => {
    expect(cleanupMigration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_conformidade_operacional(uuid)',
    );
    expect(cleanupMigration).not.toContain('get_relatorio_conformidade_json');
    expect(cleanupMigration).toContain(
      'DROP TABLE public.conformidade_obrigacoes',
    );
    expect(cleanupMigration).toContain(
      'ADD TABLE public.atividades_tarefas',
    );
  });
});
