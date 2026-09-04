import type { MotivoBloqueioAtividade } from '../../shared/operationalTypes';
import type { ClienteEmpresa, ModeloAtividade } from './atividadesService';
import type { NivelRiscoOperacional } from './painelOperacionalService';

export type FrequenciaPersistidaAtividade =
  | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Trimestral' | 'Semestral'
  | 'Personalizada';
export type FrequenciaAliasAtividade = 'Bimestral' | 'Anual';
export type FrequenciaAtividade = FrequenciaPersistidaAtividade | FrequenciaAliasAtividade;
export type CategoriaAtividadeConhecida =
  | 'Interna' | 'Cliente' | 'Fiscal' | 'Folha' | 'Contábil' | 'Controle'
  | 'Documentos' | 'Tributos' | 'Obrigações Acessórias' | 'Financeiro';
export type CategoriaAtividade = CategoriaAtividadeConhecida | (string & Record<never, never>);
export type PrioridadeAtividade = 'Baixa' | 'Média' | 'Alta';
export type StatusAtividadeGestor =
  | 'Pendente'
  | 'Em andamento'
  | 'Aguardando revisão'
  | 'Concluída'
  | 'Cancelada';

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
  clienteId?: string;
  rotinaId?: string;
  competencia?: string;
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
  etapasTotal?: number;
  etapasConcluidas?: number;
  percentual?: number;
  notas: string;
  dataHoraConclusao?: string;
  observacaoFalta?: string;
  prazoLegal?: string;
  prazoInterno?: string;
  bloqueada?: boolean;
  motivoBloqueio?: MotivoBloqueioAtividade;
  bloqueadaDesde?: string;
  observacaoBloqueio?: string;
  diasEmAtraso?: number;
  diasParaVencimento?: number;
  nivelRisco?: NivelRiscoOperacional;
  pendenciaRegistrada?: boolean;
  evidenciaRegistrada?: boolean;
  revisaoPendente?: boolean;
  ultimaMovimentacao?: string;
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

export interface RotinaAtividadeRow {
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

export interface TarefaGestorRow {
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

export interface UsuarioAtividadeRpcRow {
  configUsuarioId: string;
  userId: string;
  nome: string;
}

export interface FrequenciaNormalizada {
  frequencia: FrequenciaPersistidaAtividade;
  intervaloDias?: number;
  intervaloMeses?: 2 | 12;
  alias?: FrequenciaAliasAtividade;
}

export interface RotinaProgramadaPayload {
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
