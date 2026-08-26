import { describe, expect, it } from 'vitest';
import accessRbacMigration from '../../supabase/migrations/20260826024600_endurecer_rbac_janelas_acesso.sql?raw';
import advisorFixMigration from '../../supabase/migrations/20260826025100_corrigir_advisors_lote_operacional.sql?raw';

describe('operational batch advisor fixes', () => {
  it('revoga execução direta das funções usadas apenas por triggers', () => {
    expect(advisorFixMigration).toContain('enforce_document_share_integrity()');
    expect(advisorFixMigration).toContain('enforce_membership_privilege_integrity()');
    expect(advisorFixMigration).toContain('enforce_user_configuration_privilege_integrity()');
    expect(advisorFixMigration).toContain('FROM PUBLIC, anon, authenticated');
  });

  it('indexa todas as FKs novas sem remover a unicidade de identidade por tenant', () => {
    expect(accessRbacMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_empresa_auth_unique',
    );
    expect(advisorFixMigration).not.toContain(
      'DROP INDEX IF EXISTS public.configuracoes_usuarios_empresa_auth_unique',
    );
    expect(advisorFixMigration).toContain('configuracoes_usuarios_membership_tenant_idx');
    expect(advisorFixMigration).toContain('documentos_compartilhamentos_documento_empresa_idx');
    expect(advisorFixMigration).toContain('documentos_solicitacoes_criado_por_idx');
    expect(advisorFixMigration).toContain('documentos_solicitacoes_atualizado_por_idx');
    expect(advisorFixMigration).toContain('protocolos_entregas_concluido_por_user_idx');
  });

  it('nega acesso direto às tentativas e otimiza auth.uid nas policies', () => {
    expect(advisorFixMigration).toContain('document_share_access_attempts_deny_client');
    expect(advisorFixMigration).toContain('FOR ALL TO anon, authenticated');
    expect(advisorFixMigration).toContain('USING (false)');
    expect(advisorFixMigration).toContain('(SELECT auth.uid())');

    [
      'documentos_compartilhamentos_update_manager',
      'documentos_compartilhamentos_delete_manager',
      'documentos_storage_select_policy',
      'documentos_storage_insert_policy',
      'documentos_storage_delete_policy',
    ].forEach((policyName) => {
      expect(advisorFixMigration).toContain(`CREATE POLICY ${policyName}`);
    });

    const authUidCallsOutsideInitPlan = advisorFixMigration
      .replaceAll('(SELECT auth.uid())', '')
      .match(/auth\.uid\(\)/g);
    expect(authUidCallsOutsideInitPlan).toBeNull();
  });
});
