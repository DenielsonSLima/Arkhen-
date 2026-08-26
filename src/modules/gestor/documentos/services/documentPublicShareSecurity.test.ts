import { beforeEach, describe, expect, it, vi } from 'vitest';
import shareMigration from '../../../../../supabase/migrations/20260826024500_endurecer_compartilhamentos_publicos.sql?raw';
import storageMigration from '../../../../../supabase/migrations/20260826024700_restringir_storage_e_mutacoes_share.sql?raw';
import cleanupMigration from '../../../../../supabase/migrations/20260826024900_limpar_tentativas_share_expiradas.sql?raw';
import groupMigration from '../../../../../supabase/migrations/20260826025000_consistencia_grupos_compartilhamento.sql?raw';
import edgeSource from '../../../../../supabase/functions/get-shared-document-url/index.ts?raw';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke },
  },
}));

import { createDocumentAccessUrl } from '../../../public/shared/publicSharedDocumentHelpers';

describe('compartilhamento público de documentos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('amarra o documento ao tenant por FK composta e trigger', () => {
    expect(shareMigration).toContain('FOREIGN KEY (documento_id, empresa_id)');
    expect(shareMigration).toContain('REFERENCES public.documentos (id, empresa_id)');
    expect(shareMigration).toContain('enforce_document_share_integrity_trigger');
    expect(shareMigration).toContain("'documentos:manage'");
    expect(shareMigration).toContain('public.current_user_can_access_client_row');
  });

  it('impõe senha e prazo no servidor, não apenas na interface', () => {
    expect(shareMigration).toContain('document_share_duration_minutes');
    expect(shareMigration).toContain('v_exigir_senha');
    expect(shareMigration).toContain('v_prazos_exigem_senha');
    expect(shareMigration).toContain('NEW.expires_at := now() + make_interval');
    expect(shareMigration).toContain("NEW.senha_hash !~ '^[0-9a-f]{64}$'");
    expect(groupMigration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(groupMigration).toContain('peer.senha_hash IS DISTINCT FROM NEW.senha_hash');
  });

  it('não entrega bucket ou caminho ao papel anônimo', () => {
    const publicMetadataFunction = shareMigration.slice(
      shareMigration.indexOf('CREATE FUNCTION public.get_public_document_share'),
      shareMigration.indexOf('CREATE TABLE IF NOT EXISTS public.document_share_access_attempts'),
    );
    expect(publicMetadataFunction).toContain('NULL::text');
    expect(publicMetadataFunction).not.toContain('d.storage_bucket');
    expect(publicMetadataFunction).not.toContain('d.storage_path');
    expect(shareMigration).toContain('TO service_role');
    expect(shareMigration).toContain('FROM PUBLIC, anon, authenticated');
  });

  it('remove leitura pública direta e restringe objetos ao cliente autorizado', () => {
    expect(shareMigration).toContain(
      'DROP POLICY IF EXISTS documentos_storage_select_shared_policy ON storage.objects',
    );
    expect(storageMigration).toContain('public.current_user_can_access_client_row(c.empresa_id, c.id)');
    expect(storageMigration).toContain('DROP POLICY IF EXISTS documentos_storage_update_policy');
    expect(storageMigration).not.toContain('CREATE POLICY documentos_storage_update_policy');
  });

  it('usa a Edge autorizadora para obter uma URL curta', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, signedUrl: 'https://storage.test/assinada' },
      error: null,
    });

    const result = await createDocumentAccessUrl(
      { id: 'linha-share', documento: 'balanco.pdf', storage_bucket: null, storage_path: null },
      'grupo-share',
      'hash-seguro',
    );

    expect(result).toBe('https://storage.test/assinada');
    expect(invoke).toHaveBeenCalledWith('get-shared-document-url', {
      body: {
        shareGroupId: 'grupo-share',
        shareRowId: 'linha-share',
        passwordHash: 'hash-seguro',
      },
    });
  });

  it('limita tentativas e mantém a service role somente na função remota', () => {
    expect(shareMigration).toContain('v_failed_count >= 10');
    expect(shareMigration).toContain("interval '15 minutes'");
    expect(edgeSource).toContain('MAX_SIGNED_URL_SECONDS = 300');
    expect(edgeSource).toContain('resolve_public_document_share_access');
    expect(edgeSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY")!');
    expect(cleanupMigration).toContain("attempted_at < now() - interval '24 hours'");
  });
});
