import { describe, expect, it } from 'vitest';
import rateLimitMigration from '../../../../../supabase/migrations/20260826025500_agrupar_rate_limit_compartilhamento.sql?raw';

describe('document share group rate limit migration', () => {
  it('serializa e contabiliza falhas por grupo e fingerprint', () => {
    expect(rateLimitMigration).toContain(
      "p_share_group_id::text || ':' || p_fingerprint",
    );
    expect(rateLimitMigration).not.toContain(
      'p_share_group_id::text || p_share_row_id::text || p_fingerprint',
    );
    expect(rateLimitMigration).not.toContain(
      'attempts.share_row_id = p_share_row_id',
    );

    const countBlock = rateLimitMigration.slice(
      rateLimitMigration.indexOf('SELECT count(*)::integer'),
      rateLimitMigration.indexOf('IF v_failed_count >= 10'),
    );
    expect(countBlock).toContain('attempts.share_group_id = p_share_group_id');
    expect(countBlock).toContain('attempts.fingerprint = p_fingerprint');
    expect(countBlock).not.toContain('share_row_id');
  });

  it('recria o índice sem fragmentar por documento', () => {
    const indexBlock = rateLimitMigration.slice(
      rateLimitMigration.indexOf('CREATE INDEX document_share_failed_attempts_lookup'),
      rateLimitMigration.indexOf('CREATE OR REPLACE FUNCTION'),
    );
    expect(indexBlock).toContain('share_group_id');
    expect(indexBlock).toContain('fingerprint');
    expect(indexBlock).toContain('attempted_at DESC');
    expect(indexBlock).not.toContain('share_row_id');
  });

  it('preserva o documento solicitado na auditoria e a assinatura da RPC', () => {
    expect(rateLimitMigration).toContain(
      'share_group_id, share_row_id, fingerprint, success',
    );
    expect(rateLimitMigration).toContain('dc.id = p_share_row_id');
    expect(rateLimitMigration).toContain(
      'resolve_public_document_share_access(\n  p_share_group_id uuid,\n  p_share_row_id uuid',
    );
    expect(rateLimitMigration).toContain('TO service_role');
  });

  it('rejeita UUIDs inexistentes antes do lock e sem gravar tentativas', () => {
    const validationStart = rateLimitMigration.indexOf('IF NOT EXISTS (');
    const lockStart = rateLimitMigration.indexOf(
      'PERFORM pg_catalog.pg_advisory_xact_lock',
    );
    const validationBlock = rateLimitMigration.slice(validationStart, lockStart);

    expect(validationStart).toBeGreaterThan(-1);
    expect(validationStart).toBeLessThan(lockStart);
    expect(validationBlock).toContain('dc.id = p_share_row_id');
    expect(validationBlock).toContain('dc.share_group_id = p_share_group_id');
    expect(validationBlock).toContain(
      'RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::timestamptz',
    );
    expect(validationBlock).not.toContain('document_share_access_attempts');
  });
});
