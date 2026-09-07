import { useRef, useState } from 'react';
import { useConsultarNfseFinanceiraMutation, useEmitirNfseFinanceiraMutation } from '../queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../services/financeiroService';

type Feedback = { success: boolean; message: string };

export function useNfseChargeActions(charge: CobrancaFinanceira) {
  const emission = useEmitirNfseFinanceiraMutation();
  const consultation = useConsultarNfseFinanceiraMutation();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const running = useRef(false);
  const canEmit = charge.status !== 'Cancelado' && !charge.nfseId;
  const canConsult = Boolean(charge.nfseRpsNumero || charge.nfseId || charge.nfseStatus === 'processando' || charge.nfseStatus === 'pendente');
  const isPending = emission.isPending || consultation.isPending;

  const run = async (action: 'emit' | 'consult') => {
    if (running.current || (action === 'emit' ? !canEmit : !canConsult)) return;
    running.current = true;
    setFeedback(null);
    try {
      const result = action === 'emit'
        ? await emission.mutateAsync(charge.id)
        : await consultation.mutateAsync(charge.id);
      setFeedback({ success: true, message: result.ambiente === 'homologacao'
        ? `NFS-e ${result.nfseId} em homologação — sem valor fiscal.`
        : `NFS-e ${result.nfseId} registrada em produção.` });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível concluir a operação fiscal.' });
    } finally { running.current = false; }
  };

  return { feedback, isPending, canEmit, canConsult, emit: () => run('emit'), consult: () => run('consult') };
}
