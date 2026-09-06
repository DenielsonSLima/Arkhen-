import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  RotateCcw,
  Save,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PARAMETROS_CALCULO_QUERY_KEY,
  parametrosCalculoService,
  type ParametrosCalculo,
  type TipoRescisaoParametro,
} from './services/parametrosCalculoService';
import './ParametrosCalculo.css';
import './ParametrosCalculoCards.css';

export const ParametrosCalculoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [parametros, setParametros] = useState<ParametrosCalculo | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const parametrosQuery = useQuery({
    queryKey: PARAMETROS_CALCULO_QUERY_KEY,
    queryFn: () => parametrosCalculoService.getParametros(),
    staleTime: 30_000,
  });
  const saveMutation = useMutation({
    mutationFn: (value: ParametrosCalculo) => parametrosCalculoService.saveParametros(value),
    onSuccess: (value) => {
      queryClient.setQueryData(PARAMETROS_CALCULO_QUERY_KEY, value);
      void queryClient.invalidateQueries({ queryKey: PARAMETROS_CALCULO_QUERY_KEY });
      setParametros(value);
      setHasChanges(false);
    },
  });
  const resetMutation = useMutation({
    mutationFn: (expectedUpdatedAt: string | null) => (
      parametrosCalculoService.resetParametros(expectedUpdatedAt)
    ),
    onSuccess: (value) => {
      queryClient.setQueryData(PARAMETROS_CALCULO_QUERY_KEY, value);
      void queryClient.invalidateQueries({ queryKey: PARAMETROS_CALCULO_QUERY_KEY });
      setParametros(value);
      setHasChanges(false);
    },
  });

  useEffect(() => {
    if (parametrosQuery.data && !hasChanges) {
      setParametros(parametrosQuery.data);
      setHasChanges(false);
    }
  }, [parametrosQuery.data, hasChanges]);

  const updateTipos = (updater: (list: TipoRescisaoParametro[]) => TipoRescisaoParametro[]) => {
    if (saveMutation.isPending || resetMutation.isPending) return;
    setHasChanges(true);
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
        <div className="parametros-feedback error" role="alert">
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
  const activeCount = parametros.tiposRescisao.filter((tipo) => tipo.ativo).length;
  const lastUpdate = formatLastUpdate(parametros.updatedAt);

  return (
    <div className="submodule-content-card parametros-calculo-page animate-fade-in">
      <header className="parametros-hero">
        <div className="parametros-hero__content">
          <span className="parametros-hero__icon" aria-hidden="true"><FileText size={24} /></span>
          <div>
            <span className="parametros-eyebrow">Configuração da calculadora</span>
            <h2 className="parametrizacao-page-title">Motivos de rescisão</h2>
            <p>Defina como cada opção aparece e quais efeitos ela aplica no cálculo trabalhista.</p>
          </div>
        </div>
        <div className="parametros-hero__status" aria-label="Resumo dos parâmetros">
          <span><CheckCircle2 size={16} /> {activeCount} de {parametros.tiposRescisao.length} ativos</span>
          <small>Última revisão: {lastUpdate}</small>
        </div>
      </header>

      <section className="parametros-action-bar" aria-label="Ações dos parâmetros">
        <div className="parametros-action-bar__copy">
          <span className={`parametros-save-state ${hasChanges ? 'has-changes' : ''}`} aria-live="polite">
            {hasChanges ? 'Alterações pendentes' : 'Configuração sincronizada'}
          </span>
          <p>{hasChanges ? 'Revise os cards e salve para aplicar.' : 'Os dados abaixo são os usados pela calculadora.'}</p>
        </div>
        <div className="parametros-actions">
          <button type="button" className="parametros-btn secondary" onClick={() => { void reset(); }} disabled={isSaving}>
            <RotateCcw size={15} /> Restaurar
          </button>
          <button type="button" className="parametros-btn primary" onClick={() => { void save(); }} disabled={isSaving || !hasChanges}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </section>

      {successMsg && (
        <div className="parametros-feedback success animate-fade-in" role="status">
          <CheckCircle2 size={17} /> {successMsg}
        </div>
      )}
      {requestError ? (
        <div className="parametros-feedback error" role="alert">
          {requestError instanceof Error
            ? requestError.message
            : 'Não foi possível atualizar os parâmetros de rescisão.'}
        </div>
      ) : null}

      <section className="parametros-options" aria-labelledby="parametros-options-title">
        <div className="parametros-section-heading">
          <div>
            <span>Opções disponíveis</span>
            <h3 id="parametros-options-title">Configure cada motivo</h3>
          </div>
          <p>Nome, explicação e efeitos reunidos em um só lugar.</p>
        </div>

        <div className="parametros-card-grid">
          {parametros.tiposRescisao.map((tipo, index) => (
            <article
              aria-label={`Configuração de ${tipo.label}`}
              className={`parametros-option-card ${tipo.ativo ? 'is-active' : 'is-inactive'}`}
              key={tipo.id}
            >
              <header className="parametros-option-card__header">
                <div className="parametros-option-number">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <small>Motivo</small>
                </div>
                <label className="parametros-status-switch">
                  <input
                    aria-label={`Status de ${tipo.label}`}
                    type="checkbox"
                    checked={tipo.ativo}
                    onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, ativo: event.target.checked } : item
                    )))}
                  />
                  <span className="parametros-status-switch__control" aria-hidden="true"><i /></span>
                  <span className="parametros-status-switch__copy">
                    <strong>{tipo.ativo ? 'Ativo' : 'Oculto'}</strong>
                    <small>{tipo.ativo ? 'Visível no cálculo' : 'Fora da seleção'}</small>
                  </span>
                </label>
              </header>

              <div className="parametros-card-fields">
                <label className="parametros-field">
                  <span>Nome exibido</span>
                  <input
                    aria-label={`Nome exibido de ${tipo.id}`}
                    value={tipo.label}
                    onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, label: event.target.value } : item
                    )))}
                  />
                </label>
                <label className="parametros-field">
                  <span>Explicação para o usuário</span>
                  <textarea
                    aria-label={`Descrição de ${tipo.id}`}
                    value={tipo.descricao}
                    rows={3}
                    onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, descricao: event.target.value } : item
                    )))}
                  />
                </label>
              </div>

              <div className="parametros-effects">
                <div className="parametros-effects__heading">
                  <span>Efeitos no cálculo</span>
                  <small>Marque o que este motivo deve gerar.</small>
                </div>
                <div className="parametros-effects__grid">
                  <label className={`parametros-effect ${tipo.geraAvisoPrevio ? 'is-selected' : ''}`}>
                    <input
                      aria-label={`Gerar aviso prévio em ${tipo.label}`}
                      type="checkbox"
                      checked={tipo.geraAvisoPrevio}
                      onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, geraAvisoPrevio: event.target.checked } : item
                      )))}
                    />
                    <span className="parametros-effect__icon"><FileText size={17} /></span>
                    <span><strong>Aviso prévio</strong><small>{tipo.geraAvisoPrevio ? 'Incluído' : 'Não incluído'}</small></span>
                    <CheckCircle2 className="parametros-effect__check" size={16} />
                  </label>
                  <label className={`parametros-effect ${tipo.geraMultaFgts ? 'is-selected' : ''}`}>
                    <input
                      aria-label={`Gerar multa do FGTS em ${tipo.label}`}
                      type="checkbox"
                      checked={tipo.geraMultaFgts}
                      onChange={(event) => updateTipos((list) => list.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, geraMultaFgts: event.target.checked } : item
                      )))}
                    />
                    <span className="parametros-effect__icon"><WalletCards size={17} /></span>
                    <span><strong>Multa do FGTS</strong><small>{tipo.geraMultaFgts ? 'Incluída' : 'Não incluída'}</small></span>
                    <CheckCircle2 className="parametros-effect__check" size={16} />
                  </label>
                </div>
              </div>

              <footer className="parametros-option-card__footer">
                <span className={tipo.ativo ? 'is-visible' : 'is-hidden'}>
                  {tipo.ativo ? <Eye size={14} /> : <EyeOff size={14} />}
                  {tipo.ativo ? 'Disponível na calculadora' : 'Oculto na calculadora'}
                </span>
                <span><ShieldCheck size={14} /> Aplicado após salvar</span>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

const formatLastUpdate = (value: string | null): string => {
  if (!value) return 'configuração padrão';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'data registrada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
