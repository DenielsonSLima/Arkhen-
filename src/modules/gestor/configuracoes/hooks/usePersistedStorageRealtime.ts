import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../queries/configuracoesKeys';
import { planosContratacaoKeys } from '../armazenamento/queries/usePlanosContratacaoQueries';

const STORAGE_KEY_PREFIXES = {
  planoContratacao: 'contabil_plano_contratacao_empresa:',
};

const getInvalidationConfig = (key: string) => {
  if (key === 'contabil_config_xml_modelos') {
    return [configuracoesKeys.xmlModelos()];
  }

  if (key.startsWith(STORAGE_KEY_PREFIXES.planoContratacao)) {
    return [planosContratacaoKeys.resumo];
  }

  return null;
};

export const usePersistedStorageRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      const key = customEvent?.detail?.key;
      if (!key) return;

      const queryKeys = getInvalidationConfig(key);
      if (!queryKeys) return;

      queryKeys.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    };

    window.addEventListener('persisted_storage_change', handler);
    return () => {
      window.removeEventListener('persisted_storage_change', handler);
    };
  }, [enabled, queryClient]);
};
