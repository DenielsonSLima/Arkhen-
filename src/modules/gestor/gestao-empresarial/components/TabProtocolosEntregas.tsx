import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileCode2,
  Landmark,
  ListPlus,
  Pencil,
  PlayCircle,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import type { Company, ClientBranch } from '../services/gestaoEmpresarialService';
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
import { ObrigacoesSelectionModal } from './ObrigacoesSelectionModal';
import './TabProtocolosEntregas.css';

interface TabProtocolosEntregasProps {
  company: Company;
}

interface ProtocolUnit {
  company: Company;
  id: string;
  kind: 'Matriz' | 'Filial';
  label: string;
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

const makeBranchCompany = (company: Company, branch: ClientBranch): Company => ({
  ...company,
  id: branch.id,
  nome: branch.nome || 'Filial sem nome',
  razaoSocial: branch.nome || company.razaoSocial,
  cnpj: branch.cnpj || '',
  tipoEstabelecimento: 'Filial',
  status: branch.ativo ? 'Ativa' : 'Inativa',
  email: branch.email || '',
  telefone: branch.telefone || '',
  endereco: branch.endereco || '',
  cidade: branch.cidade || '',
  uf: branch.uf || '',
  cep: branch.cep || '',
  bairro: branch.bairro || '',
  contato: branch.contato || '',
  polos: [],
});

const buildProtocolUnits = (company: Company): ProtocolUnit[] => {
  const seenIds = new Set([company.id]);
  const rootKind = company.tipoEstabelecimento === 'Filial' ? 'Filial' : 'Matriz';
  const branches = (company.polos ?? []).flatMap((branch) => {
    const id = branch.id?.trim();
    if (!id || seenIds.has(id)) return [];
    seenIds.add(id);
    return [{
      company: makeBranchCompany(company, { ...branch, id }),
      id,
      kind: 'Filial' as const,
      label: `Filial • ${branch.nome || branch.cnpj || 'Sem nome'}${branch.ativo ? '' : ' (inativa)'}`,
    }];
  });
  return [{
    company,
    id: company.id,
    kind: rootKind,
    label: `${rootKind} • ${company.nome}`,
  }, ...branches];
};

const getEntregaDescricao = (entrega: ProtocoloTipoConfig) => {
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

const getPrazoDescricao = (entrega: ProtocoloTipoConfig) => formatObrigacaoSchedule({
  periodicidade: entrega.periodicidadePadrao,
  temVencimento: entrega.temVencimento,
  diaVencimento: entrega.diaLimite,
  diaPrimeiraQuinzena: entrega.diaPrimeiraQuinzena,
  diaSegundaQuinzena: entrega.diaSegundaQuinzena,
  diaSemana: entrega.diaSemana,
  dataVencimento: entrega.dataVencimento,
  mesVencimento: entrega.mesVencimento,
});

const getEtapasDescricao = (etapas: string[]) => {
  if (etapas.length === 0) return 'Etapas: nenhuma definida';
  const visibleEtapas = etapas.slice(0, 3).join(' • ');
  const remaining = etapas.length - 3;
  return `Etapas: ${visibleEtapas}${remaining > 0 ? ` • +${remaining}` : ''}`;
};

export const TabProtocolosEntregas: React.FC<TabProtocolosEntregasProps> = ({ company }) => {
  const { openTab } = useInternalTabs();
  const units = useMemo(() => buildProtocolUnits(company), [company]);
  const [selectedUnitId, setSelectedUnitId] = useState(company.id);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? units[0];
  const [configs, setConfigs] = useState<ProtocoloEmpresaConfig[]>([]);
  const [configVersion, setConfigVersion] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
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
  } = useEmpresaProtocolosConfiguracao(selectedUnit.company);
  const catalogo = configuracao?.catalogo ?? EMPTY_CATALOGO;
  const catalogoAtivo = useMemo(
    () => catalogo.filter((item) => item.status === 'Ativo'),
    [catalogo],
  );

  useEffect(() => {
    if (!units.some((unit) => unit.id === selectedUnitId)) setSelectedUnitId(company.id);
  }, [company.id, selectedUnitId, units]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
    setHasConflict(false);
    setIsSelectionOpen(false);
    setConfigs([]);
    setConfigVersion(null);
  }, [selectedUnit.id, selectedUnit.company.status, selectedUnit.company.tipo, selectedUnit.company.tipoParceiroId]);

  useEffect(() => {
    if (!configuracao) return;
    if (!isDirtyRef.current) {
      setConfigs(configuracao.configs);
      setConfigVersion(configuracao.updatedAt);
      return;
    }

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

  const configById = useMemo(() => new Map(
    configs.map((item) => [item.entregaId, item]),
  ), [configs]);
  const selectedCatalogo = useMemo(() => catalogoAtivo.filter(
    (item) => configById.get(item.id)?.ativo === true,
  ), [catalogoAtivo, configById]);
  const groupedSelectedCatalogo = useMemo(() => selectedCatalogo.reduce<Record<string, ProtocoloTipoConfig[]>>(
    (groups, item) => ({
      ...groups,
      [item.categoria]: [...(groups[item.categoria] ?? []), item],
    }),
    {},
  ), [selectedCatalogo]);

  const handleOpenSelection = () => {
    resetSaveError();
    isDirtyRef.current = true;
    setIsDirty(true);
    setIsSelectionOpen(true);
  };

  const handleCloseSelection = () => {
    if (isSaving) return;
    isDirtyRef.current = false;
    setIsDirty(false);
    setIsSelectionOpen(false);
    resetSaveError();
    if (configuracao) {
      setConfigs(configuracao.configs);
      setConfigVersion(configuracao.updatedAt);
    }
  };

  const handleSaveSelection = async (selectedIds: Set<string>) => {
    const editableIds = new Set(catalogoAtivo.map((item) => item.id));
    const nextConfigs = configs.map((item) => editableIds.has(item.entregaId)
      ? { ...item, ativo: selectedIds.has(item.entregaId) }
      : item);
    const configuredIds = new Set(nextConfigs.map((item) => item.entregaId));
    catalogoAtivo.forEach((item) => {
      if (!configuredIds.has(item.id)) {
        nextConfigs.push({
          entregaId: item.id,
          ativo: selectedIds.has(item.id),
          periodicidade: item.periodicidadePadrao,
        });
      }
    });

    setConfigs(nextConfigs);
    resetSaveError();
    try {
      const saved = await saveConfiguracao(nextConfigs, configVersion);
      setConfigs(saved.configs);
      setConfigVersion(saved.updatedAt);
      setIsDirty(false);
      isDirtyRef.current = false;
      setHasConflict(false);
      setIsSelectionOpen(false);
      setToast({
        id: Date.now(),
        type: 'success',
        title: 'Obrigações sincronizadas',
        message: `A seleção de ${selectedUnit.label} foi salva com sucesso.`,
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
    setIsSelectionOpen(false);
    const refreshed = await retryConfiguracao();
    if (refreshed.data) {
      setConfigs(refreshed.data.configs);
      setConfigVersion(refreshed.data.updatedAt);
      setHasConflict(false);
    }
  };

  const handleUnitChange = (unitId: string) => {
    isDirtyRef.current = false;
    setIsDirty(false);
    setHasConflict(false);
    setIsSelectionOpen(false);
    resetSaveError();
    setSelectedUnitId(unitId);
  };

  const handleOpenAtividades = () => {
    openTab('atividades-modelos', 'Rotinas', 'Repeat', {
      data: { selectedCompanyId: selectedUnit.id },
    });
  };

  const errorMessage = configuracaoError instanceof Error
    ? configuracaoError.message
    : configuracaoError
      ? 'Não foi possível carregar as obrigações da unidade.'
      : '';

  return (
    <div className="tab-panel-content protocolos-config-panel" aria-busy={isLoading}>
      <SystemToast toast={toast} onClose={() => setToast(null)} />
      {isLoading ? (
        <div className="protocolos-config-loading">
          <div className="loading-spinner" />
          <span>Carregando obrigações da unidade...</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="error-banner protocolos-config-error" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => { void retryConfiguracao(); }}>Tentar novamente</button>
        </div>
      ) : null}

      {hasConflict && !isSelectionOpen ? (
        <div className="error-banner protocolos-config-error" role="alert">
          <span>A configuração mudou em outra tela. Recarregue para continuar.</span>
          <button type="button" onClick={() => { void handleReloadAfterConflict(); }}>
            Recarregar configuração
          </button>
        </div>
      ) : null}

      <div className="protocolos-config-header">
        <div>
          <h3>Rotinas e obrigações por unidade</h3>
          <p>Escolha a matriz ou filial e defina somente as obrigações aplicáveis a ela.</p>
        </div>
        <div className="protocolos-config-actions">
          <button type="button" className="btn-save-protocolos secondary" onClick={handleOpenAtividades}>
            <PlayCircle size={16} /> Abrir rotinas
          </button>
          <button
            type="button"
            className="btn-save-protocolos"
            onClick={handleOpenSelection}
            disabled={isLoading || isSaving || Boolean(errorMessage) || hasConflict}
          >
            {selectedCatalogo.length === 0 ? <ListPlus size={16} /> : <Pencil size={16} />}
            {selectedCatalogo.length === 0 ? 'Adicionar obrigações' : 'Editar obrigações'}
          </button>
        </div>
      </div>

      <label className="protocolos-unit-selector">
        <span>Unidade configurada</span>
        <select
          aria-label="Unidade configurada"
          value={selectedUnit.id}
          onChange={(event) => handleUnitChange(event.target.value)}
          disabled={isSaving}
        >
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
        </select>
      </label>

      <div className="protocolos-config-summary">
        <div>
          <span>Unidade</span>
          <strong>{selectedUnit.company.nome}</strong>
        </div>
        <div>
          <span>Estabelecimento</span>
          <strong>{selectedUnit.kind}</strong>
        </div>
        <div>
          <span>Obrigações selecionadas</span>
          <strong>{selectedCatalogo.length}</strong>
        </div>
      </div>

      {selectedCatalogo.length === 0 && !isLoading && !errorMessage ? (
        <div className="protocolos-config-empty">
          <span><ClipboardCheck size={24} /></span>
          <h4>Nenhuma obrigação selecionada</h4>
          <p>Adicione as obrigações que devem gerar rotinas para {selectedUnit.label}.</p>
          <button type="button" onClick={handleOpenSelection}>
            <ListPlus size={16} /> Adicionar obrigações
          </button>
        </div>
      ) : (
        <div className="protocolos-category-grid">
          {Object.entries(groupedSelectedCatalogo).map(([categoria, entregas]) => (
            <section key={categoria} className="protocolos-category-section">
              <div className="protocolos-category-title">
                {categoryIcon[categoria as keyof typeof categoryIcon]}
                <strong>{categoria}</strong>
              </div>
              <div className="protocolos-entregas-list">
                {entregas.map((entrega) => {
                  const etapas = entrega.etapas ?? [];
                  return (
                    <article key={entrega.id} className="protocolo-selected-item">
                      <span className="protocolo-option-marker"><CheckCircle2 size={17} /></span>
                      <div className="protocolo-option-text">
                        <strong>{entrega.nome}</strong>
                        <small>{getEntregaDescricao(entrega)}</small>
                        <span className="protocolo-option-meta">
                          <span>{getPrazoDescricao(entrega)}</span>
                          <span>{etapas.length} {etapas.length === 1 ? 'etapa' : 'etapas'}</span>
                        </span>
                        <small className="protocolo-option-etapas" title={etapas.join(' • ') || undefined}>
                          {getEtapasDescricao(etapas)}
                        </small>
                      </div>
                      <div className="protocolo-option-periodicidade">
                        <span className="protocolo-option-periodicidade-label">
                          <CalendarClock size={13} /> <strong>Rotina</strong>
                        </span>
                        <span
                          aria-label={`Rotina de ${entrega.nome}`}
                          className="protocolo-option-periodicidade-value"
                        >
                          {OBRIGACAO_PERIODICIDADE_LABELS[entrega.periodicidadePadrao]}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {isSelectionOpen ? (
        <ObrigacoesSelectionModal
          key={`${selectedUnit.id}:${configVersion ?? 'sem-versao'}`}
          catalogo={catalogoAtivo}
          configs={configs}
          hasConflict={hasConflict}
          isSaving={isSaving}
          unitLabel={selectedUnit.label}
          onCancel={handleCloseSelection}
          onReloadConflict={() => { void handleReloadAfterConflict(); }}
          onSave={(selectedIds) => { void handleSaveSelection(selectedIds); }}
        />
      ) : null}
    </div>
  );
};
