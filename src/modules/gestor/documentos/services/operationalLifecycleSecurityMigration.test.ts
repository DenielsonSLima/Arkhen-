import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(
  new URL(`../../../../../supabase/migrations/${name}`, import.meta.url),
  'utf8',
);

const documentExpand = migration('20260826180000_expandir_solicitacoes_documentos_lifecycle.sql');
const documentMutations = migration('20260826180100_expandir_mutacoes_solicitacoes_documentos.sql');
const conformidade = migration('20260826180500_integrar_solicitacoes_documentos_conformidade.sql');
const protocoloExpand = migration('20260826181000_expandir_protocolos_auditoria.sql');
const clientScope = migration('20260826181500_endurecer_escopo_cliente_fail_closed.sql');
const lockdown = migration('20260826182000_bloquear_mutacoes_legadas_operacionais.sql');
const protocoloLegado = migration('20260826015719_endurecer_protocolos_conformidade_integridade.sql');

describe('lifecycle operacional auditável', () => {
  it('expande o schema legado de documentos e preserva competência date', () => {
    expect(documentExpand).toContain('ALTER TABLE public.documentos_solicitacoes');
    expect(documentExpand).not.toContain('CREATE TABLE IF NOT EXISTS public.documentos_solicitacoes');
    expect(documentExpand).toContain('responsavel_config_usuario_id uuid');
    expect(documentExpand).toContain('revisor_config_usuario_id uuid');
    expect(documentExpand).toContain('tarefa_id uuid');
    expect(documentExpand).toContain("to_char(NEW.competencia, 'YYYY-MM')");
  });

  it('executa o backfill legado uma única vez sem rebaixar status avançado', () => {
    expect(documentExpand).toContain("column_name = 'auditoria_pendente'");
    expect(documentExpand).toMatch(
      /IF NOT EXISTS \([\s\S]*?column_name = 'auditoria_pendente'[\s\S]*?ALTER TABLE public\.documentos_solicitacoes[\s\S]*?ADD COLUMN auditoria_pendente[\s\S]*?UPDATE public\.documentos_solicitacoes[\s\S]*?WHERE status = 'Pendente'[\s\S]*?END IF;/,
    );
    expect(documentExpand).not.toContain("OR status <> 'Pendente'");
    expect(documentExpand).not.toMatch(
      /UPDATE public\.documentos_solicitacoes[\s\S]*?WHERE[\s\S]*?status <> 'Pendente'/,
    );
  });

  it('mantém histórico append-only vinculado ao ator e horário do servidor', () => {
    expect(documentExpand).toContain('jsonb_array_length(OLD.historico) + 1');
    expect(documentExpand).toContain("->> 'actorUserId' IS DISTINCT FROM auth.uid()::text");
    expect(documentExpand).toContain("->> 'occurredAt'");
    expect(documentExpand).toContain('CREATE TRIGGER proteger_auditoria_documento_solicitacao');
    expect(documentMutations).toContain("'occurredAt', v_agora::text");
    expect(documentMutations).toContain("'actorUserId', auth.uid()::text");
    expect(documentMutations).toContain("v_manage := coalesce(");
    expect(documentExpand).toContain("'atividades:update-own'");
    expect(documentExpand).toContain('t.responsavel_user_id = auth.uid()');
    expect(documentExpand).toContain('v_documentos_create AND d.owner_user_id = auth.uid()');
    expect(documentMutations).toContain('tarefa.responsavel_user_id = auth.uid()');
  });

  it('exige revisor na conclusão quando configurado e limpa prova atual ao reabrir', () => {
    expect(documentMutations).toContain("coalesce(v_revisor_auth, v_responsavel_auth) = auth.uid()");
    expect(documentMutations).toContain("v_row.status = 'Em conferência'");
    expect(documentMutations).toContain("evidencia_texto = CASE WHEN p_status = 'Pendente' THEN NULL");
    expect(documentMutations).toContain("documento_id = CASE WHEN p_status = 'Pendente' THEN NULL");
    expect(documentMutations).toContain("concluido_em = CASE WHEN p_status = 'Concluído' THEN v_agora WHEN p_status = 'Pendente' THEN NULL");
  });

  it('enriquece somente a projeção canônica de tarefas com competência explícita', () => {
    expect(conformidade).toContain('get_conformidade_operacional_tarefas_base');
    expect(conformidade).toContain('p_competencia varchar DEFAULT NULL');
    expect(conformidade).not.toContain('get_resumo_conformidade(');
    expect(conformidade).toContain("s.status NOT IN ('Concluído', 'Cancelado')");
    expect(conformidade).toContain('public.current_user_can_access_client_row');
    expect(conformidade).toContain("'atividades:view-own'");
    expect(conformidade).toContain("v_pode_gerenciar_atividades := coalesce(");
    expect(conformidade).toContain("'atividades:update-own'");
    expect(conformidade).toContain('tarefa_permitida.responsavel_user_id = auth.uid()');
    expect(conformidade).toContain('tarefa_permitida.revisor_user_id = auth.uid()');
    expect(conformidade).toContain('v_pode_ver_clientes_atividades');
    expect(conformidade).toContain('AND tarefa_permitida.cliente_id IS NOT NULL');
    expect(conformidade).toContain('public.current_user_has_client_access(');
    expect(conformidade).toContain('(p_cliente_id IS NULL OR s.cliente_id = p_cliente_id)');
  });

  it('mantém perfis client-scoped mesmo após desativar o último vínculo', () => {
    expect(clientScope).toContain('CREATE OR REPLACE FUNCTION public.current_user_is_client_scoped');
    expect(clientScope).toContain("'cliente-portal:view' = ANY");
    expect(clientScope).toContain("lower(coalesce(perfil.codigo, '')) IN (");
    expect(clientScope).toContain("lower(perfil.nome) = lower(coalesce(usuario.perfil, ''))");
    expect(clientScope).toContain("IN ('cliente', 'cliente externo')");
    expect(clientScope).toContain("lower(coalesce(membership.papel, '')) = 'cliente'");
    expect(clientScope).not.toContain("LIKE '%:view-own'");
    expect(clientScope).not.toContain('unnest(coalesce(perfil.permissoes');
    expect(clientScope).not.toContain("acesso.status = 'Ativo'");
    expect(clientScope).not.toContain("usuario.status = 'Ativo'");
    expect(clientScope).not.toContain('perfil.ativo = true');
  });

  it('preserva validações canônicas do protocolo e separa create de manage', () => {
    expect(protocoloExpand).toContain('public.atualizar_protocolo_entrega(p_payload)');
    expect(protocoloExpand).toContain('v_existe AND NOT v_manage');
    expect(protocoloExpand).toContain("NOT v_existe AND v_status = 'Concluído' AND NOT v_manage");
    expect(protocoloExpand).toContain('v_status = v_status_atual');
    expect(protocoloExpand).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(protocoloExpand).toMatch(
      /pg_catalog\.pg_advisory_xact_lock[\s\S]*?SELECT protocolo\.status INTO v_status_atual[\s\S]*?FOR UPDATE;[\s\S]*?v_existe := FOUND;/,
    );
    expect(protocoloExpand).toContain("'podeAlterarStatus', v_manage");
    expect(protocoloExpand).toContain("'podeAnotar', v_manage OR (v_create AND salvo.id IS NULL)");
    expect(protocoloExpand).toContain('public.current_user_has_client_access(');
    expect(protocoloLegado).toContain('configuracoes_protocolos_empresas');
    expect(protocoloLegado).toContain('Identificador de protocolo inválido');
    expect(protocoloLegado).toContain("v_periodo NOT IN ('Mensal'");
  });

  it('fecha ACLs e políticas permissivas somente no lockdown posterior', () => {
    expect(lockdown).toContain('REVOKE ALL ON TABLE public.protocolos_entregas FROM anon, authenticated');
    expect(lockdown).toContain('GRANT SELECT ON TABLE public.protocolos_entregas TO authenticated');
    expect(lockdown).toContain('DROP POLICY IF EXISTS isolamento_cliente_select');
    expect(lockdown).toContain("'protocolos:view-own'");
    expect(lockdown).toContain('AND public.current_user_has_client_access(empresa_id, cliente_id)');
    expect(lockdown).toContain('public.current_user_can_access_client_row');
    expect(lockdown).toContain('REVOKE ALL ON FUNCTION public.atualizar_protocolo_entrega(jsonb)');
  });
});
