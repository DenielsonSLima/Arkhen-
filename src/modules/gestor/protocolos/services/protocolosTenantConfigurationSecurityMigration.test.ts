import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826024800_integrar_conformidade_protocolos_tenant.sql?raw';

describe('segurança tenant das configurações de Protocolos', () => {
  it('aborta diante de vínculo legado divergente e cria FK composta restritiva', () => {
    expect(migrationSql).toContain('LEFT JOIN public.clientes cliente');
    expect(migrationSql).toContain('cliente.empresa_id = configuracao.empresa_id');
    expect(migrationSql).toContain('cliente.id = configuracao.cliente_id');
    expect(migrationSql).toContain('migration abortada');
    expect(migrationSql).toContain('FOREIGN KEY (empresa_id, cliente_id)');
    expect(migrationSql).toContain('REFERENCES public.clientes (empresa_id, id)');
    expect(migrationSql).toContain('ON DELETE RESTRICT');
  });

  it('deriva o tenant no servidor e torna identidade/cliente imutáveis', () => {
    const triggerSql = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.proteger_configuracao_protocolo_tenant'),
      migrationSql.indexOf('ALTER TABLE public.configuracoes_protocolos_empresas ENABLE ROW LEVEL SECURITY'),
    );

    expect(triggerSql).toContain('NEW.empresa_id := v_empresa_id');
    expect(triggerSql).toContain('NEW.empresa_id IS DISTINCT FROM OLD.empresa_id');
    expect(triggerSql).toContain('NEW.cliente_id IS DISTINCT FROM OLD.cliente_id');
    expect(triggerSql).toContain('NEW.created_at IS DISTINCT FROM OLD.created_at');
    expect(triggerSql).toContain('current_user_can_access_client_row(cliente.empresa_id, cliente.id)');
  });

  it('aplica tenant, escopo do cliente e manage nas policies de escrita', () => {
    const policySql = migrationSql.slice(
      migrationSql.indexOf('CREATE POLICY configuracoes_protocolos_empresas_select'),
      migrationSql.indexOf('-- A escrita passa por uma RPC pequena'),
    );

    expect(policySql.match(/empresa_id = \(SELECT public\.current_empresa_id\(\)\)/g)).toHaveLength(5);
    expect(policySql.match(/current_user_can_access_client_row\(empresa_id, cliente_id\)/g)).toHaveLength(5);
    expect(policySql).toContain("current_user_has_permission(empresa_id, 'protocolos:manage')");
  });

  it('deixa a tabela somente leitura e concentra escrita na RPC validada', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON TABLE public.configuracoes_protocolos_empresas',
    );
    expect(migrationSql).toContain(
      'GRANT SELECT ON TABLE public.configuracoes_protocolos_empresas TO authenticated',
    );
    expect(migrationSql).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE).*configuracoes_protocolos_empresas/i);
    expect(migrationSql).toContain('public.salvar_configuracoes_protocolos_cliente');
    expect(migrationSql).toContain("jsonb_typeof(p_configs) IS DISTINCT FROM 'array'");
    expect(migrationSql).toContain("chave NOT IN ('entregaId', 'ativo', 'periodicidade')");
    expect(migrationSql).toContain('ON CONFLICT (empresa_id, cliente_id) DO UPDATE');
  });
});
