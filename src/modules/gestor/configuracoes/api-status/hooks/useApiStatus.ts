import { useState, useEffect } from 'react';
import { apiStatusService } from '../services/apiStatusService';
import type { EndpointStatus } from '../services/apiStatusService';

export const useApiStatus = () => {
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiStatusService.getStatus();
        setEndpoints(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []);

  return {
    endpoints,
    isLoading,
  };
};
