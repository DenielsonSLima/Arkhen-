import { supabase } from '../../../../lib/supabase';
import type { MotivoBloqueioAtividade } from '../../shared/operationalTypes';
import { atividadesService, type ClienteEmpresa, type ModeloAtividade } from './atividadesService';
export type FrequenciaPersistidaAtividade =
  | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Trimestral' | 'Semestral'
  | 'Personalizada';
export type FrequenciaAliasAtividade = 'Bimestral' | 'Anual';
export const ROTINAS_BATCH_LIMIT = 200;
export type FrequenciaAtividade = FrequenciaPersistidaAtividade | FrequenciaAliasAtividade;
export type CategoriaAtividadeConhecida =
  | 'Interna' | 'Cliente' | 'Fiscal' | 'Folha' | 'Contábil' | 'Controle'
  | 'Documentos' | 'Tributos' | 'Obrigações Acessórias' | 'Financeiro';
export type CategoriaAtividade = CategoriaAtividadeConhecida | (string & Record<never, never>);
export type PrioridadeAtividade = 'Baixa' | 'Média' | 'Alta';
export type StatusAtividadeGestor = 'Pendente' | 'Em andamento' | 'Concluída';

export interface RotinaAtividade {
  id: string;
  clienteId?: string;
  modeloId?: string;
  protocoloCodigo?: string;
  nome: string;
  categoria: CategoriaAtividade;
  frequencia: FrequenciaAtividade;
  frequenciaPersistida?: FrequenciaPersistidaAtividade;
  frequenciaAlias?: FrequenciaAliasAtividade;
  intervaloDias: number;
  intervaloMeses?: 2 | 12;
  responsavel: string;
  responsavelUserId?: string;
  responsavelConfigUsuarioId?: string;
  cliente: string;
  dataAncora?: string;
  diaMes?: number;
  diaSemanaIso?: number;
  proximaExecucaoBase?: string;
  proximaExecucao: string;
  reancorarAgenda?: boolean;
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
  responsavelUserId?: string;
  responsavelConfigUsuarioId?: string;
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

export interface UsuarioAtividade {
  configUsuarioId: string;
  userId?: string;
  nome: string;
}
export interface AtividadesWorkspace {
  rotinas: RotinaAtividade[];
  tarefas: TarefaGestor[];
  usuarios: UsuarioAtividade[];
  usuarioAtual: UsuarioAtividade | null;
  clientes: ClienteEmpresa[];
  modelos: ModeloAtividade[];
}
export interface FalhaAtribuicaoRotina {
  rotinaId: string;
  mensagem: string;
}
export interface ResultadoAtribuicaoRotinasLote {
  total: number;
  atualizadas: string[];
  falhas: FalhaAtribuicaoRotina[];
}
interface RotinaAtividadeRow {
  id: string;
  modelo_id: string | null;
  cliente_id: string | null;
  protocolo_codigo: string | null;
  nome: string;
  categoria: CategoriaAtividade | null;
  frequencia: FrequenciaAtividade | null;
  intervalo_dias: number | null;
  intervalo_meses: number | null;
  responsavel_nome: string | null;
  responsavel_user_id: string | null;
  responsavel_config_usuario_id: string | null;
  cliente_nome: string | null;
  data_ancora: string | null;
  dia_mes: number | null;
  dia_semana_iso: number | null;
  proxima_execucao_base: string | null;
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
  responsavel_user_id: string | null;
  responsavel_config_usuario_id: string | null;
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
interface UsuarioAtividadeRpcRow {
  configUsuarioId: string;
  userId: string;
  nome: string;
}
export const RESPONSAVEIS_ATIVIDADES: string[] = [];

export const todayKey = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().split('T')[0];
};

export const addDaysKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const formatDateBR = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR');

const isUuid = (value?: string): value is string => (
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar atividades.');
  return data as string;
};
interface FrequenciaNormalizada {
  frequencia: FrequenciaPersistidaAtividade;
  intervaloDias?: number;
  intervaloMeses?: 2 | 12;
  alias?: FrequenciaAliasAtividade;
}

interface RotinaProgramadaPayload {
  id?: string;
  modeloId: string | null;
  nome: string;
  categoria: CategoriaAtividade;
  frequencia: FrequenciaPersistidaAtividade;
  intervaloDias?: number;
  responsavelConfigUsuarioId: string | null;
  clienteId: string | null;
  primeiraExecucao: string;
  reancorarAgenda: boolean;
  prioridade: PrioridadeAtividade;
  checklist: string[];
  observacoes: string;
  incluirFinaisDeSemana: boolean;
  ativa: boolean;
}

const normalizarFrequencia = (
  frequencia: FrequenciaAtividade,
  intervaloDias: number,
): FrequenciaNormalizada => {
  if (frequencia === 'Bimestral') {
    return { frequencia: 'Personalizada', intervaloDias: 60, intervaloMeses: 2, alias: 'Bimestral' };
  }
  if (frequencia === 'Anual') {
    return { frequencia: 'Personalizada', intervaloDias: 365, intervaloMeses: 12, alias: 'Anual' };
  }
  if (frequencia === 'Personalizada') {
    return { frequencia: 'Personalizada', intervaloDias: Math.max(1, Math.round(intervaloDias || 1)) };
  }
  return { frequencia };
};

const frequenciaDaLinha = (
  frequencia: FrequenciaAtividade | null,
  intervaloDias: number | null,
  intervaloMeses: number | null,
): FrequenciaNormalizada => {
  const intervalo = Number(intervaloDias || 1);
  if (frequencia === 'Bimestral' || intervaloMeses === 2) {
    return { frequencia: 'Personalizada', intervaloDias: 60, intervaloMeses: 2, alias: 'Bimestral' };
  }
  if (frequencia === 'Anual' || intervaloMeses === 12) {
    return { frequencia: 'Personalizada', intervaloDias: 365, intervaloMeses: 12, alias: 'Anual' };
  }
  return normalizarFrequencia(frequencia || 'Personalizada', intervalo);
};

const payloadRotinaProgramada = (rotina: RotinaAtividade): RotinaProgramadaPayload => {
  const agenda = normalizarFrequencia(rotina.frequencia, rotina.intervaloDias);
  return {
    ...(isUuid(rotina.id) ? { id: rotina.id } : {}),
    modeloId: isUuid(rotina.modeloId) ? rotina.modeloId : null,
    nome: rotina.nome.trim(),
    categoria: rotina.categoria,
    frequencia: agenda.frequencia,
    ...(agenda.frequencia === 'Personalizada' ? { intervaloDias: agenda.intervaloDias || 1 } : {}),
    responsavelConfigUsuarioId: isUuid(rotina.responsavelConfigUsuarioId)
      ? rotina.responsavelConfigUsuarioId
      : null,
    clienteId: isUuid(rotina.clienteId) ? rotina.clienteId : null,
    primeiraExecucao: rotina.proximaExecucao || rotina.dataAncora || todayKey(),
    reancorarAgenda: !isUuid(rotina.id) || Boolean(rotina.reancorarAgenda),
    prioridade: rotina.prioridade,
    checklist: rotina.checklist || [],
    observacoes: rotina.observacoes || '',
    incluirFinaisDeSemana: Boolean(rotina.incluirFinaisDeSemana),
    ativa: rotina.ativa !== false,
  };
};

const salvarRotinaProgramada = async (rotina: RotinaAtividade) => {
  const { data, error } = await supabase.rpc('salvar_rotina_programada', {
    p_payload: payloadRotinaProgramada(rotina),
  });
  if (error) throw error;
  return data;
};

const atribuirResponsavel = async (
  rotina: RotinaAtividade,
  responsavelConfigUsuarioId: string,
) => {
  if (!isUuid(responsavelConfigUsuarioId)) {
    throw new Error('Selecione um usuario ativo para atribuir a rotina.');
  }

  if (!isUuid(rotina.id)) throw new Error('Rotina inválida para atribuição.');
  const { error } = await supabase.rpc('atribuir_responsavel_rotina', {
    p_rotina_id: rotina.id,
    p_responsavel_config_usuario_id: responsavelConfigUsuarioId,
  });
  if (error) throw error;
};

const ROTINAS_SELECT = 'id,modelo_id,cliente_id,protocolo_codigo,nome,categoria,frequencia,intervalo_dias,intervalo_meses,responsavel_nome,responsavel_user_id,responsavel_config_usuario_id,cliente_nome,data_ancora,dia_mes,dia_semana_iso,proxima_execucao_base,proxima_execucao,prioridade,checklist,observacoes,incluir_finais_de_semana,ativa';

const toRotina = (row: RotinaAtividadeRow): RotinaAtividade => {
  const agenda = frequenciaDaLinha(row.frequencia, row.intervalo_dias, row.intervalo_meses);
  return {
    id: row.id,
    clienteId: row.cliente_id || undefined,
    modeloId: row.modelo_id || undefined,
    protocoloCodigo: row.protocolo_codigo || undefined,
    nome: row.nome,
    categoria: row.categoria || 'Cliente',
    frequencia: agenda.alias || agenda.frequencia,
    frequenciaPersistida: agenda.frequencia,
    frequenciaAlias: agenda.alias,
    intervaloDias: Number(agenda.intervaloDias || row.intervalo_dias || 1),
    intervaloMeses: agenda.intervaloMeses,
    responsavel: row.responsavel_nome || '',
    responsavelUserId: row.responsavel_user_id || undefined,
    responsavelConfigUsuarioId: row.responsavel_config_usuario_id || undefined,
    cliente: row.cliente_nome || 'Escritório',
    dataAncora: row.data_ancora || undefined,
    diaMes: row.dia_mes ?? undefined,
    diaSemanaIso: row.dia_semana_iso ?? undefined,
    proximaExecucaoBase: row.proxima_execucao_base || undefined,
    proximaExecucao: row.proxima_execucao || todayKey(),
    prioridade: row.prioridade || 'Média',
    ativa: row.ativa !== false,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    observacoes: row.observacoes || '',
    incluirFinaisDeSemana: row.incluir_finais_de_semana || false,
  };
};

const toTarefa = (row: TarefaGestorRow): TarefaGestor => ({
  id: row.id,
  rotinaId: row.rotina_id || undefined,
  titulo: row.titulo,
  categoria: row.categoria || 'Cliente',
  frequencia: row.frequencia || 'Única',
  responsavel: row.responsavel_nome || '',
  responsavelUserId: row.responsavel_user_id || undefined,
  responsavelConfigUsuarioId: row.responsavel_config_usuario_id || undefined,
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
  async getPodeGerenciar() {
    const empresaId = await getCurrentEmpresaId();
    const { data, error } = await supabase.rpc('current_user_has_permission', {
      p_empresa_id: empresaId,
      p_permission: 'atividades:manage',
    });
    if (error) throw error;
    return Boolean(data);
  },

  async getWorkspace(): Promise<AtividadesWorkspace> {
    const empresaId = await getCurrentEmpresaId();
    const [
      { data: rotinasData, error: rotinasError },
      { data: tarefasData, error: tarefasError },
      { data: usuariosData, error: usuariosError },
      clientes,
      modelos,
    ] = await Promise.all([
      supabase
        .from('atividades_rotinas')
        .select(ROTINAS_SELECT)
        .eq('empresa_id', empresaId)
        .eq('ativa', true)
        .order('proxima_execucao', { ascending: true }),
      supabase
        .from('atividades_tarefas')
        .select('id,rotina_id,titulo,categoria,frequencia,responsavel_nome,responsavel_user_id,responsavel_config_usuario_id,cliente_nome,vencimento,prioridade,status,origem,checklist,notas,data_hora_conclusao,observacao_falta')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('vencimento', { ascending: true }),
      supabase.rpc('listar_responsaveis_atividades'),
      atividadesService.getClientes(),
      atividadesService.getModelos(),
    ]);

    if (rotinasError) throw rotinasError;
    if (tarefasError) throw tarefasError;
    if (usuariosError) throw usuariosError;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const usuarios: UsuarioAtividade[] = ((usuariosData || []) as UsuarioAtividadeRpcRow[])
      .map((usuario) => ({
        configUsuarioId: usuario.configUsuarioId,
        userId: usuario.userId,
        nome: usuario.nome,
      }));

    return {
      rotinas: ((rotinasData || []) as RotinaAtividadeRow[]).map(toRotina),
      tarefas: ((tarefasData || []) as TarefaGestorRow[]).map(toTarefa),
      usuarios,
      usuarioAtual: usuarios.find((usuario) => usuario.userId === authData.user?.id) || null,
      clientes,
      modelos,
    };
  },

  async saveRotina(rotina: RotinaAtividade) {
    return salvarRotinaProgramada(rotina);
  },

  async deleteRotina(id: string) {
    if (!isUuid(id)) throw new Error('Rotina inválida.');
    const { data, error } = await supabase.rpc('desativar_rotina_programada', {
      p_rotina_id: id,
    });
    if (error) throw error;
    return data;
  },

  async atribuirResponsavelRotina(
    rotina: RotinaAtividade,
    responsavelConfigUsuarioId: string,
  ) {
    return atribuirResponsavel(rotina, responsavelConfigUsuarioId);
  },

  async atribuirResponsavelRotinasEmLote(
    rotinas: RotinaAtividade[],
    responsavelConfigUsuarioId: string,
  ): Promise<ResultadoAtribuicaoRotinasLote> {
    if (!isUuid(responsavelConfigUsuarioId)) {
      throw new Error('Selecione um usuário ativo para atribuir as rotinas.');
    }
    const ids = rotinas.map((rotina) => rotina.id);
    if (ids.length > ROTINAS_BATCH_LIMIT) {
      throw new Error(`Selecione no máximo ${ROTINAS_BATCH_LIMIT} rotinas por lote.`);
    }
    if (ids.some((id) => !isUuid(id))) throw new Error('O lote contém uma rotina inválida.');
    const { data, error } = await supabase.rpc('atribuir_responsavel_rotinas_lote', {
      p_rotina_ids: ids,
      p_responsavel_config_usuario_id: responsavelConfigUsuarioId,
    });
    if (error) throw error;
    const atualizadas = Array.isArray(data?.atualizadas)
      ? data.atualizadas.map(String)
      : ids;
    return { total: ids.length, atualizadas, falhas: [] };
  },

  async saveTarefa(tarefa: TarefaGestor) {
    const empresaId = await getCurrentEmpresaId();
    let responsavelUserId = tarefa.responsavelUserId;
    if (!isUuid(responsavelUserId) && tarefa.origem === 'Usuario') {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      responsavelUserId = authData.user?.id;
    }
    const payload = {
      empresa_id: empresaId,
      rotina_id: isUuid(tarefa.rotinaId) ? tarefa.rotinaId : null,
      titulo: tarefa.titulo,
      categoria: tarefa.categoria,
      frequencia: tarefa.frequencia || 'Única',
      responsavel_nome: tarefa.responsavel || null,
      responsavel_user_id: isUuid(responsavelUserId) ? responsavelUserId : null,
      responsavel_config_usuario_id: isUuid(tarefa.responsavelConfigUsuarioId)
        ? tarefa.responsavelConfigUsuarioId
        : null,
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
      ? supabase.from('atividades_tarefas').update(payload).eq('id', tarefa.id).eq('empresa_id', empresaId)
      : supabase.from('atividades_tarefas').insert(payload);

    const { error } = await request;
    if (error) throw error;
    return this.getWorkspace();
  },

  async deleteTarefa(id: string) {
    if (!isUuid(id)) return this.getWorkspace();
    const empresaId = await getCurrentEmpresaId();
    const { error } = await supabase.from('atividades_tarefas').update({ ativo: false }).eq('id', id).eq('empresa_id', empresaId);
    if (error) throw error;
    return this.getWorkspace();
  },
};
