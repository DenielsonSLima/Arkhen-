import React, { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PARAMETROS_CALCULO_QUERY_KEY,
  parametrosCalculoService,
  type ParametrosCalculo,
  type TipoRescisaoParametro,
} from './services/parametrosCalculoService';
import './ParametrosCalculo.css';

export const ParametrosCalculoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [parametros, setParametros] = useState<ParametrosCalculo | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const parametrosQuery = useQuery({
    queryKey: PARAMETROS_CALCULO_QUERY_KEY,
    queryFn: () => parametrosCalculoService.getParametros(),
    staleTime: 30_000,
  });
  const saveMutation = useMutation({
    mutationFn: (value: ParametrosCalculo) => parametrosCalculoService.saveParametros(value),
    onSuccess: (value) => {
      queryClient.setQueryData(PARAMETROS_CALCULO_QUERY_KEY, value);
      setParametros(value);
    },
  });
  const resetMutation = useMutation({
    mutationFn: (expectedUpdatedAt: string | null) => (
      parametrosCalculoService.resetParametros(expectedUpdatedAt)
    ),
    onSuccess: (value) => {
      queryClient.setQueryData(PARAMETROS_CALCULO_QUERY_KEY, value);
      setParametros(value);
    },
  });

  useEffect(() => {
    if (parametrosQuery.data) setParametros(parametrosQuery.data);
  }, [parametrosQuery.data]);

  const updateTipos = (updater: (list: TipoRescisaoParametro[]) => TipoRescisaoParametro[]) => {
    setParametros((current) => current
      ? { ...current, tiposRescisao: updater(current.tiposRescisao) }
      : current);
  };

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(''), 2_500);
  };

  const save = async () => {
    if (!parametros) return;
    try {
      await saveMutation.mutateAsync(parametros);
      showSuccess('Parâmetros de rescisão salvos.');
    } catch {
      // A mutation mantém a mensagem segura no banner da página.
    }
  };

  const reset = async () => {
    if (!parametros) return;
    try {
      await resetMutation.mutateAsync(parametros.updatedAt);
      showSuccess('Parâmetros de rescisão restaurados.');
    } catch {
      // A mutation mantém a mensagem segura no banner da página.
    }
  };

  if (parametrosQuery.isError && !parametros) {
    return (
      <div className="submodule-content-card parametros-calculo-page animate-fade-in">
        <div className="error-banner" role="alert">
          <span>
            {parametrosQuery.error instanceof Error
              ? parametrosQuery.error.message
              : 'Não foi possível carregar os parâmetros de rescisão.'}
          </span>
          <button type="button" onClick={() => { void parametrosQuery.refetch(); }}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (parametrosQuery.isPending || !parametros) {
    return <div className="sub-loading">Carregando parâmetros de rescisão...</div>;
  }

  const isSaving = saveMutation.isPending || resetMutation.isPending;
  const requestError = parametrosQuery.error || saveMutation.error || resetMutation.error;

  return (
    <div className="submodule-content-card parametros-calculo-page animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2 className="parametrizacao-page-title">Parâmetros de Rescisão</h2>
          <p>Defina os rótulos exibidos na Calculadora de Rescisão.</p>
        </div>
        <div className="tab-buttons-header">
          <button type="button" className="btn-cancel" onClick={() => { void reset(); }} disabled={isSaving}>
            <RotateCcw size={15} /> Restaurar
          </button>
          <button type="button" className="btn-add-user" onClick={() => { void save(); }} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {successMsg && <div className="success-banner animate-fade-in" style={{ marginTop: 12 }}>{successMsg}</div>}
      {requestError ? (
        <div className="error-banner" role="alert" style={{ marginTop: 12 }}>
          {requestError instanceof Error
            ? requestError.message
            : 'Não foi possível atualizar os parâmetros de rescisão.'}
        </div>
      ) : null}

      <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
        <div className="table-actions-row"><h3>Motivos suportados</h3></div>
        <div className="table-responsive">
          <table className="config-table parametros-rescisao-table">
            <thead><tr><th>Nome exibido</th><th>Descrição</th><th>Ativo</th></tr></thead>
            <tbody>
              {parametros.tiposRescisao.map((tipo, index) => (
                <tr key={tipo.id}>
                  <td>
                    <input
                      aria-label={`Nome exibido de ${tipo.id}`}
                      value={tipo.label}
                      onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, label: event.target.value } : item
                      )))}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Descrição de ${tipo.id}`}
                      value={tipo.descricao}
                      onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, descricao: event.target.value } : item
                      )))}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Ativar ${tipo.label}`}
                      type="checkbox"
                      checked={tipo.ativo}
                      onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, ativo: event.target.checked } : item
                      )))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
