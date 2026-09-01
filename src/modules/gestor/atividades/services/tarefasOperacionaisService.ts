import { supabase } from '../../../../lib/supabase';
import type { TarefaGestor } from './rotinasAtividadesService';

export interface TarefaProgressoPatch {
  notas?: string;
  observacaoFalta?: string;
  evidencia?: string;
  justificativaConclusao?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string): value is string => Boolean(value && UUID_PATTERN.test(value));

const frequenciaOperacional = (frequencia: TarefaGestor['frequencia']) => {
  if (frequencia === 'Bimestral' || frequencia === 'Anual') return 'Personalizada';
  return frequencia || 'Única';
};

const tarefaPayload = (tarefa: TarefaGestor, isNew: boolean) => ({
  rotina_id: isUuid(tarefa.rotinaId) ? tarefa.rotinaId : null,
  titulo: tarefa.titulo.trim(),
  categoria: tarefa.categoria,
  frequencia: frequenciaOperacional(tarefa.frequencia),
  responsavel_config_usuario_id: isUuid(tarefa.responsavelConfigUsuarioId)
    ? tarefa.responsavelConfigUsuarioId
    : null,
  cliente_nome: tarefa.cliente?.trim() || 'Escritório',
  vencimento: tarefa.vencimento,
  prazo_legal: tarefa.prazoLegal || tarefa.vencimento,
  prazo_interno: tarefa.prazoInterno || tarefa.vencimento,
  prioridade: tarefa.prioridade,
  origem: tarefa.origem,
  ...(isNew ? { checklist: tarefa.checklist || [] } : {}),
  notas: tarefa.notas || '',
  observacao_falta: tarefa.observacaoFalta?.trim() || null,
  ativo: true,
});

const progressPayload = (patch: TarefaProgressoPatch) => {
  const payload: Record<string, string | null> = {};
  if (Object.hasOwn(patch, 'notas')) payload.notas = patch.notas || '';
  if (Object.hasOwn(patch, 'observacaoFalta')) {
    payload.observacao_falta = patch.observacaoFalta?.trim() || null;
  }
  if (Object.hasOwn(patch, 'evidencia')) payload.evidencia = patch.evidencia?.trim() || null;
  if (Object.hasOwn(patch, 'justificativaConclusao')) {
    payload.justificativa_conclusao = patch.justificativaConclusao?.trim() || null;
  }
  return payload;
};

const assertTaskId = (id: string) => {
  if (!isUuid(id)) throw new Error('Tarefa inválida.');
};

export const tarefasOperacionaisService = {
  async save(tarefa: TarefaGestor) {
    const tarefaId = isUuid(tarefa.id) ? tarefa.id : null;
    const { data, error } = await supabase.rpc('salvar_tarefa_operacional', {
      p_tarefa_id: tarefaId,
      p_payload: tarefaPayload(tarefa, tarefaId === null),
    });
    if (error) throw error;
    return data;
  },

  async archive(id: string) {
    assertTaskId(id);
    const { data, error } = await supabase.rpc('salvar_tarefa_operacional', {
      p_tarefa_id: id,
      p_payload: { ativo: false },
    });
    if (error) throw error;
    return data;
  },

  async updateProgress(id: string, patch: TarefaProgressoPatch) {
    assertTaskId(id);
    const payload = progressPayload(patch);
    if (Object.keys(payload).length === 0) throw new Error('Nenhum progresso válido para atualizar.');
    const { data, error } = await supabase.rpc('atualizar_progresso_tarefa_operacional', {
      p_tarefa_id: id,
      p_payload: payload,
    });
    if (error) throw error;
    return data;
  },

  async updateChecklist(
    id: string,
    index: number,
    concluida: boolean,
    evidencia?: string,
    justificativa?: string,
  ) {
    assertTaskId(id);
    if (!Number.isInteger(index) || index < 0) throw new Error('Etapa de checklist inválida.');
    const { data, error } = await supabase.rpc('atualizar_tarefa_operacional_checklist', {
      p_tarefa_id: id,
      p_indice: index,
      p_concluida: concluida,
      p_evidencia: evidencia?.trim() || null,
      p_justificativa: justificativa?.trim() || null,
    });
    if (error) throw error;
    return data;
  },
};
