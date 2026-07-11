import React from 'react';
import { AlertTriangle } from 'lucide-react';
import './ArmazenamentoConfig.css';
import { PlansGrid } from './components/PlansGrid';
import { StorageAnalytics } from './components/StorageAnalytics';
import { StorageHeader } from './components/StorageHeader';
import { StorageOverview } from './components/StorageOverview';
import { useArmazenamentoContratacao } from './hooks/useArmazenamentoContratacao';
import {
  usePlanoContratacaoResumoQuery,
  useSelecionarPlanoContratacaoMutation,
} from './queries/usePlanosContratacaoQueries';
import { formatBytes, type PlanoContratacao } from './services/planosContratacaoService';

export const ArmazenamentoConfig: React.FC = () => {
  const resumoQuery = usePlanoContratacaoResumoQuery();
  const selecionarPlanoMutation = useSelecionarPlanoContratacaoMutation();
  const resumo = resumoQuery.data;

  const {
    planoAtual,
    groups,
    totalBytes,
    limitBytes,
    freeBytes,
    usedPercent,
    usageState,
    companiesPercent,
    donut,
  } = useArmazenamentoContratacao(resumo);

  const handleSelectPlan = (plano: PlanoContratacao) => {
    if (!resumo || plano.id === planoAtual.id) return;
    selecionarPlanoMutation.mutate({ empresaId: resumo.empresaId, planoId: plano.id });
  };

  return (
    <div className="arm-page">
      <StorageHeader loading={resumoQuery.isFetching} onRefresh={() => resumoQuery.refetch()} />

      {resumoQuery.error && (
        <div className="arm-banner arm-banner-critical">
          <AlertTriangle size={20} className="arm-banner-icon-svg" />
          <div className="arm-banner-body">
            <strong>Não foi possível carregar os dados</strong>
            <p>{resumoQuery.error instanceof Error ? resumoQuery.error.message : 'Erro inesperado ao carregar o plano.'}</p>
          </div>
        </div>
      )}

      {usageState.tone !== 'ok' && !resumoQuery.error && (
        <div className={`arm-banner ${usageState.tone === 'critical' ? 'arm-banner-critical' : 'arm-banner-warning'}`}>
          <AlertTriangle size={20} className="arm-banner-icon-svg" />
          <div className="arm-banner-body">
            <strong>{usageState.label}</strong>
            <p>
              Esta empresa está usando {formatBytes(totalBytes)} de {planoAtual.armazenamentoGb} GB.
              {usageState.tone === 'critical'
                ? ' Novos uploads serão bloqueados até trocar de plano ou liberar espaço.'
                : ' Considere trocar de plano antes de interromper o envio de documentos.'}
            </p>
          </div>
        </div>
      )}

      <StorageOverview
        planoAtual={planoAtual}
        totalBytes={totalBytes}
        freeBytes={freeBytes}
        fileCount={resumo?.fileCount || 0}
        companyCount={resumo?.companyCount || 0}
        usedPercent={usedPercent}
        companiesPercent={companiesPercent}
        usageState={usageState}
        groups={groups}
        loading={resumoQuery.isLoading}
      />

      <StorageAnalytics
        groups={groups}
        totalBytes={totalBytes}
        limitBytes={limitBytes}
        usedPercent={usedPercent}
        fileCount={resumo?.fileCount || 0}
        donut={donut}
      />

      <PlansGrid
        planoAtualId={planoAtual.id}
        savingPlanId={selecionarPlanoMutation.variables?.planoId}
        onSelectPlan={handleSelectPlan}
      />
    </div>
  );
};
