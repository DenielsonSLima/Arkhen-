import { useEffect, useState } from 'react';
import { SystemToast, type SystemToastData } from './SystemToast';

export const SystemErrorToast = ({ error }: { error: Error | string | null | undefined }) => {
  const [toast, setToast] = useState<SystemToastData | null>(null);
  useEffect(() => {
    setToast(error ? {
      id: Date.now(), type: 'error', title: 'Operação não concluída',
      message: typeof error === 'string' ? error : error.message,
    } : null);
  }, [error]);
  return <SystemToast toast={toast} onClose={() => setToast(null)} />;
};
