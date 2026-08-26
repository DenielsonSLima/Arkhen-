import { describe, expect, it } from 'vitest';
import advisorExpand from '../../supabase/migrations/20260826181600_corrigir_advisors_expand_operacional.sql?raw';
import canonicalLockdown from '../../supabase/migrations/20260826182500_lockdown_fluxo_operacional_canonico.sql?raw';

const EXPECTED_FK_INDEXES = [
  'atividades_tarefas_revisor_user_fk_idx',
  'atividades_tarefas_conclusao_solicitada_user_fk_idx',
  'atividades_tarefas_revisado_user_fk_idx',
  'atividades_tarefas_concluido_user_fk_idx',
  'atividades_tarefas_modelo_tenant_fk_idx',
  'atividades_tarefa_eventos_ator_user_fk_idx',
  'atividades_tarefa_eventos_tarefa_tenant_fk_idx',
  'atividades_fechamentos_finalizado_user_fk_idx',
  'atividades_fechamentos_reaberto_user_fk_idx',
  'atividades_fechamento_eventos_ator_user_fk_idx',
  'atividades_fechamento_eventos_fechamento_tenant_fk_idx',
  'atividades_fechamento_eventos_cliente_tenant_fk_idx',
  'documentos_solicitacoes_recebido_user_fk_idx',
  'documentos_solicitacoes_revisado_user_fk_idx',
  'documentos_solicitacoes_concluido_user_fk_idx',
  'documentos_solicitacoes_cancelado_user_fk_idx',
  'documentos_solicitacoes_responsavel_tenant_fk_idx',
  'documentos_solicitacoes_revisor_tenant_fk_idx',
  'documentos_solicitacoes_tarefa_tenant_fk_idx',
  'documentos_solicitacoes_documento_tenant_fk_idx',
] as const;

describe('operational EXPAND advisor corrections', () => {
  it('indexa exatamente as vinte FKs adicionadas pelo lote', () => {
    expect(EXPECTED_FK_INDEXES).toHaveLength(20);
    EXPECTED_FK_INDEXES.forEach((indexName) => {
      expect(advisorExpand).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
    });
  });

  it('remove somente o índice duplicado e preserva a FK documental', () => {
    expect(advisorExpand).toContain('DROP INDEX IF EXISTS public.documentos_id_empresa_uidx');
    expect(advisorExpand).not.toContain('DROP INDEX IF EXISTS public.documentos_id_empresa_unique');
    expect(advisorExpand).toContain(
      'DROP CONSTRAINT IF EXISTS documentos_solicitacoes_documento_tenant_fkey',
    );
    expect(advisorExpand).toContain(
      'ADD CONSTRAINT documentos_solicitacoes_documento_tenant_fkey',
    );
  });

  it('usa initplan para auth.uid nas policies EXPAND e LOCKDOWN', () => {
    expect(advisorExpand).toContain('(SELECT auth.uid())');
    const expandWithoutInitPlans = advisorExpand.replaceAll('(SELECT auth.uid())', '');
    const lockdownWithoutInitPlans = canonicalLockdown.replaceAll('(SELECT auth.uid())', '');
    expect(expandWithoutInitPlans).not.toContain('auth.uid()');
    expect(lockdownWithoutInitPlans).not.toContain('auth.uid()');
  });
});
