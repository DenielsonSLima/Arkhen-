import { supabase } from '../../../../lib/supabase';
import { parseFiscalXml } from '../../documentos/xml/shared/xmlFiscalParser';
import { baixarNfsePdf } from '../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/carregarModelo';
import type { NfseEmissionResult } from './nfseService';

export async function getNfseDocumentXml(empresaId: string, cobrancaId: string, result: NfseEmissionResult) {
  if (!empresaId || !cobrancaId || !result.nfseId) throw new Error('Empresa, cobrança e NFS-e são obrigatórias.');
  let payload: { xml?: unknown } | null;
  if (result.ambiente === 'producao') {
    const { data, error } = await supabase.from('financeiro_cobrancas').select('nfse_payload')
      .eq('empresa_id', empresaId).eq('id', cobrancaId).eq('nfse_id', result.nfseId).single();
    if (error) throw new Error('Não foi possível carregar o XML da NFS-e de produção.');
    payload = data?.nfse_payload;
  } else if (result.ambiente === 'homologacao') {
    const { data, error } = await supabase.from('configuracoes_integracao_fiscal_logs').select('detalhes')
      .eq('empresa_id', empresaId).eq('numero_nfse', result.nfseId).eq('status', 'Sucesso')
      .eq('detalhes->>cobrancaId', cobrancaId).eq('detalhes->>ambiente', 'homologacao')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error('Não foi possível carregar o XML da NFS-e de homologação.');
    payload = data?.detalhes;
  } else {
    throw new Error('Ambiente fiscal não identificado.');
  }
  if (typeof payload?.xml !== 'string' || !payload.xml.trim()) {
    throw new Error('O XML confirmado desta nota não está disponível para esta cobrança e ambiente.');
  }
  const summary = parseFiscalXml(payload.xml);
  if (!summary.nfse || summary.nfse.numero !== result.nfseId || !summary.nfse.codigoVerificacao) {
    throw new Error('O XML armazenado não corresponde à NFS-e confirmada.');
  }
  return summary;
}

export async function downloadNfseDocument(empresaId: string, cobrancaId: string, result: NfseEmissionResult) {
  const summary = await getNfseDocumentXml(empresaId, cobrancaId, result);
  await baixarNfsePdf(summary.nfse!, { empresaId, ambiente: result.ambiente, cancelada: summary.isCanceled });
}
