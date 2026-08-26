import { supabase } from '../../../../lib/supabase';
import type { MotivoBloqueioAtividade } from '../../shared/operationalTypes';
import { activityWriteError, isMissingRpcFunctionError } from './rpcCompatibility';
import { toLocalDateKey } from '../utils/localDateKey';

export { toLocalDateKey } from '../utils/localDateKey';

export type FrequenciaAtividade = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Personalizada';
export type CategoriaAtividade = 'Interna' | 'Cliente' | 'Fiscal' | 'Folha' | 'Contábil' | 'Controle';
export type PrioridadeAtividade = 'Baixa' | 'Média' | 'Alta';
export type StatusAtividadeGestor = 'Pendente' | 'Em andamento' | 'Concluída';

export interface RotinaAtividade {
  id: string;
  modeloId?: string;
  nome: string;
  categoria: CategoriaAtividade;
  frequencia: FrequenciaAtividade;
  intervaloDias: number;
  responsavel: string;
  responsavelUserId?: string;
  responsavelConfigUsuarioId?: string;
  clienteId?: string;
  cliente: string;
  proximaExecucao: string;
  prioridade: PrioridadeAtividade;
  ativa: boolean;
  checklist: string[];
  observacoes: string;
  incluirFinaisDeSemana?: boolean;
}

export interface ClienteRotina {
  id: string;
  nome: string;
  modelosAtivos: string[];
}

interface ClienteRotinaRow {
  id: string;
  nome: string | null;
  modelos_ativos: string[] | null;
}

export interface TarefaGestor {
  id: string;
  rotinaId?: string;
  clienteId?: string;
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

interface RotinaAtividadeRow {
  id: string;
  modelo_id: string | null;
  nome: string;
  categoria: CategoriaAtividade | null;
  frequencia: FrequenciaAtividade | null;
  intervalo_dias: number | null;
  responsavel_nome: string | null;
  responsavel_user_id: string | null;
  responsavel_config_usuario_id: string | null;
  cliente_id: string | null;
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
  cliente_id: string | null;
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

export const RESPONSAVEIS_ATIVIDADES: string[] = [];

export const todayKey = () => toLocalDateKey(new Date());

export const addDaysKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
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
  modeloId: row.modelo_id || undefined,
  nome: row.nome,
  categoria: row.categoria || 'Cliente',
  frequencia: row.frequencia || 'Personalizada',
  intervaloDias: Number(row.intervalo_dias || 1),
  responsavel: row.responsavel_nome || '',
  responsavelUserId: row.responsavel_user_id || undefined,
  responsavelConfigUsuarioId: row.responsavel_config_usuario_id || undefined,
  clienteId: row.cliente_id || undefined,
  cliente: row.cliente_nome || 'Escritório',
  proximaExecucao: row.proxima_execucao || todayKey(),
  prioridade: row.prioridade || 'Média',
  ativa: row.ativa !== false,
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  observacoes: row.observacoes || '',
  incluirFinaisDeSemana: row.incluir_finais_de_semana || false,
});

const toClienteRotina = (row: ClienteRotinaRow): ClienteRotina => ({
  id: row.id,
  nome: row.nome || 'Cliente sem nome',
  modelosAtivos: Array.isArray(row.modelos_ativos)
    ? row.modelos_ativos.filter((modeloId): modeloId is string => typeof modeloId === 'string')
    : [],
});

const toTarefa = (row: TarefaGestorRow): TarefaGestor => ({
  id: row.id,
  rotinaId: row.rotina_id || undefined,
  clienteId: row.cliente_id || undefined,
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

  async materializarRotinas() {
    const { data, error } = await supabase.rpc('materializar_atividades_rotinas', {
      p_ate: todayKey(),
    });
    if (error) throw error;
    return Number(data || 0);
  },

  async getWorkspace() {
    const empresaId = await getCurrentEmpresaId();
    const [
      { data: rotinasData, error: rotinasError },
      { data: tarefasData, error: tarefasError },
      { data: usuariosData, error: usuariosError },
      { data: clientesData, error: clientesError },
    ] = await Promise.all([
      supabase
        .from('atividades_rotinas')
        .select('id,modelo_id,nome,categoria,frequencia,intervalo_dias,responsavel_nome,responsavel_user_id,responsavel_config_usuario_id,cliente_id,cliente_nome,proxima_execucao,prioridade,checklist,observacoes,incluir_finais_de_semana,ativa')
        .eq('empresa_id', empresaId)
        .eq('ativa', true)
        .order('proxima_execucao', { ascending: true }),
      supabase
        .from('atividades_tarefas')
        .select('id,rotina_id,cliente_id,titulo,categoria,frequencia,responsavel_nome,responsavel_user_id,responsavel_config_usuario_id,cliente_nome,vencimento,prioridade,status,origem,checklist,notas,data_hora_conclusao,observacao_falta')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('vencimento', { ascending: true }),
      supabase
        .from('configuracoes_usuarios')
        .select('id,auth_user_id,nome,perfil_id')
        .eq('empresa_id', empresaId)
        .eq('status', 'Ativo')
        .order('nome', { ascending: true }),
      supabase
        .from('clientes')
        .select('id,nome,modelos_ativos')
        .eq('empresa_id', empresaId)
        .eq('status', 'Ativa')
        .order('nome', { ascending: true }),
    ]);

    if (rotinasError) throw rotinasError;
    if (tarefasError) throw tarefasError;
    if (usuariosError) throw usuariosError;
    if (clientesError) throw clientesError;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const usuariosMap = new Map<string, UsuarioAtividade & { perfilVinculado: boolean }>();
    (usuariosData || []).forEach((usuario) => {
      const userId = usuario.auth_user_id as string | null;
      const key = userId ? `auth:${userId}` : `config:${usuario.id}`;
      const atual = usuariosMap.get(key);
      const perfilVinculado = Boolean(usuario.perfil_id);
      if (!atual || (!atual.perfilVinculado && perfilVinculado)) {
        usuariosMap.set(key, {
          configUsuarioId: usuario.id,
          userId: userId || undefined,
          nome: usuario.nome,
          perfilVinculado,
        });
      }
    });
    const usuarios: UsuarioAtividade[] = Array.from(usuariosMap.values()).map(({ configUsuarioId, userId, nome }) => ({
      configUsuarioId,
      userId,
      nome,
    }));

    return {
      rotinas: ((rotinasData || []) as RotinaAtividadeRow[]).map(toRotina),
      tarefas: ((tarefasData || []) as TarefaGestorRow[]).map(toTarefa),
      usuarios,
      clientes: ((clientesData || []) as ClienteRotinaRow[]).map(toClienteRotina),
      authUserId: authData.user?.id || null,
      usuarioAtual: usuarios.find((usuario) => usuario.userId === authData.user?.id) || null,
    };
  },

  async saveRotina(rotina: RotinaAtividade) {
    if (!isUuid(rotina.modeloId)) {
      throw new Error('Selecione um modelo ativo da empresa para criar a rotina.');
    }
    if (!isUuid(rotina.responsavelConfigUsuarioId) || !rotina.responsavel.trim()) {
      throw new Error('Selecione um responsável ativo para a rotina.');
    }
    if (!rotina.cliente.trim()) {
      throw new Error('Selecione um cliente ou confirme que a rotina pertence ao escritório.');
    }
    if (rotina.cliente !== 'Escritório' && !isUuid(rotina.clienteId)) {
      throw new Error('Selecione um cliente válido da empresa.');
    }
    if (!rotina.proximaExecucao) {
      throw new Error('Escolha a primeira execução da rotina.');
    }
    if (!isUuid(rotina.id) && rotina.proximaExecucao < todayKey()) {
      throw new Error('A primeira execução não pode estar no passado.');
    }
    if (!rotina.checklist.some((item) => item.trim())) {
      throw new Error('O modelo da rotina precisa fornecer ao menos uma etapa de checklist.');
    }
    const empresaId = await getCurrentEmpresaId();
    if (isUuid(rotina.clienteId)) {
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id,modelos_ativos')
        .eq('empresa_id', empresaId)
        .eq('id', rotina.clienteId)
        .eq('status', 'Ativa')
        .maybeSingle();
      if (clienteError) throw clienteError;
      const modelosAtivos = Array.isArray(cliente?.modelos_ativos) ? cliente.modelos_ativos : [];
      if (!cliente || !modelosAtivos.includes(rotina.modeloId as string)) {
        throw new Error('O modelo selecionado não está vinculado ao cliente escolhido. Revise os vínculos antes de salvar.');
      }
    }
    const payload = {
      empresa_id: empresaId,
      modelo_id: isUuid(rotina.modeloId) ? rotina.modeloId : null,
      nome: rotina.nome,
      categoria: rotina.categoria,
      frequencia: rotina.frequencia,
      intervalo_dias: rotina.intervaloDias,
      responsavel_nome: rotina.responsavel || '',
      responsavel_user_id: isUuid(rotina.responsavelUserId) ? rotina.responsavelUserId : null,
      responsavel_config_usuario_id: isUuid(rotina.responsavelConfigUsuarioId)
        ? rotina.responsavelConfigUsuarioId
        : null,
      cliente_id: isUuid(rotina.clienteId) ? rotina.clienteId : null,
      cliente_nome: rotina.cliente,
      proxima_execucao: rotina.proximaExecucao,
      prioridade: rotina.prioridade,
      checklist: rotina.checklist || [],
      observacoes: rotina.observacoes || '',
      incluir_finais_de_semana: rotina.incluirFinaisDeSemana || false,
      ativa: rotina.ativa !== false,
    };

    const request = isUuid(rotina.id)
      ? supabase.from('atividades_rotinas').update(payload).eq('id', rotina.id).eq('empresa_id', empresaId)
      : supabase.from('atividades_rotinas').insert(payload);

    const { error } = await request;
    if (error) throw error;
    return this.getWorkspace();
  },

  async deleteRotina(id: string) {
    if (!isUuid(id)) return this.getWorkspace();
    const empresaId = await getCurrentEmpresaId();
    const { error } = await supabase.from('atividades_rotinas').update({ ativa: false }).eq('id', id).eq('empresa_id', empresaId);
    if (error) throw error;
    return this.getWorkspace();
  },

  async saveTarefa(tarefa: TarefaGestor) {
    const empresaId = await getCurrentEmpresaId();
    let responsavelUserId = tarefa.responsavelUserId;
    if (!isUuid(responsavelUserId) && tarefa.origem === 'Usuario') {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      responsavelUserId = authData.user?.id;
    }
    const rpcPayload = {
      rotina_id: isUuid(tarefa.rotinaId) ? tarefa.rotinaId : null,
      cliente_id: isUuid(tarefa.clienteId) ? tarefa.clienteId : null,
      titulo: tarefa.titulo,
      categoria: tarefa.categoria,
      frequencia: tarefa.frequencia || 'Única',
      responsavel_nome: tarefa.responsavel || '',
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
      notas: tarefa.notas || '',
      observacao_falta: tarefa.observacaoFalta || null,
      ativo: true,
    };

    const tarefaId = isUuid(tarefa.id) ? tarefa.id : null;
    const { error: rpcError } = await supabase.rpc('salvar_atividade_tarefa', {
      p_tarefa_id: tarefaId,
      p_payload: rpcPayload,
    });
    if (!rpcError) return this.getWorkspace();
    if (!isMissingRpcFunctionError(rpcError)) {
      throw activityWriteError('Não foi possível salvar a tarefa', rpcError);
    }

    // Compatibilidade temporária: frontend novo contra banco anterior à RPC.
    const legacyPayload = {
      empresa_id: empresaId,
      ...rpcPayload,
      data_hora_conclusao: tarefa.status === 'Concluída' ? new Date().toISOString() : null,
    };

    const request = tarefaId
      ? supabase.from('atividades_tarefas').update(legacyPayload).eq('id', tarefaId).eq('empresa_id', empresaId)
      : supabase.from('atividades_tarefas').insert(legacyPayload);

    const { error } = await request;
    if (error) throw activityWriteError('Não foi possível salvar a tarefa', error);
    return this.getWorkspace();
  },

  async deleteTarefa(id: string) {
    if (!isUuid(id)) return this.getWorkspace();
    const { error: rpcError } = await supabase.rpc('salvar_atividade_tarefa', {
      p_tarefa_id: id,
      p_payload: { ativo: false },
    });
    if (!rpcError) return this.getWorkspace();
    if (!isMissingRpcFunctionError(rpcError)) {
      throw activityWriteError('Não foi possível arquivar a tarefa', rpcError);
    }

    const empresaId = await getCurrentEmpresaId();
    const { error } = await supabase
      .from('atividades_tarefas')
      .update({ ativo: false })
      .eq('id', id)
      .eq('empresa_id', empresaId);
    if (error) throw activityWriteError('Não foi possível arquivar a tarefa', error);
    return this.getWorkspace();
  },
};
