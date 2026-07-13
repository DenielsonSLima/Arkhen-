import { supabase } from '../../../../lib/supabase';
import {
  dateRange,
  gerarCorFundo,
  getCurrentEmpresaId,
  isUuid,
  toEvento,
  toEventoAtividade,
} from './agenda.mappers';
import { getAgendaPadroesOcorrencias } from './agendaConfig.service';
import type {
  AgendaEventoRow,
  AtividadeTarefaRow,
  CategoriaEvento,
  CategoriaEventoConfig,
  Evento,
  EventoOrigem,
  TipoEventoConfig,
} from './agenda.types';

export function getTipoEventoConfig(
  tipo: string,
  tiposConfig: TipoEventoConfig[] = [],
): { label: string; cor: string; corFundo: string } {
  const found = tiposConfig.find((item) => item.id === tipo);
  if (found) return { label: found.label, cor: found.cor, corFundo: found.corFundo };
  return {
    label: tipo || 'Evento',
    cor: '#64748b',
    corFundo: gerarCorFundo('#64748b'),
  };
}

export function getCategoriaPadraoPorTipo(tipo: string): CategoriaEvento {
  if (tipo === 'prazo_fiscal') return 'fiscal';
  if (tipo === 'reuniao') return 'cliente';
  if (tipo === 'auditoria') return 'auditoria';
  if (tipo === 'lembrete') return 'lembrete';
  return 'operacional';
}

export function getEventoCategoriaConfig(
  evento: Pick<Evento, 'tipo' | 'categoriaId'>,
  categoriasConfig: CategoriaEventoConfig[] = [],
) {
  const categoriaId = evento.categoriaId || getCategoriaPadraoPorTipo(evento.tipo);
  const found = categoriasConfig.find((item) => item.id === categoriaId);
  if (found) return found;
  return {
    id: categoriaId,
    label: categoriaId || 'Categoria',
    cor: '#64748b',
    corFundo: gerarCorFundo('#64748b'),
    ativo: true,
  };
}

export function getEventoOrigem(evento: Pick<Evento, 'id' | 'tipo'>): EventoOrigem {
  if (evento.id.startsWith('atividade:')) return 'atividade';
  if (evento.tipo === 'prazo_fiscal') return 'prazo_fiscal';
  if (evento.id.startsWith('global:') || evento.tipo === 'feriado' || evento.tipo === 'data_especial') return 'calendario';
  return 'manual';
}

export function getEventoOrigemConfig(evento: Pick<Evento, 'id' | 'tipo'>) {
  const origem = getEventoOrigem(evento);
  const configs: Record<EventoOrigem, { label: string; className: string; cor: string }> = {
    manual: { label: 'Manual', className: 'manual', cor: '#2563eb' },
    prazo_fiscal: { label: 'Prazo Fiscal', className: 'prazo-fiscal', cor: '#ef4444' },
    atividade: { label: 'Atividade', className: 'atividade', cor: '#c59235' },
    calendario: { label: 'Calendário', className: 'calendario', cor: '#7c3aed' },
  };

  return configs[origem];
}

export async function getEventosPorIntervalo(anoInicio: number, mesInicio: number, meses = 1): Promise<Evento[]> {
  const range = dateRange(anoInicio, mesInicio, meses);
  const [
    { data: eventosData, error: eventosError },
    { data: tarefasData, error: tarefasError },
    padroesEventos,
  ] = await Promise.all([
    supabase
      .from('agenda_eventos')
      .select('id,titulo,descricao,tipo,categoria,origem,status,data_inicio,responsavel_id,cliente_id,metadados')
      .eq('ativo', true)
      .gte('data_inicio', range.inicio)
      .lt('data_inicio', range.fim)
      .order('data_inicio', { ascending: true }),
    supabase
      .from('atividades_tarefas')
      .select('id,titulo,cliente_nome,responsavel_nome,prioridade,status,vencimento,checklist,notas,observacao_falta')
      .eq('ativo', true)
      .gte('vencimento', range.inicioDia)
      .lt('vencimento', range.fimDia)
      .order('vencimento', { ascending: true }),
    getAgendaPadroesOcorrencias(anoInicio, mesInicio, meses),
  ]);

  if (eventosError) throw eventosError;
  if (tarefasError) throw tarefasError;

  return [
    ...((eventosData || []) as AgendaEventoRow[]).map(toEvento),
    ...((tarefasData || []) as AtividadeTarefaRow[]).map(toEventoAtividade),
    ...padroesEventos,
  ].sort((a, b) => a.data.localeCompare(b.data));
}

export async function adicionarEvento(evento: Omit<Evento, 'id'>): Promise<Evento> {
  const empresaId = await getCurrentEmpresaId();
  const dataInicio = `${evento.data}T${evento.hora || '00:00'}:00`;
  const { data, error } = await supabase
    .from('agenda_eventos')
    .insert({
      empresa_id: empresaId,
      titulo: evento.titulo,
      descricao: evento.descricao || '',
      tipo: evento.tipo || 'tarefa',
      categoria: evento.categoriaId || getCategoriaPadraoPorTipo(evento.tipo),
      origem: 'manual',
      status: evento.concluido ? 'concluido' : 'agendado',
      data_inicio: dataInicio,
      responsavel_id: isUuid(evento.responsavelId) ? evento.responsavelId : null,
      cliente_id: isUuid(evento.empresaId) ? evento.empresaId : null,
      metadados: {
        empresaNome: evento.empresaNome || null,
        responsavelNome: evento.responsavelNome || null,
        responsavelPerfil: evento.responsavelPerfil || null,
        criadoPorId: evento.criadoPorId || null,
        criadoPorNome: evento.criadoPorNome || null,
        recorrente: evento.recorrente || false,
        periodoRecorrencia: evento.periodoRecorrencia || null,
      },
      ativo: true,
    })
    .select('id,titulo,descricao,tipo,categoria,origem,status,data_inicio,responsavel_id,cliente_id,metadados')
    .single();

  if (error) throw error;
  return toEvento(data as AgendaEventoRow);
}

export async function editarEvento(id: string, dados: Partial<Evento>): Promise<Evento | null> {
  if (id.startsWith('atividade:')) {
    throw new Error('Abra esta tarefa em Atividades para alterar prazo, status ou responsável.');
  }

  const payload: Record<string, any> = {};
  if (dados.titulo !== undefined) payload.titulo = dados.titulo;
  if (dados.descricao !== undefined) payload.descricao = dados.descricao;
  if (dados.tipo !== undefined) payload.tipo = dados.tipo;
  if (dados.categoriaId !== undefined) payload.categoria = dados.categoriaId;
  if (dados.concluido !== undefined) payload.status = dados.concluido ? 'concluido' : 'agendado';
  if (dados.data !== undefined || dados.hora !== undefined) {
    payload.data_inicio = `${dados.data || new Date().toISOString().slice(0, 10)}T${dados.hora || '00:00'}:00`;
  }

  const { data, error } = await supabase
    .from('agenda_eventos')
    .update(payload)
    .eq('id', id)
    .select('id,titulo,descricao,tipo,categoria,origem,status,data_inicio,responsavel_id,cliente_id,metadados')
    .maybeSingle();

  if (error) throw error;
  return data ? toEvento(data as AgendaEventoRow) : null;
}

export async function removerEvento(id: string): Promise<void> {
  if (id.startsWith('atividade:')) {
    throw new Error('Tarefas operacionais só podem ser excluídas pelo módulo Atividades.');
  }

  const { error } = await supabase.from('agenda_eventos').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleConcluido(id: string): Promise<void> {
  if (id.startsWith('atividade:')) {
    throw new Error('Abra esta tarefa em Atividades para concluir ou reabrir.');
  }

  const { data, error } = await supabase.from('agenda_eventos').select('status').eq('id', id).maybeSingle();
  if (error) throw error;
  const isDone = data?.status === 'concluido';
  const { error: updateError } = await supabase
    .from('agenda_eventos')
    .update({ status: isDone ? 'agendado' : 'concluido' })
    .eq('id', id);
  if (updateError) throw updateError;
}
