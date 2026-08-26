import { describe, expect, it } from 'vitest';
import advisorExpand from '../../supabase/migrations/20260826181600_corrigir_advisors_expand_operacional.sql?raw';
import canonicalLockdown from '../../supabase/migrations/20260826182500_lockdown_fluxo_operacional_canonico.sql?raw';
import consolidatedLockdown from '../../supabase/migrations/20260826182600_consolidar_lockdown_operacional.sql?raw';
import deniedLegacyInstances from '../../supabase/migrations/20260826182700_negar_instancias_legadas_explicito.sql?raw';

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

  it('remove policies legadas de escrita e otimiza a leitura documental', () => {
    expect(consolidatedLockdown).toContain(
      'DROP POLICY IF EXISTS atividades_tarefas_insert_scope',
    );
    expect(consolidatedLockdown).toContain(
      'DROP POLICY IF EXISTS atividades_tarefas_update_scope',
    );
    expect(consolidatedLockdown).toContain(
      'DROP POLICY IF EXISTS atividades_tarefas_delete_manager',
    );
    expect(consolidatedLockdown).toContain(
      'DROP POLICY IF EXISTS atividades_instancias_select_scope',
    );
    expect(consolidatedLockdown).toContain(
      'CREATE POLICY documentos_solicitacoes_select',
    );
    const withoutInitPlans = consolidatedLockdown.replaceAll('(SELECT auth.uid())', '');
    expect(withoutInitPlans).not.toContain('auth.uid()');
  });

  it('mantém a projeção legada explicitamente fail-closed', () => {
    expect(deniedLegacyInstances).toContain(
      'CREATE POLICY atividades_instancias_legacy_denied',
    );
    expect(deniedLegacyInstances).toContain('AS RESTRICTIVE');
    expect(deniedLegacyInstances).toContain('USING (false)');
    expect(deniedLegacyInstances).toContain('WITH CHECK (false)');
  });
});
