import type { ModeloAtividade } from '../services/atividadesService';
import {
  todayKey,
  type CategoriaAtividade,
  type FrequenciaAtividade,
  type PrioridadeAtividade,
  type RotinaAtividade,
  type ClienteRotina,
} from '../services/rotinasAtividadesService';

export const ESCRITORIO_SCOPE_ID = '__escritorio__';

export interface RotinaProgramadaFormValues {
  id: string;
  modeloId: string;
  nome: string;
  categoria: CategoriaAtividade | '';
  frequencia: FrequenciaAtividade | '';
  intervaloDias: string;
  responsavel: string;
  responsavelUserId?: string;
  responsavelConfigUsuarioId: string;
  clienteScopeId: string;
  clienteNome: string;
  proximaExecucao: string;
  prioridade: PrioridadeAtividade | '';
  ativa: boolean;
  checklistText: string;
  observacoes: string;
  incluirFinaisDeSemana: boolean;
}

export const blankRotinaProgramadaForm = (): RotinaProgramadaFormValues => ({
  id: '',
  modeloId: '',
  nome: '',
  categoria: '',
  frequencia: '',
  intervaloDias: '',
  responsavel: '',
  responsavelConfigUsuarioId: '',
  clienteScopeId: '',
  clienteNome: '',
  proximaExecucao: '',
  prioridade: '',
  ativa: true,
  checklistText: '',
  observacoes: '',
  incluirFinaisDeSemana: false,
});

export const rotinaToProgramadaForm = (rotina: RotinaAtividade): RotinaProgramadaFormValues => ({
  id: rotina.id,
  modeloId: rotina.modeloId || '',
  nome: rotina.nome,
  categoria: rotina.categoria,
  frequencia: rotina.frequencia,
  intervaloDias: String(rotina.intervaloDias || ''),
  responsavel: rotina.responsavel,
  responsavelUserId: rotina.responsavelUserId,
  responsavelConfigUsuarioId: rotina.responsavelConfigUsuarioId || '',
  clienteScopeId: rotina.clienteId || (rotina.cliente === 'Escritório' ? ESCRITORIO_SCOPE_ID : ''),
  clienteNome: rotina.cliente,
  proximaExecucao: rotina.proximaExecucao,
  prioridade: rotina.prioridade,
  ativa: rotina.ativa,
  checklistText: rotina.checklist.join('\n'),
  observacoes: rotina.observacoes,
  incluirFinaisDeSemana: Boolean(rotina.incluirFinaisDeSemana),
});

export const applyModeloToRotinaForm = (
  values: RotinaProgramadaFormValues,
  modelo: ModeloAtividade,
): RotinaProgramadaFormValues => ({
  ...values,
  modeloId: modelo.id,
  nome: (values.id || values.nome.trim()) ? values.nome : modelo.nome,
  checklistText: modelo.etapas.join('\n'),
});

export const getModelosDisponiveisParaVinculo = (
  modelos: ModeloAtividade[],
  clientes: ClienteRotina[],
  clienteScopeId: string,
): ModeloAtividade[] => {
  if (!clienteScopeId) return [];
  if (clienteScopeId === ESCRITORIO_SCOPE_ID) return modelos;
  const cliente = clientes.find((item) => item.id === clienteScopeId);
  const modelosAtivos = new Set(Array.isArray(cliente?.modelosAtivos) ? cliente.modelosAtivos : []);
  return modelos.filter((modelo) => modelosAtivos.has(modelo.id));
};

export const isModeloPermitidoParaVinculo = (
  modeloId: string,
  clienteScopeId: string,
  clientes: ClienteRotina[],
): boolean => {
  if (!modeloId || !clienteScopeId) return false;
  if (clienteScopeId === ESCRITORIO_SCOPE_ID) return true;
  const cliente = clientes.find((item) => item.id === clienteScopeId);
  return Array.isArray(cliente?.modelosAtivos) && cliente.modelosAtivos.includes(modeloId);
};

export const validateRotinaProgramadaForm = (
  values: RotinaProgramadaFormValues,
  currentDate = todayKey(),
): string | null => {
  if (!values.clienteScopeId) return 'Selecione um cliente ou confirme que a rotina é interna do escritório.';
  if (!values.modeloId) return 'Selecione o modelo que fornecerá o checklist da rotina.';
  if (!values.nome.trim()) return 'Informe o nome da rotina.';
  if (!values.categoria) return 'Selecione a categoria da rotina.';
  if (!values.frequencia) return 'Selecione a recorrência da rotina.';
  if (values.frequencia === 'Personalizada' && Number(values.intervaloDias) < 1) {
    return 'Informe um intervalo personalizado de pelo menos 1 dia.';
  }
  if (!values.responsavelConfigUsuarioId) return 'Selecione o responsável pela rotina.';
  if (!values.proximaExecucao) return 'Escolha a data da primeira execução.';
  if (!values.id && values.proximaExecucao < currentDate) {
    return 'A primeira execução não pode estar no passado.';
  }
  if (!values.prioridade) return 'Selecione a prioridade da rotina.';
  if (!values.checklistText.split('\n').some((item) => item.trim())) {
    return 'O modelo selecionado precisa fornecer ao menos uma etapa de checklist.';
  }
  return null;
};

const intervalByFrequency: Record<Exclude<FrequenciaAtividade, 'Personalizada'>, number> = {
  Diária: 1,
  Semanal: 7,
  Quinzenal: 15,
  Mensal: 30,
};

export const buildRotinaFromForm = (values: RotinaProgramadaFormValues): RotinaAtividade => {
  const frequencia = values.frequencia as FrequenciaAtividade;
  const isOfficeRoutine = values.clienteScopeId === ESCRITORIO_SCOPE_ID;

  return {
    id: values.id || `rotina-${Date.now()}`,
    modeloId: values.modeloId,
    nome: values.nome.trim(),
    categoria: values.categoria as CategoriaAtividade,
    frequencia,
    intervaloDias: frequencia === 'Personalizada'
      ? Number(values.intervaloDias)
      : intervalByFrequency[frequencia],
    responsavel: values.responsavel,
    responsavelUserId: values.responsavelUserId,
    responsavelConfigUsuarioId: values.responsavelConfigUsuarioId,
    clienteId: isOfficeRoutine ? undefined : values.clienteScopeId,
    cliente: isOfficeRoutine ? 'Escritório' : values.clienteNome,
    proximaExecucao: values.proximaExecucao,
    prioridade: values.prioridade as PrioridadeAtividade,
    ativa: values.ativa,
    checklist: values.checklistText.split('\n').map((item) => item.trim()).filter(Boolean),
    observacoes: values.observacoes.trim(),
    incluirFinaisDeSemana: values.incluirFinaisDeSemana,
  };
};
