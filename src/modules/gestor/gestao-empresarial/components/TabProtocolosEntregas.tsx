import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileCode2,
  Landmark,
  PlayCircle,
  ReceiptText,
  Save,
  Send,
  WalletCards,
} from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import {
  ProtocolosError,
  type ProtocoloEmpresaConfig,
} from '../../protocolos/services/protocolosService';
import type { ProtocoloTipoConfig } from '../../protocolos/services/protocolosCatalogoService';
import { useEmpresaProtocolosConfiguracao } from '../../protocolos/hooks/useEmpresaProtocolosConfiguracao';
import { OBRIGACAO_PERIODICIDADE_LABELS } from '../../parametrizacao/obrigacoes/obrigacoes.types';
import { formatObrigacaoSchedule } from '../../parametrizacao/obrigacoes/obrigacoesSchedule';
import { useInternalTabs } from '../../../../hooks/useInternalTabs';
import { SystemToast, type SystemToastData } from '../../components/SystemToast';
import './TabProtocolosEntregas.css';

interface TabProtocolosEntregasProps {
  company: Company;
}

const categoryIcon = {
  Fiscal: <Landmark size={16} />,
  Contábil: <ClipboardCheck size={16} />,
  Trabalhista: <FileCheck2 size={16} />,
  Financeiro: <WalletCards size={16} />,
  Documentos: <ReceiptText size={16} />,
  'NF-e': <FileCode2 size={16} />,
  'NFC-e': <FileCode2 size={16} />,
};

const EMPTY_CATALOGO: ProtocoloTipoConfig[] = [];

export const TabProtocolosEntregas: React.FC<TabProtocolosEntregasProps> = ({ company }) => {
  const { openTab } = useInternalTabs();
  const [configs, setConfigs] = useState<ProtocoloEmpresaConfig[]>([]);
  const [configVersion, setConfigVersion] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const isDirtyRef = useRef(false);
  const [toast, setToast] = useState<SystemToastData | null>(null);
  const {
    data: configuracao,
    error: configuracaoError,
    isLoading,
    isSaving,
    refetch: retryConfiguracao,
    saveConfiguracao,
    resetSaveError,
  } = useEmpresaProtocolosConfiguracao(company);
  const catalogo = configuracao?.catalogo ?? EMPTY_CATALOGO;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaved(false);
    setHasConflict(false);
    setConfigs([]);
    setConfigVersion(null);
  }, [company.id, company.status, company.tipo, company.tipoParceiroId]);

  useEffect(() => {
    if (!configuracao) return;
    if (!isDirtyRef.current) {
      setConfigs(configuracao.configs);
      setConfigVersion(configuracao.updatedAt);
      return;
    }

    // Mantém escolhas locais, mas acompanha a composição mais recente do
    // catálogo: adiciona cards novos e remove os que deixaram de ser aplicáveis.
    setConfigs((current) => {
      const localById = new Map(current.map((item) => [item.entregaId, item]));
      return configuracao.configs.map((serverItem) => ({
        ...serverItem,
        ...(localById.get(serverItem.entregaId) ?? {}),
        entregaId: serverItem.entregaId,
      }));
    });
  }, [configuracao]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const configById = useMemo(() => {
    const map = new Map<string, ProtocoloEmpresaConfig>();
    configs.forEach((item) => map.set(item.entregaId, item));
    return map;
  }, [configs]);

  const groupedCatalogo = useMemo(() => {
    return catalogo.reduce<Record<string, typeof catalogo>>((acc, item) => {
      acc[item.categoria] = [...(acc[item.categoria] || []), item];
      return acc;
    }, {});
  }, [catalogo]);

  const toggleEntrega = (id: string) => {
    setSaved(false);
    setIsDirty(true);
    setConfigs((current) => current.map((item) => (
      item.entregaId === id ? { ...item, ativo: !item.ativo } : item
    )));
  };

  const handleSave = async () => {
    setSaved(false);
    resetSaveError();
    try {
      const configuracaoSalva = await saveConfiguracao(configs, configVersion);
      setConfigs(configuracaoSalva.configs);
      setConfigVersion(configuracaoSalva.updatedAt);
      setIsDirty(false);
      isDirtyRef.current = false;
      setSaved(true);
      setHasConflict(false);
      setToast({
        id: Date.now(),
        type: 'success',
        title: 'Entregas sincronizadas',
        message: 'A configuração canônica da empresa foi salva com sucesso.',
      });
    } catch (error) {
      setHasConflict(error instanceof ProtocolosError && error.code === 'conflict');
      setToast({
        id: Date.now(),
        type: 'error',
        title: 'Não foi possível salvar',
        message: error instanceof Error ? error.message : 'Não foi possível sincronizar as obrigações.',
      });
    }
  };

  const handleReloadAfterConflict = async () => {
    resetSaveError();
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaved(false);
    const refreshed = await retryConfiguracao();
    if (refreshed.data) {
      setConfigs(refreshed.data.configs);
      setConfigVersion(refreshed.data.updatedAt);
      setHasConflict(false);
    }
  };

  const handleOpenAtividades = () => {
    openTab(
      'atividades-modelos',
      'Rotinas',
      'Repeat',
      {
        data: {
          selectedCompanyId: company.id,
        },
      },
    );
  };

  const getEntregaDescricao = (entrega: typeof catalogo[number]) => {
    const periodicidadeLabel = OBRIGACAO_PERIODICIDADE_LABELS[entrega.periodicidadePadrao];
    const origem = entrega.origemPadrao === 'Ambos'
      ? 'Cliente e Escritório'
      : entrega.origemPadrao === 'Escritório envia'
        ? 'Envio do escritório'
        : 'Envio do cliente';
    const tipo = ['xml-nfe', 'xml-nfce'].includes(entrega.id)
      ? 'XML em lote'
      : ['folha-pagamento', 'notas-fiscais', 'extrato-bancario', 'guias-pagas'].includes(entrega.id)
      ? 'arquivo mensal'
    : 'obrigação/documento';
    return `${origem} • ${tipo} • rotina ${periodicidadeLabel}`;
  };

  const getPrazoDescricao = (entrega: typeof catalogo[number]) => {
    return formatObrigacaoSchedule({
      periodicidade: entrega.periodicidadePadrao,
      temVencimento: entrega.temVencimento,
      diaVencimento: entrega.diaLimite,
      diaPrimeiraQuinzena: entrega.diaPrimeiraQuinzena,
      diaSegundaQuinzena: entrega.diaSegundaQuinzena,
      diaSemana: entrega.diaSemana,
      dataVencimento: entrega.dataVencimento,
      mesVencimento: entrega.mesVencimento,
    });
  };

  const getEtapasDescricao = (etapas: string[]) => {
    if (etapas.length === 0) return 'Etapas: nenhuma definida';
    const visibleEtapas = etapas.slice(0, 3).join(' • ');
    const remaining = etapas.length - 3;
    return `Etapas: ${visibleEtapas}${remaining > 0 ? ` • +${remaining}` : ''}`;
  };

  const errorMessage = configuracaoError instanceof Error
    ? configuracaoError.message
    : configuracaoError
      ? 'Não foi possível carregar as obrigações da empresa.'
      : '';

  return (
    <div className="tab-panel-content protocolos-config-panel" style={{ position: 'relative', opacity: isLoading ? 0.7 : 1 }}>
      <SystemToast toast={toast} onClose={() => setToast(null)} />
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '40px 0',
            color: '#475569',
          }}
        >
          <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: '2px' }} />
          <span style={{ fontSize: '0.82rem' }}>Carregando obrigações da empresa...</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="error-banner protocolos-config-error" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => { void retryConfiguracao(); }}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {hasConflict ? (
        <div className="error-banner protocolos-config-error" role="alert">
          <span>A configuração mudou em outra tela. Recarregue para continuar.</span>
          <button type="button" onClick={() => { void handleReloadAfterConflict(); }}>
            Recarregar configuração
          </button>
        </div>
      ) : null}

      <div className="protocolos-config-header">
        <div>
          <h3>Rotinas e obrigações da empresa</h3>
          <p>Defina o que entra por competência, com rotina e origem (cliente, escritório ou ambos).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-save-protocolos" onClick={handleOpenAtividades}>
            <PlayCircle size={16} /> Abrir rotinas
          </button>
          <button
            className="btn-save-protocolos"
            onClick={() => { void handleSave(); }}
            style={{ minWidth: 170 }}
            disabled={isLoading || isSaving || Boolean(errorMessage) || hasConflict}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Salvo' : isSaving ? 'Salvando...' : 'Salvar entregas'}
          </button>
        </div>
      </div>

      <div className="protocolos-config-summary">
        <div>
          <span>Empresa</span>
          <strong>{company.nome}</strong>
        </div>
        <div>
          <span>Itens cobrados</span>
          <strong>{configs.filter((item) => item.ativo).length}</strong>
        </div>
        <div>
          <span>Base</span>
          <strong>Competência + rotina</strong>
        </div>
      </div>

      <div className="protocolos-category-grid">
        {Object.entries(groupedCatalogo).map(([categoria, entregas]) => (
          <section key={categoria} className="protocolos-category-section">
            <div className="protocolos-category-title">
              {categoryIcon[categoria as keyof typeof categoryIcon]}
              <strong>{categoria}</strong>
            </div>
            <div className="protocolos-entregas-list">
              {entregas.map((entrega) => {
                const config = configById.get(entrega.id);
                const checked = config?.ativo ?? false;
                const etapas = entrega.etapas ?? [];
                const checkboxId = `obrigacao-${company.id}-${entrega.id}`;
                const periodicidadeId = `periodicidade-${company.id}-${entrega.id}`;
                return (
                  <div key={entrega.id} className={`protocolo-entrega-option ${checked ? 'active' : ''}`}>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      disabled={isLoading || isSaving}
                      checked={checked}
                      onChange={() => toggleEntrega(entrega.id)}
                      aria-label={`${checked ? 'Desativar' : 'Ativar'} ${entrega.nome}`}
                    />
                    <label htmlFor={checkboxId} className="protocolo-option-marker">
                      {checked ? <CheckCircle2 size={16} /> : <Send size={16} />}
                    </label>
                    <label htmlFor={checkboxId} className="protocolo-option-text">
                      <strong>{entrega.nome}</strong>
                      <small>{getEntregaDescricao(entrega)}</small>
                      <span className="protocolo-option-meta">
                        <span>{getPrazoDescricao(entrega)}</span>
                        <span>{etapas.length} {etapas.length === 1 ? 'etapa' : 'etapas'}</span>
                      </span>
                      <small
                        className="protocolo-option-etapas"
                        title={etapas.length > 0 ? etapas.join(' • ') : undefined}
                      >
                        {getEtapasDescricao(etapas)}
                      </small>
                    </label>
                    <div className="protocolo-option-periodicidade">
                      <span className="protocolo-option-periodicidade-label">
                        <CalendarClock size={13} />
                        <strong>Rotina</strong>
                      </span>
                      <span
                        id={periodicidadeId}
                        aria-label={`Rotina de ${entrega.nome}`}
                        className="protocolo-option-periodicidade-value"
                      >
                        {OBRIGACAO_PERIODICIDADE_LABELS[entrega.periodicidadePadrao]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
