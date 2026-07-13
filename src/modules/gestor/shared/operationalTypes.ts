export type SourceModule = 'agenda' | 'atividades' | 'protocolos' | 'conformidade';

export interface NavigationContext {
  sourceModule: SourceModule;
  sourceId?: string;
  companyId?: string;
  competencia?: string;
  atividadeId?: string;
  protocoloId?: string;
  riskId?: string;
  returnTo?: string;
}

export type AtividadeStatus =
  | 'pendente'
  | 'em_andamento'
  | 'aguardando_cliente'
  | 'bloqueada'
  | 'concluida'
  | 'cancelada';

export type ProtocoloStatus =
  | 'pendente'
  | 'recebido'
  | 'enviado'
  | 'protocolado'
  | 'rejeitado'
  | 'concluido';

export type RiscoStatus =
  | 'normal'
  | 'atencao'
  | 'critico'
  | 'regularizado'
  | 'ignorado';

export type MotivoBloqueioAtividade =
  | 'aguardando_documento_cliente'
  | 'aguardando_aprovacao'
  | 'dependencia_outra_tarefa'
  | 'erro_integracao'
  | 'ausencia_responsavel'
  | 'problema_cadastral'
  | 'pendencia_externa';
