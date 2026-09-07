import { supabase } from '../../../../lib/supabase';

export interface NfseEmissionResult {
  nfseId: string;
  ambiente: 'homologacao' | 'producao';
}

async function requestNfse(cobrancaId: string, action: 'emit-nfse' | 'consult-nfse'): Promise<NfseEmissionResult> {
  const { data, error } = await supabase.functions.invoke('fiscal-integration', {
    body: { action, cobranca_id: cobrancaId },
  });
  if (error) {
    const response = 'context' in error ? error.context : null;
    const detail = response instanceof Response
      ? await response.clone().json().catch(() => null) : null;
    throw new Error(detail?.error || `Erro ao emitir NFS-e: ${error.message}`);
  }
  if (!data?.ok || !data?.nfseId) throw new Error(data?.error || 'O WebISS não confirmou a emissão da NFS-e.');
  if (data.ambiente !== 'homologacao' && data.ambiente !== 'producao') {
    throw new Error('A resposta fiscal não identificou o ambiente. Consulte o RPS antes de tentar novamente.');
  }
  return { nfseId: String(data.nfseId), ambiente: data.ambiente };
}

export const emitirNfseManual = (cobrancaId: string) => requestNfse(cobrancaId, 'emit-nfse');
export const consultarNfseManual = (cobrancaId: string) => requestNfse(cobrancaId, 'consult-nfse');
