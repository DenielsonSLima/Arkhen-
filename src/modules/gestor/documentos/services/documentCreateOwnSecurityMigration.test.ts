import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826121825_alinhar_upload_documentos_cliente.sql?raw';

describe('documentos:create-own policies', () => {
  it('opens the restrictive barrier only for the authenticated owner and assigned client', () => {
    const restrictiveInsert = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY isolamento_cliente_insert'),
      migrationSql.indexOf('DROP POLICY IF EXISTS isolamento_cliente_select'),
    );
    const restrictiveSelect = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY isolamento_cliente_select'),
      migrationSql.indexOf('DROP POLICY IF EXISTS documentos_insert_permission'),
    );

    expect(restrictiveInsert).toContain('AS RESTRICTIVE');
    expect(restrictiveInsert).toContain('owner_user_id = (SELECT auth.uid())');
    expect(restrictiveInsert).toContain("'documentos:create-own'");
    expect(restrictiveInsert).toContain('public.documento_cliente_acessivel');
    expect(restrictiveSelect).toContain("'documentos:view-own'");
    expect(restrictiveSelect).toContain("'documentos:create-own'");
    expect(restrictiveSelect).toContain('owner_user_id = (SELECT auth.uid())');
  });

  it('limits metadata writes to the active tenant, owner and assigned client', () => {
    const insertPolicy = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY documentos_insert_permission'),
      migrationSql.indexOf('DROP POLICY IF EXISTS documentos_select_permission'),
    );

    expect(insertPolicy).toContain('empresa_id = (SELECT public.current_empresa_id())');
    expect(insertPolicy).toContain('owner_user_id = (SELECT auth.uid())');
    expect(insertPolicy).toContain("'documentos:create-own'");
    expect(insertPolicy).toContain("scope = 'empresa'");
    expect(insertPolicy).toContain('public.current_user_is_client_scoped(empresa_id)');
    expect(insertPolicy).toContain('public.documento_cliente_acessivel(empresa_id, cliente_id)');
    expect(insertPolicy).toContain('public.documento_storage_cadastro_consistente(');
  });

  it('keeps client uploads inside their tenant storage prefix and client scope', () => {
    const storageInsertPolicy = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY documentos_storage_insert_policy'),
      migrationSql.indexOf('DROP POLICY IF EXISTS documentos_storage_delete_policy'),
    );

    expect(storageInsertPolicy).toContain("bucket_id = 'documentos'");
    expect(storageInsertPolicy).toContain('owner = (SELECT auth.uid())');
    expect(storageInsertPolicy).toContain(
      "(storage.foldername(name))[1] = public.current_empresa_id()::text",
    );
    expect(storageInsertPolicy).toContain("'documentos:create-own'");
    const createOwnBranch = storageInsertPolicy.slice(
      storageInsertPolicy.lastIndexOf("'documentos:create-own'"),
    );
    expect(createOwnBranch).toContain("(storage.foldername(name))[2] = 'clientes'");
    expect(createOwnBranch).not.toContain("(storage.foldername(name))[2] = 'pessoal'");
    expect(createOwnBranch).toContain('public.documento_cliente_acessivel(');
  });

  it('allows creators to read only their own stored document within the same scope', () => {
    const storageSelectPolicy = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY documentos_storage_select_policy'),
      migrationSql.indexOf('DROP POLICY IF EXISTS documentos_storage_insert_policy'),
    );

    expect(storageSelectPolicy).toContain("'documentos:create'");
    expect(storageSelectPolicy).toContain("'documentos:create-own'");
    expect(storageSelectPolicy).toContain('documento.owner_user_id = (SELECT auth.uid())');
    expect(storageSelectPolicy).toContain('public.documento_cliente_acessivel(');
    expect(storageSelectPolicy).toContain('documento.empresa_id');
  });

  it('bypasses client-table RLS without bypassing tenant and client assignment checks', () => {
    const helper = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.documento_cliente_acessivel'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.documento_storage_cadastro_consistente'),
    );

    expect(helper).toContain('SECURITY DEFINER');
    expect(helper).toContain("SET search_path = ''");
    expect(helper).toContain('p_empresa_id = (SELECT public.current_empresa_id())');
    expect(helper).toContain('public.documento_cliente_belongs_to_empresa');
    expect(helper).toContain('public.current_user_can_access_client_row');
    expect(migrationSql).not.toContain('FROM public.clientes cliente');
  });

  it('binds metadata to the uploaded object and permits safe orphan cleanup', () => {
    const helper = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.documento_storage_cadastro_consistente'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.documento_storage_objeto_orfao'),
    );
    const orphanHelper = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.documento_storage_objeto_orfao'),
      migrationSql.indexOf('-- As policies restritivas'),
    );
    const deletePolicy = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY documentos_storage_delete_policy'),
      migrationSql.indexOf('COMMIT;'),
    );

    expect(helper).toContain("p_storage_bucket = 'documentos'");
    expect(helper).toContain('(storage.foldername(p_storage_path))[1] = p_empresa_id::text');
    expect(helper).toContain('objeto.owner = (SELECT auth.uid())');
    expect(orphanHelper).toContain('SECURITY DEFINER');
    expect(orphanHelper).toContain('AND NOT EXISTS (');
    expect(orphanHelper).toContain('FROM public.documentos documento');
    expect(deletePolicy).toContain('owner = (SELECT auth.uid())');
    expect(deletePolicy).toContain(
      'public.documento_storage_objeto_orfao(bucket_id, name, owner)',
    );
    expect(deletePolicy).toContain("documento.scope = 'pessoal'");
    expect(deletePolicy).toContain("'documentos:manage'");
    expect(deletePolicy).toContain(
      '(storage.foldername(name))[1] = public.current_empresa_id()::text',
    );
  });
});
