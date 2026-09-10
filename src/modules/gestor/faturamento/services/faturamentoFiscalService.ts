import { supabase } from '../../../../lib/supabase';
import { parseFiscalXml } from '../../documentos/xml/shared/xmlFiscalParser';
import { baixarNfsePdf } from '../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/carregarModelo';
import type { FiscalDocument, FiscalDraft, FiscalDraftInput, FiscalEmitter, FiscalHistoryFilters, FiscalReview, FiscalPartnerScope, FiscalSyncResult, FiscalPreviousNote } from './faturamentoFiscalTypes';

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error('O serviço fiscal não retornou os dados solicitados.');
  return data as T;
}
async function fiscalAction<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('fiscal-integration', { body: { action, ...body } });
  if (error) {
    const context = 'context' in error ? error.context : null;
    const detail = context instanceof Response ? await context.clone().json().catch(() => null) : null;
    throw new Error(detail?.error || error.message);
  }
  if (!data || data.ok === false) throw new Error(data?.error || 'Resposta fiscal indisponível.');
  return data as T;
}
export const faturamentoFiscalService = {
  tenant: () => rpc<string>('current_empresa_id'),
  emitters: () => rpc<FiscalEmitter[]>('listar_contextos_emissao_webiss'),
  list: (filters: FiscalHistoryFilters) => rpc<FiscalDraft[]>('listar_faturamento_nfse_webiss', {
    p_ambiente: filters.ambiente || null, p_status: filters.status || null, p_search: filters.search || '',
  }),
  save: (input: FiscalDraftInput) => rpc<FiscalDraft>('salvar_rascunho_nfse_webiss', { p_payload: input }),
  review: (id: string) => rpc<FiscalReview>('revisar_rascunho_nfse_webiss', { p_rascunho_id: id }),
  emit: (draft: FiscalDraft) => {
    if (draft.ambiente !== 'homologacao') throw new Error('A transmissão de produção não está liberada nesta etapa.');
    return fiscalAction<{ nfseId: string; ambiente: string }>('emit-draft', { rascunho_id: draft.id });
  },
  consult: (note: Pick<FiscalDraft, 'id' | 'origem'>) => note.origem === 'cobranca'
    ? fiscalAction('consult-nfse', { cobranca_id: note.id }) : fiscalAction('consult-draft', { rascunho_id: note.id }),
  previous: (scope: FiscalPartnerScope) => rpc<FiscalPreviousNote[]>('listar_ultimas_nfse_parceiro_webiss', {
    p_fiscal_config_id: scope.fiscalConfigId, p_cliente_id: scope.clienteId, p_ambiente: scope.ambiente,
    p_data_inicial: scope.dataInicial, p_data_final: scope.dataFinal,
  }),
  copy: (scope: FiscalPartnerScope, note: FiscalPreviousNote, competencia: string) => rpc<FiscalDraft>('copiar_rascunho_nfse_webiss', {
    p_origem_id: note.id, p_origem: note.origem, p_cliente_id: scope.clienteId,
    p_fiscal_config_id: scope.fiscalConfigId, p_ambiente: scope.ambiente, p_competencia: competencia,
    p_data_inicial: scope.dataInicial, p_data_final: scope.dataFinal,
  }),
  sync: (scope: FiscalPartnerScope, dataInicial: string, dataFinal: string) => fiscalAction<FiscalSyncResult>(
    'sync-consulted-nfse', { fiscalConfigId: scope.fiscalConfigId, clienteId: scope.clienteId, ambiente: scope.ambiente, dataInicial, dataFinal }),
  document: (note: Pick<FiscalDraft, 'id' | 'origem' | 'ambiente'>) => rpc<FiscalDocument>('obter_documento_nfse_webiss', {
    p_rascunho_id: note.id, p_origem: note.origem, p_ambiente: note.ambiente,
  }),
  async download(note: Pick<FiscalDraft, 'id' | 'origem' | 'ambiente'> & { status?: string }, format: 'pdf' | 'xml') {
    const document = await this.document(note);
    const summary = parseFiscalXml(document.xml);
    if (!summary.nfse || summary.nfse.numero !== document.numero || !document.empresaId || document.ambiente !== note.ambiente
      || !['homologacao', 'producao'].includes(document.ambiente)) throw new Error('XML incompatível com a nota selecionada.');
    if (format === 'pdf') {
      await baixarNfsePdf(summary.nfse, { empresaId: document.empresaId, ambiente: document.ambiente, cancelada: summary.isCanceled || note.status === 'cancelada' });
      return;
    }
    const url = URL.createObjectURL(new Blob([document.xml], { type: 'application/xml' }));
    const link = window.document.createElement('a');
    link.href = url; link.download = `NFS-e-${document.numero.replace(/[^0-9a-z-]/gi, '')}-${document.ambiente}.xml`;
    window.document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  },
};
