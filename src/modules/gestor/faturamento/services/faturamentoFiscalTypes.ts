export type FiscalAmbiente = 'homologacao' | 'producao';
export interface FiscalDraftData {
  competencia: string; dataEmissao: string; descricao: string; valor: number | string;
  itemListaServico: string; codigoCnae: string; codigoTributacaoMunicipio: string; codigoNbs?: string;
  codigoMunicipio: string; municipioIncidencia: string; exigibilidadeIss: string; issRetido: string;
  responsavelRetencao?: string; optanteSimplesNacional: string; regimeEspecial?: string;
  incentivoFiscal: string; aliquotaIss?: number | string;
  tomadorNumero?: string; tomadorCodigoMunicipio?: string;
}
export interface FiscalDraftInput {
  id?: string; fiscalConfigId: string; clienteId: string; cobrancaId?: string | null;
  ambiente: FiscalAmbiente; dados: FiscalDraftData;
}
export interface FiscalDraft extends FiscalDraftInput {
  id: string; empresaId: string; status: string; numeroNfse?: string; codigoVerificacao?: string;
  rpsNumero?: string; rpsSerie?: string; mensagem?: string; createdAt: string; updatedAt: string;
  parceiro?: string; valor?: number; emissao?: string; origem?: string; xmlDisponivel?: boolean;
}
export interface FiscalEmitter {
  id: string; empresaId: string; prestadorNome: string; prestadorCnpj: string;
  inscricaoMunicipal: string; ambiente: FiscalAmbiente; ativo: boolean;
}
export interface FiscalReview {
  rascunho: FiscalDraft; ready: boolean; blockers: string[];
  prestador: { cnpj: string; razaoSocial: string; inscricaoMunicipal: string };
  tomador: { documento: string; razaoSocial: string; [key: string]: unknown };
  endpoint: string;
}
export interface FiscalDocument {
  xml: string; ambiente: FiscalAmbiente; numero: string; codigoVerificacao: string; empresaId: string;
}
export interface FiscalHistoryFilters { ambiente?: FiscalAmbiente; status?: string; search?: string }
export interface FiscalPartnerScope { fiscalConfigId: string; clienteId: string; ambiente: FiscalAmbiente; dataInicial: string; dataFinal: string }
export interface FiscalPreviousNote {
  id: string; origem: 'consultada' | 'rascunho' | 'cobranca'; numero: string; emissao: string;
  valor: number; dados: Partial<FiscalDraftData>; qualidade: { faltantes: string[]; bloqueios?: string[]; limitacoes?: string[] }; sincronizadoEm?: string;
}
export interface FiscalSyncResult {
  notesCount: number; periodo: { inicio: string; fim: string }; coverage: 'complete' | 'partial';
  pagesRead: number; warning?: string;
}
