import { describe, expect, it } from 'vitest';
import helperSql from '../../../../../supabase/migrations/20260826020400_validar_scaffold_tenant_demonstracao.sql?raw';
import migrationSql from '../../../../../supabase/migrations/20260826020500_remover_tenant_demonstracao_inativo.sql?raw';

const cleanupSql = `${helperSql}\n${migrationSql}`;

describe('remoção fail-closed do tenant legado de demonstração', () => {
  it('bloqueia o alvo e todas as tabelas tenant-aware antes do preflight', () => {
    expect(migrationSql).toContain('LOCK TABLE public.empresas IN SHARE ROW EXCLUSIVE MODE NOWAIT');
    expect(migrationSql).toContain('FOR UPDATE');
    expect(migrationSql).toContain('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT');
    expect(migrationSql).toContain("attribute.attname = 'empresa_id'");
    expect(migrationSql).toContain("reference_constraint.confrelid = 'public.empresas'::regclass");
  });

  it('descobre referências atuais em vez de depender de uma lista operacional incompleta', () => {
    expect(helperSql).toContain('FROM pg_catalog.pg_attribute attribute');
    expect(helperSql).toContain('FROM pg_catalog.pg_constraint reference_constraint');
    expect(helperSql).toContain('empresa_id::text = $1::text');
    expect(helperSql).toContain('FK nao classificada para empresas');
    expect(migrationSql).toContain('listar_referencias_tenant_demonstracao');
  });

  it('valida perfil, usuário Auth e configuração-base sem lógica nula permissiva', () => {
    expect(migrationSql).toContain("v_perfil.nome IS DISTINCT FROM 'João Silva Demonstração'");
    expect(migrationSql).toContain('v_usuario.perfil_id IS DISTINCT FROM v_perfil.id');
    expect(migrationSql).toContain(
      'v_usuario.auth_user_id IS NOT NULL AND v_usuario.auth_user_id IS DISTINCT FROM v_user_id',
    );
    expect(migrationSql).toContain('lower(v_usuario.email) IS DISTINCT FROM lower(v_auth_email)');
    expect(migrationSql).toContain("v_usuario.status IS DISTINCT FROM 'Inativo'");
    expect(migrationSql).toContain('v_config_empresa.logo_url');
  });

  it('aborta se houver arquivos ou segredos externos do tenant', () => {
    expect(migrationSql).toContain("to_regclass('storage.objects')");
    expect(migrationSql).toContain("to_regclass('vault.secrets')");
    expect(migrationSql).toContain('existem objetos no Storage');
    expect(migrationSql).toContain('existem segredos no Vault');
  });

  it('apaga somente o scaffold explícito, confere contagens e não declara cascata', () => {
    expect(migrationSql).toContain('DELETE FROM public.configuracoes_usuarios');
    expect(migrationSql).toContain('DELETE FROM public.configuracoes_marca_dagua');
    expect(migrationSql).toContain('DELETE FROM public.configuracoes_empresa');
    expect(migrationSql).toContain('DELETE FROM public.perfis');
    expect(migrationSql).toContain('DELETE FROM public.atividades_modelos');
    expect(migrationSql).toContain('DELETE FROM public.configuracoes_perfis_acesso');
    expect(migrationSql).toContain('DELETE FROM public.parametrizacao_cnaes');
    expect(migrationSql.match(/GET DIAGNOSTICS v_row_count = ROW_COUNT/g)?.length)
      .toBeGreaterThanOrEqual(15);
    expect(cleanupSql.toUpperCase()).not.toContain('CASCADE');
  });

  it('aceita apenas os manifestos canônicos completos dos scaffolds provisionados', () => {
    expect(helperSql).toContain("'dctfweb-tributos-federais', 'folha-pagamento', 'obras'");
    expect(helperSql).toContain("'administrador', 'cliente', 'financeiro', 'fiscal', 'funcionario'");
    expect(helperSql).toContain("'1412-6/02', '4321-5/00', '4322-3/01', '4520-0/01'");
    expect(helperSql).toContain("'categorias_clientes:cliente_contabil'");
    expect(helperSql).toContain("'Simples Nacional:xml-nfe'");
    expect(helperSql).toContain('bool_and(sistema IS TRUE AND ativo IS TRUE)');
    expect(helperSql).toContain('config_usuario_id IS NOT DISTINCT FROM $3');
  });

  it('exige pós-condição vazia e confirma a única empresa removida', () => {
    expect(migrationSql).toContain('Pos-condicao: nenhuma linha tenant-aware nem FK direta pode permanecer');
    expect(migrationSql).toContain('referencias permaneceram apos a exclusao explicita');
    expect(migrationSql).toContain('RETURNING id INTO v_deleted_id');
    expect(migrationSql).toContain('v_deleted_id IS DISTINCT FROM v_empresa_id');
    expect(migrationSql).toContain(
      'DROP FUNCTION public.validar_scaffolds_tenant_demonstracao(uuid, uuid, uuid)',
    );
  });
});
