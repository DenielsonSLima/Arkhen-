import { supabase } from '../../../../lib/supabase';
import type {
  CategoriaEvento,
  Evento,
  TipoEvento,
  UsuarioAgenda,
} from './agenda.defaults';

export type { CategoriaEvento, Evento, TipoEvento, UsuarioAgenda };

export interface EventoConfigItem {
  id: string;
  label: string;
  cor: string;
  corFundo: string;
  ativo: boolean;
}

export type TipoEventoConfig = EventoConfigItem;
export type CategoriaEventoConfig = EventoConfigItem;
export type UsuarioAgendaConfig = UsuarioAgenda;
export type EventoOrigem = 'manual' | 'prazo_fiscal' | 'atividade';

interface AgendaEventoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  categoria: string;
  origem: string;
  status: string;
  data_inicio: string;
  responsavel_id: string | null;
  cliente_id: string | null;
  metadados: Record<string, any> | null;
}

interface AtividadeTarefaRow {
  id: string;
  titulo: string;
  cliente_nome: string | null;
  responsavel_nome: string | null;
  prioridade: string | null;
  status: string;
  vencimento: string;
  checklist: Array<{ titulo: string; concluida: boolean }> | null;
  notas: string | null;
  observacao_falta: string | null;
}

interface ResponsavelRow {
  id: string;
  nome: string;
  perfil: UsuarioAgenda['perfil'] | string;
  status: UsuarioAgenda['status'] | string;
  cor: string;
  ativo: boolean;
}

interface ConfigRow {
  id: string;
  codigo: string;
  label: string;
  cor: string;
  cor_fundo: string;
  ativo: boolean;
}

function normalizarCor(cor?: string): string {
  if (!cor || typeof cor !== 'string') return '#64748b';
  const normalizado = cor.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizado)) return '#64748b';
  if (normalizado.length === 4) {
    return `#${normalizado[1]}${normalizado[1]}${normalizado[2]}${normalizado[2]}${normalizado[3]}${normalizado[3]}`;
  }
  return normalizado;
}

function gerarCorFundo(cor: string): string {
  const value = normalizarCor(cor).replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

const isUuid = (value?: string) => (
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar agenda.');
  return data as string;
};

const dateRange = (anoInicio: number, mesInicio: number, meses: number) => {
  const inicio = new Date(anoInicio, mesInicio, 1);
  const fim = new Date(anoInicio, mesInicio + meses, 1);
  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    inicioDia: inicio.toISOString().split('T')[0],
    fimDia: fim.toISOString().split('T')[0],
  };
};

const toConfig = (row: ConfigRow): EventoConfigItem => ({
  id: row.codigo || row.id,
  label: row.label,
  cor: row.cor,
  corFundo: row.cor_fundo || gerarCorFundo(row.cor),
  ativo: row.ativo,
});

const toResponsavel = (row: ResponsavelRow): UsuarioAgenda => ({
  id: row.id,
  nome: row.nome,
  perfil: (row.perfil || 'Assistente') as UsuarioAgenda['perfil'],
  status: (row.status || 'Ativo') as UsuarioAgenda['status'],
  cor: row.cor || '#64748b',
  ativo: row.ativo,
});

const toEvento = (row: AgendaEventoRow): Evento => {
  const data = new Date(row.data_inicio);
  const metadados = row.metadados || {};

  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao || '',
    data: row.data_inicio.slice(0, 10),
    hora: data.toISOString().slice(11, 16),
    tipo: row.tipo,
    categoriaId: row.categoria,
    empresaId: row.cliente_id || undefined,
    empresaNome: metadados.empresaNome || metadados.clienteNome || undefined,
    recorrente: Boolean(metadados.recorrente),
    periodoRecorrencia: metadados.periodoRecorrencia,
    concluido: row.status === 'concluido',
    responsavelId: row.responsavel_id || metadados.responsavelId || undefined,
    responsavelNome: metadados.responsavelNome || undefined,
    responsavelPerfil: metadados.responsavelPerfil || undefined,
    criadoPorId: metadados.criadoPorId || undefined,
    criadoPorNome: metadados.criadoPorNome || undefined,
  };
};

const toEventoAtividade = (row: AtividadeTarefaRow): Evento => ({
  id: `atividade:${row.id}`,
  titulo: `[Atividade] ${row.titulo}`,
  descricao: [
    row.cliente_nome ? `Cliente: ${row.cliente_nome}` : '',
    row.responsavel_nome ? `Responsável: ${row.responsavel_nome}` : '',
    row.prioridade ? `Prioridade: ${row.prioridade}` : '',
    row.notas ? `Notas: ${row.notas}` : '',
    row.observacao_falta ? `Observação/Falta: ${row.observacao_falta}` : '',
    row.checklist?.length
      ? `Checklist:\n${row.checklist.map((item) => `${item.concluida ? '✓' : '✗'} ${item.titulo}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n'),
  data: row.vencimento,
  tipo: 'tarefa',
  categoriaId: 'operacional',
  concluido: row.status === 'Concluída',
  responsavelId: row.responsavel_nome || undefined,
  responsavelNome: row.responsavel_nome || undefined,
  empresaNome: row.cliente_nome || undefined,
});

export const TIPO_EVENTO_CONFIG_DEFAULT: TipoEventoConfig[] = [];
export const CATEGORIAS_EVENTO: CategoriaEventoConfig[] = [];
export const TIPO_EVENTO_CONFIG: Record<string, { label: string; cor: string; corFundo: string }> = {};

export async function getTiposEventoConfig(): Promise<TipoEventoConfig[]> {
  const { data, error } = await supabase
    .from('agenda_tipos_evento')
    .select('id,codigo,label,cor,cor_fundo,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ConfigRow[]).map(toConfig);
}

export async function salvarTiposEventoConfig(itens: TipoEventoConfig[]): Promise<TipoEventoConfig[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    empresa_id: empresaId,
    codigo: item.id,
    label: item.label,
    cor: normalizarCor(item.cor),
    cor_fundo: item.corFundo || gerarCorFundo(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_tipos_evento').upsert(payload, { onConflict: 'empresa_id,codigo' });
    if (error) throw error;
  }
  return getTiposEventoConfig();
}

export async function getCategoriasEventoConfig(): Promise<CategoriaEventoConfig[]> {
  const { data, error } = await supabase
    .from('agenda_categorias_evento')
    .select('id,codigo,label,cor,cor_fundo,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ConfigRow[]).map(toConfig);
}

export async function salvarCategoriasEventoConfig(itens: CategoriaEventoConfig[]): Promise<CategoriaEventoConfig[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    empresa_id: empresaId,
    codigo: item.id,
    label: item.label,
    cor: normalizarCor(item.cor),
    cor_fundo: item.corFundo || gerarCorFundo(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_categorias_evento').upsert(payload, { onConflict: 'empresa_id,codigo' });
    if (error) throw error;
  }
  return getCategoriasEventoConfig();
}

export async function getResponsaveisAgendaConfig(): Promise<UsuarioAgenda[]> {
  const { data, error } = await supabase
    .from('agenda_responsaveis')
    .select('id,nome,perfil,status,cor,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ResponsavelRow[]).map(toResponsavel);
}

export async function salvarResponsaveisAgendaConfig(itens: UsuarioAgenda[]): Promise<UsuarioAgenda[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    id: isUuid(item.id) ? item.id : undefined,
    empresa_id: empresaId,
    nome: item.nome,
    perfil: item.perfil,
    status: item.status,
    cor: normalizarCor(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_responsaveis').upsert(payload);
    if (error) throw error;
  }
  return getResponsaveisAgendaConfig();
}

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
  return 'manual';
}

export function getEventoOrigemConfig(evento: Pick<Evento, 'id' | 'tipo'>) {
  const origem = getEventoOrigem(evento);
  const configs: Record<EventoOrigem, { label: string; className: string; cor: string }> = {
    manual: { label: 'Manual', className: 'manual', cor: '#2563eb' },
    prazo_fiscal: { label: 'Prazo Fiscal', className: 'prazo-fiscal', cor: '#ef4444' },
    atividade: { label: 'Atividade', className: 'atividade', cor: '#c59235' },
  };

  return configs[origem];
}

export async function getEventosPorIntervalo(anoInicio: number, mesInicio: number, meses = 1): Promise<Evento[]> {
  const range = dateRange(anoInicio, mesInicio, meses);
  const [{ data: eventosData, error: eventosError }, { data: tarefasData, error: tarefasError }] = await Promise.all([
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
  ]);

  if (eventosError) throw eventosError;
  if (tarefasError) throw tarefasError;

  return [
    ...((eventosData || []) as AgendaEventoRow[]).map(toEvento),
    ...((tarefasData || []) as AtividadeTarefaRow[]).map(toEventoAtividade),
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
