import { useEffect, useState } from 'react';
import { faturamentoFiscalService } from '../services/faturamentoFiscalService';
import type { FiscalDraft } from '../services/faturamentoFiscalTypes';

export function useNfsePdfPreview(note: FiscalDraft) {
  const [attempt, setAttempt] = useState(0);
  const [file, setFile] = useState<{ url: string; filename: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setFile(undefined);
    setError('');
    void faturamentoFiscalService.preparePdf(note).then(result => {
      if (!active) return;
      url = URL.createObjectURL(result.blob);
      setFile({ url, filename: result.filename });
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o PDF desta nota.');
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [note, attempt]);
  return { file, error, retry: () => setAttempt(value => value + 1) };
}
