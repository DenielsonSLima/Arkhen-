import { supabase } from '../../../../lib/supabase';
import { planosContratacaoService } from '../../configuracoes/armazenamento/services/planosContratacaoService';
import { activityWriteError, isMissingRpcFunctionError } from './rpcCompatibility';

export interface ClienteEmpresa {
  id: string;
  nome: string;
  cnpj: string;
  regime: 'PF' | 'MEI' | 'Isento' | 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | string;
  tipoEstabelecimento: 'Matriz' | 'Filial' | string;
  logo?: string;
  modelosAtivos: string[];
}

export interface ModeloAtividade {
  id: string;
  codigo?: string;
  nome: string;
  descricao: string;
  etapas: string[];
  tipos?: string[];
}

export interface AtividadeInstancia {
  id: string;
  clienteId: string;
  clienteNome: string;
  modeloId: string;
  competencia: string;
  status: 'Pendente' | 'Em andamento' | 'Concluída';
  checklists: { [etapa: string]: boolean };
  checklistDates?: { [etapa: string]: string };
  checklistUsers?: { [etapa: string]: string };
  valores?: {
    valorInss?: number;
    valorIrrf?: number;
    valorReinf?: number;
    valorPis?: number;
    valorCofins?: number;
    valorIrpj?: number;
    valorCsll?: number;
    valorRetencao1708?: number;
    valorRetencao3208?: number;
    valorRetencao5952?: number;
    valorIssRetido?: number;
    valorFunrural?: number;
    database?: string;
  };
}

export type ValoresCompetenciaAtividade = NonNullable<AtividadeInstancia['valores']>;

interface ClienteRow {
  id: string;
  nome: string | null;
  cnpj: string | null;
  tipo: string | null;
  tipo_estabelecimento: string | null;
  logo: string | null;
  modelos_ativos: string[] | null;
}

interface ModeloRow {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  etapas: string[] | null;
  tipos: string[] | null;
}

interface InstanciaRow {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  modelo_id: string | null;
  modelo_codigo: string | null;
  competencia: string;
  status: 'Pendente' | 'Em andamento' | 'Concluída' | 'Cancelada';
  checklists: Record<string, boolean> | null;
  checklist_dates: Record<string, string> | null;
  checklist_users: Record<string, string> | null;
  valores: AtividadeInstancia['valores'] | null;
}

interface FechamentoRow {
  finalizado: boolean;
  data_hora: string | null;
  usuario: string | null;
}

const isUuid = (value?: string) => (
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar atividades.');
  return data as string;
};

const toCliente = (row: ClienteRow): ClienteEmpresa => ({
  id: row.id,
  nome: row.nome || 'Cliente sem nome',
  cnpj: row.cnpj || '',
  regime: row.tipo || 'Não informado',
  tipoEstabelecimento: row.tipo_estabelecimento || 'Matriz',
  logo: row.logo || '',
  modelosAtivos: Array.isArray(row.modelos_ativos) ? row.modelos_ativos : [],
});

const toModelo = (row: ModeloRow): ModeloAtividade => ({
  id: row.id,
  codigo: row.codigo || row.id,
  nome: row.nome,
  descricao: row.descricao || '',
  etapas: Array.isArray(row.etapas) ? row.etapas : [],
  tipos: Array.isArray(row.tipos) ? row.tipos : [],
});

const slugify = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `modelo-${Date.now()}`
);

const toInstancia = (row: InstanciaRow): AtividadeInstancia => ({
  id: row.id,
  clienteId: row.cliente_id || row.cliente_nome,
  clienteNome: row.cliente_nome,
  modeloId: row.modelo_id || row.modelo_codigo || '',
  competencia: row.competencia,
  status: row.status === 'Cancelada' ? 'Pendente' : row.status,
  checklists: row.checklists || {},
  checklistDates: row.checklist_dates || {},
  checklistUsers: row.checklist_users || {},
  valores: row.valores || undefined,
});

export const atividadesService = {
  async getClientes(): Promise<ClienteEmpresa[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nome,cnpj,tipo,tipo_estabelecimento,logo,modelos_ativos')
      .eq('status', 'Ativa')
      .order('nome', { ascending: true });

    if (error) throw error;
    return ((data || []) as ClienteRow[]).map(toCliente);
  },

  async saveCliente(cliente: ClienteEmpresa): Promise<ClienteEmpresa> {
    const empresaId = await getCurrentEmpresaId();
    const isUpdating = isUuid(cliente.id);

    if (!isUpdating) {
      await planosContratacaoService.assertCanCreateCompany();
    }

    const payload = {
      empresa_id: empresaId,
      nome: cliente.nome,
      cnpj: cliente.cnpj,
      tipo: cliente.regime || 'Não informado',
      tipo_estabelecimento: cliente.tipoEstabelecimento || 'Matriz',
      logo: cliente.logo || '',
      modelos_ativos: cliente.modelosAtivos || [],
      status: 'Ativa',
    };

    const request = isUpdating
      ? supabase.from('clientes').update(payload).eq('id', cliente.id).select('id,nome,cnpj,tipo,tipo_estabelecimento,logo,modelos_ativos').single()
      : supabase.from('clientes').insert(payload).select('id,nome,cnpj,tipo,tipo_estabelecimento,logo,modelos_ativos').single();

    const { data, error } = await request;
    if (error) throw error;
    return toCliente(data as ClienteRow);
  },

  async getModelos(): Promise<ModeloAtividade[]> {
    const empresaId = await getCurrentEmpresaId();
    const { data, error } = await supabase
      .from('atividades_modelos')
      .select('id,codigo,nome,descricao,etapas,tipos')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return ((data || []) as ModeloRow[]).map(toModelo);
  },

  async ensureInstancias(competencia: string): Promise<number> {
    const { data, error } = await supabase.rpc('ensure_atividades_instancias', {
      p_competencia: competencia,
    });

    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },

  async saveModelo(modelo: ModeloAtividade): Promise<ModeloAtividade> {
    const empresaId = await getCurrentEmpresaId();
    const payload = {
      empresa_id: empresaId,
      codigo: modelo.codigo || slugify(modelo.id || modelo.nome),
      nome: modelo.nome,
      descricao: modelo.descricao,
      etapas: modelo.etapas,
      tipos: modelo.tipos || [],
      ativo: true,
    };

    const request = isUuid(modelo.id)
      ? supabase.from('atividades_modelos').update(payload).eq('id', modelo.id).select('id,codigo,nome,descricao,etapas,tipos').single()
      : supabase.from('atividades_modelos').insert(payload).select('id,codigo,nome,descricao,etapas,tipos').single();

    const { data, error } = await request;
    if (error) throw error;
    return toModelo(data as ModeloRow);
  },

  async getInstancias(competencia: string): Promise<AtividadeInstancia[]> {
    const { data, error } = await supabase
      .from('atividades_instancias')
      .select('id,cliente_id,cliente_nome,modelo_id,modelo_codigo,competencia,status,checklists,checklist_dates,checklist_users,valores')
      .eq('competencia', competencia)
      .eq('ativo', true)
      .order('cliente_nome', { ascending: true });

    if (error) throw error;
    return ((data || []) as InstanciaRow[]).map(toInstancia);
  },

  async atualizarChecklist(
    instanciaId: string,
    etapa: string,
    concluida: boolean,
  ): Promise<AtividadeInstancia> {
    const { data, error } = await supabase.rpc('atualizar_atividade_checklist', {
      p_instancia_id: instanciaId,
      p_etapa: etapa,
      p_concluida: concluida,
    });
    if (error) throw error;
    return toInstancia(data as InstanciaRow);
  },

  async atualizarValores(
    instanciaId: string,
    valores: ValoresCompetenciaAtividade,
  ): Promise<AtividadeInstancia> {
    const { data, error } = await supabase.rpc('atualizar_atividade_valores', {
      p_instancia_id: instanciaId,
      p_valores: valores,
    });
    if (!error) {
      if (!data) throw new Error('A atualização não retornou a atividade salva.');
      return toInstancia(data as InstanciaRow);
    }
    if (error && !isMissingRpcFunctionError(error)) {
      throw activityWriteError('Não foi possível salvar os valores da atividade', error);
    }

    // Compatibilidade temporária: frontend novo contra banco anterior à RPC.
    const empresaId = await getCurrentEmpresaId();
    const { data: legacyData, error: legacyError } = await supabase
      .from('atividades_instancias')
      .update({ valores })
      .eq('id', instanciaId)
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .select('id,cliente_id,cliente_nome,modelo_id,modelo_codigo,competencia,status,checklists,checklist_dates,checklist_users,valores')
      .single();
    if (legacyError) {
      throw activityWriteError('Não foi possível salvar os valores da atividade', legacyError);
    }
    return toInstancia(legacyData as InstanciaRow);
  },

  async getFechamentoMeta(clienteId: string, competencia: string) {
    const { data, error } = await supabase
      .from('atividades_fechamentos')
      .select('finalizado,data_hora,usuario')
      .eq('cliente_ref', clienteId)
      .eq('competencia', competencia)
      .maybeSingle();

    if (error) throw error;
    const row = data as FechamentoRow | null;
    return {
      finalizado: row?.finalizado || false,
      dataHora: row?.data_hora || '',
      usuario: row?.usuario || '',
    };
  },

  async saveFechamentoMeta(
    clienteId: string,
    competencia: string,
    meta: { finalizado: boolean; dataHora: string; usuario: string },
  ) {
    if (!isUuid(clienteId)) throw new Error('Cliente inválido para homologar o fechamento.');

    const { data, error } = await supabase.rpc('salvar_atividade_fechamento', {
      p_cliente_id: clienteId,
      p_competencia: competencia,
      p_finalizado: meta.finalizado,
    });
    if (!error) {
      if (!data) throw new Error('A homologação não retornou os dados salvos.');
      const row = data as FechamentoRow;
      return {
        finalizado: row.finalizado,
        dataHora: row.data_hora || '',
        usuario: row.usuario || '',
      };
    }
    if (!isMissingRpcFunctionError(error)) {
      throw activityWriteError('Não foi possível salvar a auditoria do fechamento', error);
    }

    // Compatibilidade temporária: frontend novo contra banco anterior à RPC.
    const empresaId = await getCurrentEmpresaId();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    const usuario = user?.user_metadata?.full_name
      || user?.user_metadata?.name
      || user?.email
      || user?.id
      || meta.usuario
      || '';
    const dataHora = new Date().toISOString();
    const { error: legacyError } = await supabase
      .from('atividades_fechamentos')
      .upsert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        cliente_ref: clienteId,
        competencia,
        finalizado: meta.finalizado,
        data_hora: dataHora,
        usuario,
      }, { onConflict: 'empresa_id,cliente_ref,competencia' });

    if (legacyError) {
      throw activityWriteError('Não foi possível salvar a auditoria do fechamento', legacyError);
    }
    return { finalizado: meta.finalizado, dataHora, usuario };
  },
};
