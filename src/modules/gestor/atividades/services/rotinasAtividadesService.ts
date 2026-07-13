import { supabase } from '../../../../lib/supabase';
import type { MotivoBloqueioAtividade } from '../../shared/operationalTypes';

export type FrequenciaAtividade = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Personalizada';
export type CategoriaAtividade = 'Interna' | 'Cliente' | 'Fiscal' | 'Folha' | 'Contábil' | 'Controle';
export type PrioridadeAtividade = 'Baixa' | 'Média' | 'Alta';
export type StatusAtividadeGestor = 'Pendente' | 'Em andamento' | 'Concluída';

export interface RotinaAtividade {
  id: string;
  nome: string;
  categoria: CategoriaAtividade;
  frequencia: FrequenciaAtividade;
  intervaloDias: number;
  responsavel: string;
  cliente: string;
  proximaExecucao: string;
  prioridade: PrioridadeAtividade;
  ativa: boolean;
  checklist: string[];
  observacoes: string;
  incluirFinaisDeSemana?: boolean;
}

export interface TarefaGestor {
  id: string;
  rotinaId?: string;
  titulo: string;
  categoria: CategoriaAtividade;
  frequencia: FrequenciaAtividade | 'Única';
  responsavel: string;
  cliente: string;
  vencimento: string;
  prioridade: PrioridadeAtividade;
  status: StatusAtividadeGestor;
  origem: 'Rotina' | 'Manual' | 'Usuario' | 'Gestor';
  checklist: Array<{ titulo: string; concluida: boolean }>;
  notas: string;
  dataHoraConclusao?: string;
  observacaoFalta?: string;
  prazoLegal?: string;
  prazoInterno?: string;
  bloqueada?: boolean;
  motivoBloqueio?: MotivoBloqueioAtividade;
  bloqueadaDesde?: string;
  observacaoBloqueio?: string;
}

interface RotinaAtividadeRow {
  id: string;
  nome: string;
  categoria: CategoriaAtividade | null;
  frequencia: FrequenciaAtividade | null;
  intervalo_dias: number | null;
  responsavel_nome: string | null;
  cliente_nome: string | null;
  proxima_execucao: string | null;
  prioridade: PrioridadeAtividade | null;
  checklist: string[] | null;
  observacoes: string | null;
  incluir_finais_de_semana: boolean | null;
  ativa: boolean | null;
}

interface TarefaGestorRow {
  id: string;
  rotina_id: string | null;
  titulo: string;
  categoria: CategoriaAtividade | null;
  frequencia: FrequenciaAtividade | 'Única' | null;
  responsavel_nome: string | null;
  cliente_nome: string | null;
  vencimento: string | null;
  prioridade: PrioridadeAtividade | null;
  status: StatusAtividadeGestor | null;
  origem: 'Rotina' | 'Manual' | 'Usuario' | 'Gestor' | null;
  checklist: Array<{ titulo: string; concluida: boolean }> | null;
  notas: string | null;
  data_hora_conclusao: string | null;
  observacao_falta: string | null;
}

export const RESPONSAVEIS_ATIVIDADES: string[] = [];

export const todayKey = () => new Date().toISOString().split('T')[0];

export const addDaysKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const formatDateBR = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR');

const isUuid = (value?: string) => (
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar atividades.');
  return data as string;
};

const toRotina = (row: RotinaAtividadeRow): RotinaAtividade => ({
  id: row.id,
  nome: row.nome,
  categoria: row.categoria || 'Cliente',
  frequencia: row.frequencia || 'Personalizada',
  intervaloDias: Number(row.intervalo_dias || 1),
  responsavel: row.responsavel_nome || '',
  cliente: row.cliente_nome || 'Escritório',
  proximaExecucao: row.proxima_execucao || todayKey(),
  prioridade: row.prioridade || 'Média',
  ativa: row.ativa !== false,
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  observacoes: row.observacoes || '',
  incluirFinaisDeSemana: row.incluir_finais_de_semana || false,
});

const toTarefa = (row: TarefaGestorRow): TarefaGestor => ({
  id: row.id,
  rotinaId: row.rotina_id || undefined,
  titulo: row.titulo,
  categoria: row.categoria || 'Cliente',
  frequencia: row.frequencia || 'Única',
  responsavel: row.responsavel_nome || '',
  cliente: row.cliente_nome || 'Escritório',
  vencimento: row.vencimento || todayKey(),
  prioridade: row.prioridade || 'Média',
  status: row.status || 'Pendente',
  origem: row.origem || 'Manual',
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  notas: row.notas || '',
  dataHoraConclusao: row.data_hora_conclusao || undefined,
  observacaoFalta: row.observacao_falta || undefined,
});

export const rotinasAtividadesService = {
  async getWorkspace() {
    const [{ data: rotinasData, error: rotinasError }, { data: tarefasData, error: tarefasError }] = await Promise.all([
      supabase
        .from('atividades_rotinas')
        .select('id,nome,categoria,frequencia,intervalo_dias,responsavel_nome,cliente_nome,proxima_execucao,prioridade,checklist,observacoes,incluir_finais_de_semana,ativa')
        .eq('ativa', true)
        .order('proxima_execucao', { ascending: true }),
      supabase
        .from('atividades_tarefas')
        .select('id,rotina_id,titulo,categoria,frequencia,responsavel_nome,cliente_nome,vencimento,prioridade,status,origem,checklist,notas,data_hora_conclusao,observacao_falta')
        .eq('ativo', true)
        .order('vencimento', { ascending: true }),
    ]);

    if (rotinasError) throw rotinasError;
    if (tarefasError) throw tarefasError;

    return {
      rotinas: ((rotinasData || []) as RotinaAtividadeRow[]).map(toRotina),
      tarefas: ((tarefasData || []) as TarefaGestorRow[]).map(toTarefa),
    };
  },

  async saveRotina(rotina: RotinaAtividade) {
    const empresaId = await getCurrentEmpresaId();
    const payload = {
      empresa_id: empresaId,
      nome: rotina.nome,
      categoria: rotina.categoria,
      frequencia: rotina.frequencia,
      intervalo_dias: rotina.intervaloDias,
      responsavel_nome: rotina.responsavel || null,
      cliente_nome: rotina.cliente || 'Escritório',
      proxima_execucao: rotina.proximaExecucao || todayKey(),
      prioridade: rotina.prioridade,
      checklist: rotina.checklist || [],
      observacoes: rotina.observacoes || null,
      incluir_finais_de_semana: rotina.incluirFinaisDeSemana || false,
      ativa: rotina.ativa !== false,
    };

    const request = isUuid(rotina.id)
      ? supabase.from('atividades_rotinas').update(payload).eq('id', rotina.id)
      : supabase.from('atividades_rotinas').insert(payload);

    const { error } = await request;
    if (error) throw error;
    return this.getWorkspace();
  },

  async deleteRotina(id: string) {
    if (!isUuid(id)) return this.getWorkspace();
    const { error } = await supabase.from('atividades_rotinas').update({ ativa: false }).eq('id', id);
    if (error) throw error;
    return this.getWorkspace();
  },

  async saveTarefa(tarefa: TarefaGestor) {
    const empresaId = await getCurrentEmpresaId();
    const payload = {
      empresa_id: empresaId,
      rotina_id: isUuid(tarefa.rotinaId) ? tarefa.rotinaId : null,
      titulo: tarefa.titulo,
      categoria: tarefa.categoria,
      frequencia: tarefa.frequencia || 'Única',
      responsavel_nome: tarefa.responsavel || null,
      cliente_nome: tarefa.cliente || 'Escritório',
      vencimento: tarefa.vencimento || todayKey(),
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      origem: tarefa.origem,
      checklist: tarefa.checklist || [],
      notas: tarefa.notas || null,
      data_hora_conclusao: tarefa.dataHoraConclusao || null,
      observacao_falta: tarefa.observacaoFalta || null,
      ativo: true,
    };

    const request = isUuid(tarefa.id)
      ? supabase.from('atividades_tarefas').update(payload).eq('id', tarefa.id)
      : supabase.from('atividades_tarefas').insert(payload);

    const { error } = await request;
    if (error) throw error;
    return this.getWorkspace();
  },

  async deleteTarefa(id: string) {
    if (!isUuid(id)) return this.getWorkspace();
    const { error } = await supabase.from('atividades_tarefas').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    return this.getWorkspace();
  },
};
