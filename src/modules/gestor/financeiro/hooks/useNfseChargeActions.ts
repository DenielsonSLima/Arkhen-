import { useEffect, useRef, useState } from 'react';
import { useConsultarNfseFinanceiraMutation } from '../queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../services/financeiroService';
import { nfseResultMessage, type NfseEmissionResult } from '../services/nfseService';

type Feedback = { success: boolean; message: string };
type Scoped<T> = { scope: string; value: T };

export function useNfseChargeActions(charge: CobrancaFinanceira) {
  const consultation = useConsultarNfseFinanceiraMutation();
  const scope = JSON.stringify([charge.empresaId, charge.id, charge.nfseId, charge.nfseStatus]);
  const scopeRef = useRef({ scope });
  if (scopeRef.current.scope !== scope) scopeRef.current = { scope };
  const [feedbackState, setFeedback] = useState<Scoped<Feedback> | null>(null);
  const [confirmedState, setConfirmed] = useState<Scoped<NfseEmissionResult> | null>(null);
  const feedback = feedbackState?.scope === scope ? feedbackState.value : null;
  const confirmed = confirmedState?.scope === scope ? confirmedState.value : null;
  useEffect(() => { setFeedback(null); setConfirmed(null); }, [scope]);
  const [downloading, setDownloading] = useState(false);
  const running = useRef(false);
  const hasFiscalAttempt = ['processando', 'pendente', 'incerta', 'rejeitada', 'falha_pre_envio', 'emitida', 'cancelada', 'substituida']
    .includes(charge.nfseStatus || '');
  const canConsult = Boolean(charge.nfseRpsNumero || charge.nfseId || hasFiscalAttempt);
  const canPrepareDraft = charge.status !== 'Cancelado' && !canConsult;
  const isPending = consultation.isPending || downloading;

  const consult = async () => {
    if (running.current || !canConsult) return;
    running.current = true;
    const requestScope = scopeRef.current;
    setFeedback(null);
    try {
      const result = await consultation.mutateAsync(charge.id);
      if (scopeRef.current !== requestScope) return;
      setConfirmed({ scope: requestScope.scope, value: result });
      setFeedback({ scope: requestScope.scope, value: { success: true, message: nfseResultMessage(result) } });
    } catch (error) {
      if (scopeRef.current === requestScope) setFeedback({ scope: requestScope.scope, value: {
        success: false, message: error instanceof Error ? error.message : 'Não foi possível concluir a operação fiscal.',
      } });
    } finally { running.current = false; }
  };

  const documentResult: NfseEmissionResult | null = confirmed || (charge.nfseId ? {
    nfseId: charge.nfseId, ambiente: 'producao',
    situacao: charge.nfseStatus === 'cancelada' || charge.nfseStatus === 'substituida' ? charge.nfseStatus : undefined,
  } : null);
  const download = async () => {
    if (!documentResult || running.current || isPending) return;
    const requestScope = scopeRef.current;
    running.current = true; setDownloading(true); setFeedback(null);
    try {
      const { downloadNfseDocument } = await import('../services/nfseDocumentService');
      await downloadNfseDocument(charge.empresaId, charge.id, documentResult);
    } catch (error) {
      if (scopeRef.current === requestScope) setFeedback({ scope: requestScope.scope, value: {
        success: false, message: error instanceof Error ? error.message : 'Não foi possível gerar o PDF da NFS-e.',
      } });
    } finally { running.current = false; setDownloading(false); }
  };
  return { feedback, isPending, canPrepareDraft, canConsult, canDownload: Boolean(documentResult), download, consult };
}
