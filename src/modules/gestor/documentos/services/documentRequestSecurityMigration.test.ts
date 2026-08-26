import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826023000_solicitacoes_documentos_operacionais.sql?raw';
import hardeningSql from '../../../../../supabase/migrations/20260826025200_proteger_administradores_e_retorno_solicitacoes.sql?raw';

describe('segurança das solicitações de documentos', () => {
  it('amarra cliente e solicitação ao mesmo tenant no próprio banco', () => {
    expect(migrationSql).toContain('FOREIGN KEY (empresa_id, cliente_id)');
    expect(migrationSql).toContain('REFERENCES public.clientes (empresa_id, id)');
    expect(migrationSql).toContain('ON DELETE RESTRICT');
    expect(migrationSql).toContain('empresa_id = (SELECT public.current_empresa_id())');
    expect(migrationSql).toContain('public.current_user_can_access_client_row(empresa_id, cliente_id)');
  });

  it('habilita RLS e separa leitura, inclusão e atualização', () => {
    expect(migrationSql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('FOR SELECT');
    expect(migrationSql).toContain('FOR INSERT');
    expect(migrationSql).toContain('FOR UPDATE');
    expect(migrationSql).not.toContain('FOR ALL');
  });

  it('aplica o escopo do cliente A/B em todas as operações da tabela', () => {
    const selectPolicy = hardeningSql.slice(
      hardeningSql.indexOf('CREATE POLICY documentos_solicitacoes_select'),
      hardeningSql.indexOf('DROP POLICY IF EXISTS documentos_solicitacoes_update'),
    );
    const insertPolicy = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY documentos_solicitacoes_insert'),
      migrationSql.indexOf('CREATE POLICY documentos_solicitacoes_update'),
    );
    const updatePolicy = hardeningSql.slice(hardeningSql.indexOf('CREATE POLICY documentos_solicitacoes_update'));

    expect(selectPolicy).toContain('current_user_can_access_client_row(empresa_id, cliente_id)');
    expect(insertPolicy).toContain('current_user_can_access_client_row(empresa_id, cliente_id)');
    expect(updatePolicy.match(/current_user_can_access_client_row\(empresa_id, cliente_id\)/g)).toHaveLength(2);
  });

  it('não concede acesso anônimo nem exclusão pelo cliente web', () => {
    expect(migrationSql).toContain('REVOKE ALL ON TABLE public.documentos_solicitacoes FROM anon, authenticated');
    expect(migrationSql).toContain('GRANT SELECT, INSERT ON TABLE public.documentos_solicitacoes TO authenticated');
    expect(migrationSql).toContain('GRANT UPDATE (status) ON TABLE public.documentos_solicitacoes TO authenticated');
    expect(migrationSql).not.toContain('GRANT DELETE');
    expect(migrationSql).not.toMatch(/TO anon\s*;/);
  });

  it('exige permissões de documentos e protege o autor e o tenant em atualizações', () => {
    expect(migrationSql).toContain("'documentos:view'");
    expect(migrationSql).toContain("'documentos:create'");
    expect(migrationSql).toContain("'documentos:manage'");
    expect(migrationSql).toContain('NEW.empresa_id IS DISTINCT FROM OLD.empresa_id');
    expect(migrationSql).toContain('NEW.cliente_id IS DISTINCT FROM OLD.cliente_id');
    expect(migrationSql).toContain('NEW.criado_por IS DISTINCT FROM OLD.criado_por');
  });

  it('limita create ao próprio autor e mantém manage como acesso de equipe', () => {
    const selectPolicy = hardeningSql.slice(
      hardeningSql.indexOf('CREATE POLICY documentos_solicitacoes_select'),
      hardeningSql.indexOf('DROP POLICY IF EXISTS documentos_solicitacoes_update'),
    );
    const updatePolicy = hardeningSql.slice(hardeningSql.indexOf('CREATE POLICY documentos_solicitacoes_update'));

    expect(selectPolicy).toContain('criado_por = (SELECT auth.uid())');
    expect(selectPolicy).toContain("current_user_has_permission(empresa_id, 'documentos:create')");
    expect(updatePolicy).toContain("current_user_has_permission(empresa_id, 'documentos:create')");
    expect(updatePolicy).toContain("current_user_has_permission(empresa_id, 'documentos:manage')");
    expect(updatePolicy.match(/criado_por = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(2);
    expect(updatePolicy).not.toContain("'documentos:view'");
  });

  it('permite RETURNING da linha própria sem liberar leitura geral para create', () => {
    const selectPolicy = hardeningSql.slice(
      hardeningSql.indexOf('CREATE POLICY documentos_solicitacoes_select'),
      hardeningSql.indexOf('DROP POLICY IF EXISTS documentos_solicitacoes_update'),
    );
    const ownRead = selectPolicy.indexOf('criado_por = (SELECT auth.uid())');
    const createPermission = selectPolicy.indexOf(
      "current_user_has_permission(empresa_id, 'documentos:create')",
    );

    expect(ownRead).toBeGreaterThan(0);
    expect(createPermission).toBeGreaterThan(ownRead);
    expect(hardeningSql).toContain('create le apenas as linhas do proprio autor');
  });

  it('força estado inicial e auditoria no servidor antes da policy', () => {
    expect(migrationSql).toContain("IF TG_OP = 'INSERT'");
    expect(migrationSql).toContain("NEW.status := 'Pendente'");
    expect(migrationSql).toContain('NEW.criado_por := (SELECT auth.uid())');
    expect(migrationSql).toContain('NEW.created_at := now()');
    expect(migrationSql).toContain('BEFORE INSERT OR UPDATE');
    expect(migrationSql).toContain("AND status = 'Pendente'");
    expect(migrationSql).toContain('Usuários autorizados podem corrigir o status retroativamente');
  });

  it('expõe somente identificação mínima de clientes permitidos ao módulo', () => {
    expect(migrationSql).toContain('public.listar_clientes_solicitacoes_documentos()');
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain('SET search_path = \'\'');
    expect(migrationSql).toContain('public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)');
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.listar_clientes_solicitacoes_documentos() FROM PUBLIC');
  });
});
