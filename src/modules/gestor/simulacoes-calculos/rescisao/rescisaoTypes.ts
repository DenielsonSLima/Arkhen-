export type AvisoPrevioModo = 'cumprido' | 'descontado' | 'indenizado';

export type AdicionalTempoServicoTipo = 'trienio' | 'quinquenio' | 'manual';

export interface RescisaoParams {
  tipo: string;
  avisoPrevioModo: AvisoPrevioModo;
  salario: string;
  dataAdmissao: string;
  dataDemissao: string;
  saldoFGTS: string;
  feriasVencidasPeriodos: string;
  feriasVencidasEmDobro: boolean;
  adicionalTempoServicoAtivo: boolean;
  adicionalTempoServicoTipo: AdicionalTempoServicoTipo;
  adicionalTempoServicoPercentual: string;
  adicionalTempoServicoValor: string;
}
