import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260830153601_sincronizar_protocolos_rotinas.sql?raw';

describe('sincronização server-side de protocolos e rotinas', () => {
  it('vincula a rotina ao catálogo do mesmo tenant de forma única', () => {
    expect(migrationSql).toContain('FOREIGN KEY (empresa_id, protocolo_codigo)');
    expect(migrationSql).toContain('REFERENCES public.parametrizacao_protocolos_tipos (empresa_id, codigo)');
    expect(migrationSql).toContain('atividades_rotinas_protocolo_cliente_uidx');
    expect(migrationSql).toContain('(empresa_id, cliente_id, protocolo_codigo)');
  });

  it('aceita recorrências operacionais e limita intervalo personalizado seguro', () => {
    expect(migrationSql).toContain("'diaria', 'semanal', 'quinzenal', 'mensal'");
    expect(migrationSql).toContain("'trimestral', 'semestral', 'personalizada'");
    expect(migrationSql).toContain("item.valor ->> 'periodicidade' IS DISTINCT FROM 'personalizada'");
    expect(migrationSql).toContain("'^[1-9][0-9]{0,2}$'");
    expect(migrationSql).toContain("(item.valor ->> 'intervaloDias')::integer > 366");
    expect(migrationSql).toContain('parametrizacao_prazos_entrega_fechamento_check');
    expect(migrationSql).toContain('parametrizacao_protocolos_tipos_periodicidade_padrao_check');
  });

  it('valida obrigações ativas pelo catálogo e regime, sem travar sugestões inativas legadas', () => {
    const validation = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.validar_configs_protocolos_operacionais'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.validar_catalogo_configuracao_protocolo'),
    );

    expect(validation).toContain('tipo.empresa_id = p_empresa_id');
    expect(validation).toContain("tipo.codigo = btrim(item.valor ->> 'entregaId')");
    expect(validation).toContain("item.valor ->> 'ativo' = 'false'");
    expect(validation).toContain('tipo.ativo = true');
    expect(validation).toContain('v_regime = ANY(tipo.regimes)');
  });

  it('projeta, desativa e materializa rotinas idempotentemente pela RPC', () => {
    const sync = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.sincronizar_rotinas_protocolos_cliente'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );

    expect(sync).toContain('ON CONFLICT (empresa_id, cliente_id, protocolo_codigo)');
    expect(sync).toContain('WHERE protocolo_codigo IS NOT NULL');
    expect(sync).toContain('AND rotina.protocolo_codigo IS NOT NULL');
    expect(sync).toContain('SET ativa = false');
    expect(sync).toContain('INTO v_regime, v_cliente_nome');
    expect(sync).toContain('v_cliente_nome,');
    expect(sync).not.toContain('responsavel_config_usuario_id = EXCLUDED');
  });

  it('atribui responsável somente a uma rotina de protocolo acessível do mesmo tenant', () => {
    const assignment = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );

    expect(assignment).toContain("public.current_user_has_permission(v_empresa_id, 'atividades:manage')");
    expect(assignment).toContain('rotina.protocolo_codigo IS NOT NULL');
    expect(assignment).toContain('public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)');
    expect(assignment).toContain("usuario.status = 'Ativo'");
    expect(assignment).toContain('SET responsavel_config_usuario_id = p_responsavel_config_usuario_id');
    expect(assignment).toContain('REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina_protocolo');
  });

  it('entrega fechamentos agrupados e calculados no servidor a partir das tarefas ativas', () => {
    const closing = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.get_fechamentos_operacionais'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );

    expect(closing).toContain("public.current_user_has_permission(v_empresa_id, 'atividades:view')");
    expect(closing).toContain("public.current_user_has_permission(v_empresa_id, 'atividades:view-own')");
    expect(closing).toContain('tarefa.ativo = true');
    expect(closing).toContain('public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)');
    expect(closing).toContain("'progressoGeral', progresso_geral");
    expect(closing).toContain("'statusGeral', status_geral");
    expect(closing).toContain("'metricas', jsonb_build_object");
    expect(closing).toContain("tarefa.competencia = to_char(clock_timestamp()");
    expect(closing).toContain('REVOKE ALL ON FUNCTION public.get_fechamentos_operacionais');
  });

  it('mantém o único ponto público de escrita e materializa no mesmo fluxo', () => {
    const save = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );

    expect(save).toContain('public.current_user_has_permission(v_empresa_id, \'protocolos:manage\')');
    expect(save).toContain('public.current_user_can_access_client_row(v_empresa_id, p_cliente_id)');
    expect(save).toContain('FOR UPDATE;');
    expect(save).toContain('public.validar_configs_protocolos_operacionais');
    expect(save).toContain('public.sincronizar_rotinas_protocolos_cliente');
    expect(save).toContain('public.materializar_atividades_rotinas');
    expect(save).toContain('REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente');
    expect(save).toContain('GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)');
  });
});
