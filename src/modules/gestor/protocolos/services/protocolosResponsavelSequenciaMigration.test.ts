import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260831011500_corrigir_sequencia_protocolos_responsaveis.sql?raw';

describe('sequência de configuração das rotinas de protocolo', () => {
  it('aceita rotinas sem responsável e as deixa aguardando atribuição', () => {
    const materializacao = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.materializar_atividades_rotinas'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo'),
    );

    expect(materializacao).toContain('IF NOT FOUND THEN\n      CONTINUE;');
    expect(materializacao).not.toContain("RAISE EXCEPTION 'Rotina sem responsável ativo");
  });

  it('materializa após atribuir o responsável, não ao salvar a configuração', () => {
    const assignment = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo'),
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );
    const save = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente'),
    );

    expect(assignment).toContain('PERFORM public.materializar_atividades_rotinas');
    expect(save).toContain('public.sincronizar_rotinas_protocolos_cliente');
    expect(save).not.toContain('PERFORM public.materializar_atividades_rotinas');
  });
});
