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
export type EventoOrigem = 'manual' | 'prazo_fiscal' | 'atividade' | 'calendario';

export interface AgendaPadraoEvento {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  tipo: string;
  categoriaId: string;
  escopo: string;
  regraTipo: 'fixa' | 'pascoa_offset' | 'mensal_dia' | 'ultimo_dia_util';
  mes: number | null;
  dia: number | null;
  meses: number[];
  offsetDias: number | null;
  hora: string;
  ativo: boolean;
  editavel: boolean;
  ordem: number;
}

export interface AgendaEventoRow {
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

export interface AtividadeTarefaRow {
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

export interface ResponsavelRow {
  id: string;
  nome: string;
  perfil: UsuarioAgenda['perfil'] | string;
  status: UsuarioAgenda['status'] | string;
  cor: string;
  ativo: boolean;
}

export interface ConfigRow {
  id: string;
  codigo: string;
  label: string;
  cor: string;
  cor_fundo: string;
  ativo: boolean;
}

export interface AgendaPadraoEventoRow {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  categoria: string;
  escopo: string;
  regra_tipo: AgendaPadraoEvento['regraTipo'];
  mes: number | null;
  dia: number | null;
  meses: number[] | null;
  offset_dias: number | null;
  hora: string;
  ativo: boolean;
  editavel: boolean;
  ordem: number;
}
