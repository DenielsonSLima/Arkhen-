import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260826025900_resumo_conformidade_server_side.sql',
);

describe('conformidade summary migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('mantém a projeção sob RLS e sem privilégios anônimos', () => {
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('SET row_security = on');
    expect(sql).toContain("current_user_has_permission(v_empresa_id, 'conformidade:view')");
    expect(sql).toContain("current_user_has_permission(v_empresa_id, 'atividades:view')");
    expect(sql).toContain('Seu perfil precisa de acesso a Atividades');
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_resumo_conformidade\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_resumo_conformidade\(uuid\)[\s\S]*TO authenticated/);
  });

  it('calcula datas e métricas no servidor no fuso operacional', () => {
    expect(sql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(sql).toContain("'diasParaVencimento'");
    expect(sql).toContain("'atrasadasPorResponsavel'");
    expect(sql).toContain("'vencendoHoje'");
  });

  it('preserva a instância como origem canônica do checklist', () => {
    expect(sql).toContain('FROM instancias_fonte instancia');
    expect(sql).toContain('instancia.checklists -> etapa.label');
    expect(sql).toContain('jsonb_object_keys(');
    expect(sql).toContain('1000000::bigint + row_number()');
    expect(sql).toContain('FROM jsonb_object_keys(instancia.checklists)');
    expect(sql).not.toContain('SELECT atual.label, atual.ordem::bigint AS ordem');
    expect(sql).toContain('WHERE instancia.tarefa_id = tarefa.id');
  });

  it('mostra solicitações próprias para perfis create-only', () => {
    expect(sql).toContain("current_user_has_permission(v_empresa_id, 'documentos:create')");
    expect(sql).toContain('v_pode_criar_documentos AND solicitacao.criado_por = auth.uid()');
    expect(sql).toContain('v_pode_ver_documentos OR v_pode_criar_documentos');
  });

  it('expõe a capacidade real de atualizar cada checklist', () => {
    expect(sql).toContain("current_user_has_permission(v_empresa_id, 'atividades:manage')");
    expect(sql).toContain("current_user_has_permission(v_empresa_id, 'atividades:update-own')");
    expect(sql).toContain("'podeAtualizar', obrigacao.pode_atualizar");
  });
});
