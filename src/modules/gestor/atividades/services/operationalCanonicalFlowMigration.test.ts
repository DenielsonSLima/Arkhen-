import { describe, expect, it } from 'vitest';
import schemaSql from '../../../../../supabase/migrations/20260826172500_expandir_fluxo_operacional_tarefas.sql?raw';
import saveSql from '../../../../../supabase/migrations/20260826172600_expandir_salvamento_tarefa_operacional.sql?raw';
import progressSql from '../../../../../supabase/migrations/20260826172700_expandir_progresso_revisao_tarefas.sql?raw';
import materializationSql from '../../../../../supabase/migrations/20260826172800_expandir_materializacao_tarefas_auditavel.sql?raw';
import closingSql from '../../../../../supabase/migrations/20260826173000_expandir_fechamentos_auditaveis.sql?raw';
import conformitySql from '../../../../../supabase/migrations/20260826173100_expandir_conformidade_por_competencia.sql?raw';
import lockdownSql from '../../../../../supabase/migrations/20260826182500_lockdown_fluxo_operacional_canonico.sql?raw';

describe('fluxo operacional canônico e auditável', () => {
  it('expande o schema sem inventar aprovação ou conclusão', () => {
    expect(schemaSql).toContain('ADD COLUMN IF NOT EXISTS revisor_user_id');
    expect(schemaSql).toContain('ADD COLUMN IF NOT EXISTS concluido_por_user_id');
    expect(schemaSql).toContain('atividades_tarefa_eventos');
    expect(schemaSql).toContain('usuario_pode_revisar_atividade');
    expect(schemaSql).toContain('revisor_user_id = auth.uid()');
    expect(schemaSql).not.toContain("SET concluido_por_user_id =");
  });

  it('deriva responsável, revisor, competência e ator no servidor', () => {
    expect(saveSql).toContain("to_char(v_vencimento, 'MM/YYYY')");
    expect(saveSql).toContain("usuario.status = 'Ativo'");
    expect(saveSql).toContain('v_revisor_user_id = v_responsavel_user_id');
    expect(saveSql).toContain("v_tarefa.status IN ('Aguardando revisão', 'Concluída')");
    expect(saveSql).toContain("'criada'");
    expect(saveSql).not.toContain('data_hora_conclusao:');
  });

  it('impede alteração durante revisão e exige prova para concluir', () => {
    expect(progressSql).toContain("v_tarefa.status IN ('Aguardando revisão', 'Concluída')");
    expect(progressSql).toContain('Informe evidência ou justificativa antes de concluir');
    expect(progressSql).toContain('tarefa.responsavel_user_id = auth.uid()');
    expect(progressSql).toContain('char_length(v_motivo) < 8');
    expect(progressSql).toContain('data_hora_conclusao = NULL');
  });

  it('devolve uma etapa na rejeição para permitir correção e novo envio', () => {
    expect(progressSql).toContain('v_indice_reaberto := jsonb_array_length(v_tarefa.checklist) - 1');
    expect(progressSql).toContain("ARRAY[v_indice_reaberto::text, 'concluida']");
    expect(progressSql).toContain("'indiceReaberto', v_indice_reaberto");
  });

  it('materializa tarefas com prazos e evento de criação canônicos', () => {
    expect(materializationSql).toContain("SET search_path = ''");
    expect(materializationSql).toContain('prazo_legal, prazo_interno');
    expect(materializationSql).toContain('RETURNING id INTO v_tarefa_id');
    expect(materializationSql).toContain('public.registrar_evento_tarefa_operacional');
    expect(materializationSql).toContain("'criada'");
    expect(materializationSql).toContain("usuario.status = 'Ativo'");
  });

  it('homologa somente competência concluída e registra reabertura', () => {
    expect(closingSql).toContain("tarefa.status <> 'Concluída'");
    expect(closingSql).toContain('FROM public.documentos_solicitacoes solicitacao');
    expect(closingSql).toContain('char_length(v_motivo) < 8');
    expect(closingSql).toContain("tipo,\n      ator_user_id, ator_nome, justificativa");
    expect(closingSql).toContain('finalizado_por_user_id = NULL');
  });

  it('consulta apenas tarefas da competência explícita', () => {
    expect(conformitySql).toContain('FROM public.atividades_tarefas tarefa');
    expect(conformitySql).toContain('tarefa.competencia = v_competencia');
    expect(conformitySql).not.toContain('FROM public.atividades_instancias');
  });

  it('só bloqueia caminhos antigos depois do expand e do frontend', () => {
    expect(lockdownSql).toContain('REVOKE ALL ON FUNCTION public.salvar_atividade_tarefa');
    expect(lockdownSql).toContain('REVOKE ALL ON FUNCTION public.atualizar_atividade_checklist');
    expect(lockdownSql).toContain('GRANT SELECT ON TABLE public.atividades_tarefas TO authenticated');
    expect(lockdownSql).toContain('DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_tarefas');
    expect(lockdownSql).toContain('DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_rotinas');
    expect(lockdownSql).toContain('DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_fechamentos');
    expect(lockdownSql).not.toContain('GRANT SELECT ON TABLE public.atividades_instancias');
  });
});
