import { supabase } from '../../../../lib/supabase';
import { atividadesService } from './atividadesService';
import type {
  AtividadesWorkspace,
  FrequenciaAtividade,
  FrequenciaNormalizada,
  ResultadoAtribuicaoRotinasLote,
  RotinaAtividade,
  RotinaAtividadeRow,
  RotinaProgramadaPayload,
  TarefaGestor,
  TarefaGestorRow,
  UsuarioAtividade,
  UsuarioAtividadeRpcRow,
} from './rotinasAtividadesTypes';
import {
  tarefasOperacionaisService,
  type TarefaProgressoPatch,
} from './tarefasOperacionaisService';
import { tarefasProgressoService } from './tarefasProgressoService';
export type { TarefaProgressoPatch } from './tarefasOperacionaisService';
export type {
  AtividadesWorkspace,
  CategoriaAtividade,
  CategoriaAtividadeConhecida,
  FalhaAtribuicaoRotina,
  FrequenciaAliasAtividade,
  FrequenciaAtividade,
  FrequenciaPersistidaAtividade,
  PrioridadeAtividade,
  ResultadoAtribuicaoRotinasLote,
  RotinaAtividade,
  StatusAtividadeGestor,
  TarefaGestor,
  UsuarioAtividade,
} from './rotinasAtividadesTypes';
export const ROTINAS_BATCH_LIMIT = 200;
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
      progressoTarefas,
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
      tarefasProgressoService.getAll(),
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
      tarefas: ((tarefasData || []) as TarefaGestorRow[]).map((row) => ({
        ...toTarefa(row),
        clienteId: progressoTarefas.get(row.id)?.clienteId,
        competencia: progressoTarefas.get(row.id)?.competencia,
        etapasTotal: progressoTarefas.get(row.id)?.etapasTotal ?? 0,
        etapasConcluidas: progressoTarefas.get(row.id)?.etapasConcluidas ?? 0,
        percentual: progressoTarefas.get(row.id)?.percentual ?? 0,
        prazoLegal: progressoTarefas.get(row.id)?.prazoLegal,
        prazoInterno: progressoTarefas.get(row.id)?.prazoInterno,
        diasEmAtraso: progressoTarefas.get(row.id)?.diasEmAtraso ?? 0,
        diasParaVencimento: progressoTarefas.get(row.id)?.diasParaVencimento,
        nivelRisco: progressoTarefas.get(row.id)?.nivelRisco,
        pendenciaRegistrada: progressoTarefas.get(row.id)?.pendenciaRegistrada,
        evidenciaRegistrada: progressoTarefas.get(row.id)?.evidenciaRegistrada,
        revisaoPendente: progressoTarefas.get(row.id)?.revisaoPendente,
        ultimaMovimentacao: progressoTarefas.get(row.id)?.ultimaMovimentacao,
      })),
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
    return tarefasOperacionaisService.save(tarefa);
  },

  async deleteTarefa(id: string) {
    return tarefasOperacionaisService.archive(id);
  },

  async updateTarefaProgress(id: string, patch: TarefaProgressoPatch) {
    return tarefasOperacionaisService.updateProgress(id, patch);
  },

  async updateTarefaChecklist(
    id: string,
    index: number,
    concluida: boolean,
    evidencia?: string,
    justificativa?: string,
  ) {
    return tarefasOperacionaisService.updateChecklist(
      id,
      index,
      concluida,
      evidencia,
      justificativa,
    );
  },
};
