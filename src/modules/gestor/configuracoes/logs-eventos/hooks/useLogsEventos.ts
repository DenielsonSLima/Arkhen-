import { useState, useEffect } from 'react';
import { logsEventosService } from '../services/logsEventosService';
import type { AuditLog } from '../services/logsEventosService';

export const useLogsEventos = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await logsEventosService.getLogs();
        setLogs(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return {
    logs,
    isLoading,
  };
};
