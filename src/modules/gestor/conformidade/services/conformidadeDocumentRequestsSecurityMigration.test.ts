import { describe, expect, it } from 'vitest';
import baseMigrationSql from '../../../../../supabase/migrations/20260826015719_endurecer_protocolos_conformidade_integridade.sql?raw';
import integrationMigrationSql from '../../../../../supabase/migrations/20260826024800_integrar_conformidade_protocolos_tenant.sql?raw';

describe('integração segura entre solicitações documentais e Conformidade', () => {
  it('remove a lista documental vazia presumida da projeção de atividades', () => {
    expect(baseMigrationSql).not.toContain("'documentosPendentes', '[]'::jsonb");
    expect(integrationMigrationSql).toContain('public.get_solicitacoes_documentos_conformidade');
    expect(integrationMigrationSql).toContain("solicitacao.status <> 'Concluído'");
  });

  it('consulta somente o tenant e os clientes acessíveis ao usuário', () => {
    const functionSql = integrationMigrationSql.slice(
      integrationMigrationSql.indexOf('CREATE OR REPLACE FUNCTION public.get_solicitacoes_documentos_conformidade'),
    );

    expect(functionSql).toContain('solicitacao.empresa_id = v_empresa_id');
    expect(functionSql).toContain('cliente.empresa_id = solicitacao.empresa_id');
    expect(functionSql).toContain('public.current_user_can_access_client_row(');
    expect(functionSql).toContain("current_user_has_permission(v_empresa_id, 'conformidade:view')");
    expect(functionSql).toContain("current_user_has_permission(v_empresa_id, 'documentos:view')");
    expect(functionSql).toContain("current_user_has_permission(v_empresa_id, 'documentos:manage')");
  });

  it('distingue ausência de autorização de uma lista real sem pendências', () => {
    expect(integrationMigrationSql).toContain("'podeVer', false, 'solicitacoes', NULL");
    expect(integrationMigrationSql).toContain("'podeVer', true, 'solicitacoes', v_solicitacoes");
  });

  it('fecha execução anônima e publica mudanças documentais para invalidação do painel', () => {
    expect(integrationMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.get_solicitacoes_documentos_conformidade(uuid)',
    );
    expect(integrationMigrationSql).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(integrationMigrationSql).toContain('TO authenticated;');
    expect(integrationMigrationSql).toContain('ADD TABLE public.documentos_solicitacoes');
  });
});
