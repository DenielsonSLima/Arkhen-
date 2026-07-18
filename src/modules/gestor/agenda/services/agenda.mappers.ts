import { supabase } from '../../../../lib/supabase';
import type {
  AgendaEventoRow,
  AgendaPadraoEvento,
  AgendaPadraoEventoRow,
  AtividadeTarefaRow,
  ConfigRow,
  Evento,
  EventoConfigItem,
  ResponsavelRow,
  UsuarioAgenda,
} from './agenda.types';

export function normalizarCor(cor?: string): string {
  if (!cor || typeof cor !== 'string') return '#64748b';
  const normalizado = cor.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizado)) return '#64748b';
  if (normalizado.length === 4) {
    return `#${normalizado[1]}${normalizado[1]}${normalizado[2]}${normalizado[2]}${normalizado[3]}${normalizado[3]}`;
  }
  return normalizado;
}

export function gerarCorFundo(cor: string): string {
  const value = normalizarCor(cor).replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

export const isUuid = (value?: string) => (
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

export const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar agenda.');
  return data as string;
};

export const dateRange = (anoInicio: number, mesInicio: number, meses: number) => {
  const inicio = new Date(anoInicio, mesInicio, 1);
  const fim = new Date(anoInicio, mesInicio + meses, 1);
  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    inicioDia: inicio.toISOString().split('T')[0],
    fimDia: fim.toISOString().split('T')[0],
  };
};

export const toConfig = (row: ConfigRow): EventoConfigItem => ({
  id: row.codigo || row.id,
  label: row.label,
  cor: row.cor,
  corFundo: row.cor_fundo || gerarCorFundo(row.cor),
  ativo: row.ativo,
});

export const toResponsavel = (row: ResponsavelRow): UsuarioAgenda => ({
  id: row.id,
  userId: row.user_id || undefined,
  configUsuarioId: row.config_usuario_id || undefined,
  nome: row.nome,
  perfil: (row.perfil || 'Assistente') as UsuarioAgenda['perfil'],
  status: (row.status || 'Ativo') as UsuarioAgenda['status'],
  cor: row.cor || '#64748b',
  ativo: row.ativo,
});

export const toAgendaPadraoEvento = (row: AgendaPadraoEventoRow): AgendaPadraoEvento => ({
  id: row.id,
  codigo: row.codigo,
  titulo: row.titulo,
  descricao: row.descricao || '',
  tipo: row.tipo,
  categoriaId: row.categoria,
  escopo: row.escopo,
  regraTipo: row.regra_tipo,
  mes: row.mes,
  dia: row.dia,
  meses: row.meses || [],
  offsetDias: row.offset_dias,
  hora: row.hora || '00:00',
  ativo: row.ativo,
  editavel: row.editavel,
  ordem: row.ordem,
});

export const toAgendaPadraoPayload = (item: AgendaPadraoEvento) => ({
  id: item.id,
  codigo: item.codigo,
  titulo: item.titulo,
  descricao: item.descricao,
  tipo: item.tipo,
  categoria: item.categoriaId,
  escopo: item.escopo,
  regra_tipo: item.regraTipo,
  mes: item.mes,
  dia: item.dia,
  meses: item.meses,
  offset_dias: item.offsetDias,
  hora: item.hora,
  ativo: item.ativo,
  editavel: item.editavel,
  ordem: item.ordem,
});

export const toEvento = (row: AgendaEventoRow): Evento => {
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

export const toEventoAtividade = (row: AtividadeTarefaRow): Evento => ({
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
