export type ReformaStatus =
  | 'nao_iniciado'
  | 'aguardando_informacoes'
  | 'em_configuracao'
  | 'aguardando_xml'
  | 'xml_inconsistente'
  | 'adequado'
  | 'nao_aplicavel';

export type ChecklistItemId =
  | 'emissor_atualizado'
  | 'cadastros_revisados'
  | 'cst_configurado'
  | 'classificacao_configurada'
  | 'aliquotas_configuradas'
  | 'totalizadores_configurados'
  | 'xml_emitido'
  | 'xml_validado';

export interface ReformaCliente {
  id: string;
  nome: string;
  cnpj: string;
  regime: string;
  cnae: string;
  cnaeDescricao: string;
  status: ReformaStatus;
  emissor: string;
  ambiente: 'homologacao' | 'producao';
  tiposDocumentos: string[];
  responsavel: string;
  prazo: string;
  checklist: Partial<Record<ChecklistItemId, boolean>>;
  observacoes: string;
  atualizadoEm: string | null;
  ultimaValidacaoResultado: 'valido' | 'alerta' | 'invalido' | null;
  ultimaValidacaoEm: string | null;
  ultimaSimulacaoEm: string | null;
  ultimaDecisao: string | null;
}

export interface ReformaMetricas {
  total: number;
  adequados: number;
  emRisco: number;
  aguardandoXml: number;
  simulacoesPendentes: number;
  diasAteObrigatoriedade: number;
  diasAteOpcaoSimples: number;
}

export interface ReformaPainel {
  podeGerenciar: boolean;
  metricas: ReformaMetricas;
  clientes: ReformaCliente[];
}

export interface AdequacaoInput {
  clienteId: string;
  emissor: string;
  ambiente: 'homologacao' | 'producao';
  tiposDocumentos: string[];
  responsavel: string;
  prazo: string;
  observacoes: string;
}

export interface XmlInconsistencia {
  campo: string;
  severidade: 'erro' | 'aviso';
  mensagem: string;
}

export interface XmlValidationResult {
  id: string;
  resultado: 'valido' | 'alerta' | 'invalido';
  inconsistencias: XmlInconsistencia[];
  versaoRegra: string;
}

export interface SimulacaoResponse {
  id: string;
  resultado: Record<string, unknown>;
  versaoRegra: string;
}

export interface ReformaValidacaoHistorico {
  id: string;
  clienteId: string;
  clienteNome: string;
  arquivoNome: string;
  tipoDocumento: string;
  resultado: 'valido' | 'alerta' | 'invalido';
  inconsistencias: XmlInconsistencia[];
  versaoRegra: string;
  criadoEm: string;
}

export interface ReformaSimulacaoHistorico {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipo: 'ibs_cbs' | 'split_payment';
  competencia: string;
  entrada: Record<string, unknown>;
  resultado: Record<string, unknown>;
  versaoRegra: string;
  criadoEm: string;
}

export interface ReformaDecisaoHistorico {
  id: string;
  clienteId: string;
  clienteNome: string;
  simulacaoId: string | null;
  decisao: 'manter_simples' | 'regime_regular' | 'inconclusivo' | 'pendente';
  parecer: string;
  cienciaClienteEm: string | null;
  periodoInicio: string;
  periodoFim: string;
  criadoEm: string;
}

export interface ReformaHistorico {
  validacoes: ReformaValidacaoHistorico[];
  simulacoes: ReformaSimulacaoHistorico[];
  decisoes: ReformaDecisaoHistorico[];
}
