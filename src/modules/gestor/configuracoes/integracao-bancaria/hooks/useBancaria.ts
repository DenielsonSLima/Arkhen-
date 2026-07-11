import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { bancariaService, defaultAsaas } from '../services/bancariaService';
import type { AsaasConfigDados } from '../services/bancariaService';

export const useBancaria = () => {
  const [asaasConfig, setAsaasConfig] = useState<AsaasConfigDados | null>(null);
  const [isLoadingAsaas, setIsLoadingAsaas] = useState(true);
  const [isSavingAsaas, setIsSavingAsaas] = useState(false);
  const [successMsgAsaas, setSuccessMsgAsaas] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchAsaas = async () => {
      try {
        const res = await bancariaService.getAsaasConfig();
        if (active) {
          setAsaasConfig(res);
        }
      } catch (err) {
        console.error('Erro ao carregar chaves do Asaas:', err);
        if (active) {
          setAsaasConfig(defaultAsaas);
        }
      } finally {
        if (active) {
          setIsLoadingAsaas(false);
        }
      }
    };
    fetchAsaas();

    return () => {
      active = false;
    };
  }, []);

  const handleAsaasInputChange = (field: keyof AsaasConfigDados, value: string | boolean | number) => {
    if (!asaasConfig) return;
    setAsaasConfig({
      ...asaasConfig,
      [field]: value,
    });
  };

  const handleAsaasSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!asaasConfig) return;

    setIsSavingAsaas(true);
    setSuccessMsgAsaas(null);

    try {
      await bancariaService.updateAsaasConfig(asaasConfig);
      setSuccessMsgAsaas('Integração bancária atualizada com sucesso!');
      setTimeout(() => setSuccessMsgAsaas(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingAsaas(false);
    }
  };

  return {
    asaasConfig,
    isLoadingAsaas,
    isSavingAsaas,
    successMsgAsaas,
    handleAsaasInputChange,
    handleAsaasSave,
  };
};
