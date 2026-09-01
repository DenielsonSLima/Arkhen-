import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Loader2, RefreshCw, Search } from 'lucide-react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { SystemToast, type SystemToastData } from '../../components/SystemToast';
import { RotinaFormDrawer } from '../forms/RotinaFormDrawer';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import type { ClienteEmpresa } from '../services/atividadesService';
import {
  ROTINAS_BATCH_LIMIT,
  type RotinaAtividade,
} from '../services/rotinasAtividadesService';
import {
  filterRotinas,
  getRotinaFrequenciaLabel,
  groupRotinasByCompany,
  type RotinasFilterState,
  type RotinaWorkspaceItem,
} from '../utils/rotinasWorkspace';
import { RotinasCompanyDetail } from './rotinas/RotinasCompanyDetail';
import { RotinasCompanyGrid } from './rotinas/RotinasCompanyGrid';
import { RotinasConsulta } from './rotinas/RotinasConsulta';
import './rotinas/RotinasWorkspace.css';

interface AbaRotinasProps {
  initialCompanyId?: string;
}

type RotinasView = 'empresas' | 'consulta';

interface DrawerState {
  company: ClienteEmpresa;
  rotina?: RotinaWorkspaceItem;
}

const normalizeSearch = (value: string) => value
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const getActiveModelIds = (company: ClienteEmpresa, modelos: Array<{ id: string; codigo?: string }>) => {
  const active = new Set(company.modelosAtivos || []);
  return new Set(
    modelos
      .filter((modelo) => active.has(modelo.id) || active.has(modelo.codigo || ''))
      .map((modelo) => modelo.id),
  );
};

export const AbaRotinas: React.FC<AbaRotinasProps> = ({ initialCompanyId }) => {
  const {
    rotinas,
    usuarios,
    clientes,
    modelos,
    isLoading,
    isSaving,
    workspaceError,
    refetchWorkspace,
    saveRotinaAsync,
    deleteRotinaAsync,
    assignResponsibleAsync,
    assignResponsibleBatchAsync,
  } = useAtividadesWorkspace();
  const [activeView, setActiveView] = useState<RotinasView>('empresas');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
  const [filters, setFilters] = useState<RotinasFilterState>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchResponsibleId, setBatchResponsibleId] = useState('');
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RotinaWorkspaceItem | null>(null);
  const [toast, setToast] = useState<SystemToastData | null>(null);

  useEffect(() => {
    if (initialCompanyId) {
      setSelectedCompanyId(initialCompanyId);
      setActiveView('empresas');
    }
  }, [initialCompanyId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const groups = useMemo(
    () => groupRotinasByCompany(clientes, rotinas),
    [clientes, rotinas],
  );

  useEffect(() => {
    const currentRoutineIds = new Set(rotinas.map((rotina) => rotina.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => currentRoutineIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rotinas]);

  const activeCompanyIds = useMemo(
    () => new Set(clientes.map((cliente) => cliente.id)),
    [clientes],
  );
  const unlinkedRoutineCount = useMemo(
    () => rotinas.filter((rotina) => !rotina.clienteId || !activeCompanyIds.has(rotina.clienteId)).length,
    [activeCompanyIds, rotinas],
  );
  const selectedGroup = groups.find((group) => group.cliente.id === selectedCompanyId);

  const filteredRotinas = useMemo(() => {
    const base = filterRotinas(rotinas, { ...filters, search: '' });
    const search = normalizeSearch(filters.search || '');
    if (!search) return base;
    const clientsById = new Map(clientes.map((cliente) => [cliente.id, cliente]));

    return base.filter((rotina) => {
      const cliente = rotina.clienteId ? clientsById.get(rotina.clienteId) : undefined;
      return [
        rotina.nome,
        rotina.categoria,
        rotina.responsavel,
        rotina.cliente,
        rotina.protocoloCodigo,
        getRotinaFrequenciaLabel(rotina),
        cliente?.nome,
        cliente?.cnpj,
      ].some((value) => normalizeSearch(String(value || '')).includes(search));
    });
  }, [clientes, filters, rotinas]);
  const selectedRotinas = filteredRotinas.filter((rotina) => selectedIds.has(rotina.id));
  const visibleSelectedIds = new Set(selectedRotinas.map((rotina) => rotina.id));
  const selectedCompanyModelIds = selectedGroup
    ? getActiveModelIds(selectedGroup.cliente, modelos)
    : new Set<string>();

  const showToast = (type: SystemToastData['type'], title: string, message: string) => {
    setToast({ id: Date.now(), type, title, message });
  };

  const handleSave = async (rotina: RotinaAtividade) => {
    try {
      await saveRotinaAsync(rotina);
      setDrawer(null);
      showToast('success', 'Rotina salva', 'A rotina recorrente foi atualizada para esta empresa.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a rotina.';
      showToast('error', 'Falha ao salvar', message);
      throw error;
    }
  };

  const handleAssign = async (rotina: RotinaWorkspaceItem, responsibleId: string) => {
    try {
      await assignResponsibleAsync({ rotina: rotina as RotinaAtividade, responsibleId });
      showToast('success', 'Responsável atualizado', `O responsável de “${rotina.nome}” foi alterado.`);
    } catch (error) {
      showToast(
        'error',
        'Falha na atribuição',
        error instanceof Error ? error.message : 'Não foi possível alterar o responsável.',
      );
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const deletedName = pendingDelete.nome;
    try {
      await deleteRotinaAsync(pendingDelete.id);
      showToast('success', 'Rotina desativada', `“${deletedName}” não gerará novas tarefas.`);
    } catch (error) {
      showToast(
        'error',
        'Falha ao desativar',
        error instanceof Error ? error.message : 'Não foi possível desativar a rotina.',
      );
    } finally {
      setPendingDelete(null);
    }
  };

  const handleToggleSelected = (id: string) => {
    if (!selectedIds.has(id) && selectedIds.size >= ROTINAS_BATCH_LIMIT) {
      showToast('info', 'Limite do lote', `Selecione no máximo ${ROTINAS_BATCH_LIMIT} rotinas por lote.`);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectVisible = (ids: string[]) => {
    const remaining = Math.max(0, ROTINAS_BATCH_LIMIT - selectedIds.size);
    const newIds = ids.filter((id) => !selectedIds.has(id));
    if (newIds.length > remaining) {
      showToast('info', 'Limite do lote', `Foram selecionadas as primeiras ${ROTINAS_BATCH_LIMIT} rotinas.`);
    }
    setSelectedIds((current) => new Set([...current, ...newIds.slice(0, remaining)]));
  };

  const handleFiltersChange = (nextFilters: RotinasFilterState) => {
    setFilters(nextFilters);
    setSelectedIds(new Set());
    setBatchResponsibleId('');
  };

  const handleBatchAssign = async () => {
    if (!batchResponsibleId || selectedRotinas.length === 0) return;
    try {
      const result = await assignResponsibleBatchAsync({
        rotinas: selectedRotinas,
        responsibleId: batchResponsibleId,
      });
      const successfulIds = new Set(result.successIds);
      setSelectedIds((current) => new Set([...current].filter((id) => !successfulIds.has(id))));

      if (result.failed.length === 0) {
        showToast('success', 'Alteração concluída', `${result.successIds.length} rotinas foram reatribuídas.`);
        setBatchResponsibleId('');
      } else {
        showToast(
          'info',
          'Alteração parcialmente concluída',
          `${result.successIds.length} alteradas e ${result.failed.length} não alteradas. Revise os itens ainda selecionados.`,
        );
      }
    } catch (error) {
      showToast(
        'error',
        'Falha na alteração em lote',
        error instanceof Error ? error.message : 'Nenhuma rotina foi alterada.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="rotinas-loading">
        <Loader2 size={32} className="animate-spin" />
        <span>Carregando empresas e rotinas...</span>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="rotinas-error-state" role="alert">
        <Search size={34} />
        <h3>Não foi possível carregar as rotinas</h3>
        <p>{workspaceError instanceof Error ? workspaceError.message : 'Tente novamente em alguns instantes.'}</p>
        <button type="button" className="rotinas-button rotinas-button--secondary" onClick={() => { void refetchWorkspace(); }}>
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    );
  }

  const batchUser = usuarios.find((usuario) => usuario.configUsuarioId === batchResponsibleId);

  return (
    <div className="rotinas-workspace">
      <SystemToast toast={toast} onClose={() => setToast(null)} />

      <nav className="rotinas-tabs" role="tablist" aria-label="Visões de rotinas">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'empresas'}
          className={`rotinas-tab ${activeView === 'empresas' ? 'is-active' : ''}`}
          onClick={() => setActiveView('empresas')}
        >
          <Building2 size={14} /> Empresas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'consulta'}
          className={`rotinas-tab ${activeView === 'consulta' ? 'is-active' : ''}`}
          onClick={() => setActiveView('consulta')}
        >
          <Search size={14} /> Consulta
        </button>
      </nav>

      {activeView === 'empresas' ? (
        selectedGroup ? (
          <RotinasCompanyDetail
            group={selectedGroup}
            usuarios={usuarios}
            activeModelIds={selectedCompanyModelIds}
            isSaving={isSaving}
            onBack={() => setSelectedCompanyId('')}
            onCreate={() => setDrawer({ company: selectedGroup.cliente })}
            onEdit={(rotina) => setDrawer({ company: selectedGroup.cliente, rotina })}
            onDelete={setPendingDelete}
            onAssign={handleAssign}
          />
        ) : (
          <>
            {unlinkedRoutineCount > 0 ? (
              <div className="rotinas-unlinked-warning" role="status">
                <AlertTriangle size={17} />
                <span>
                  {unlinkedRoutineCount} {unlinkedRoutineCount === 1 ? 'rotina não está' : 'rotinas não estão'} vinculada{unlinkedRoutineCount === 1 ? '' : 's'} a uma empresa ativa.
                </span>
                <button type="button" onClick={() => setActiveView('consulta')}>Ver na Consulta</button>
              </div>
            ) : null}
            <RotinasCompanyGrid groups={groups} onOpenCompany={setSelectedCompanyId} />
          </>
        )
      ) : (
        <RotinasConsulta
          rotinas={filteredRotinas}
          allRotinas={rotinas}
          clientes={clientes}
          usuarios={usuarios}
          filters={filters}
          selectedIds={visibleSelectedIds}
          batchResponsibleId={batchResponsibleId}
          isSaving={isSaving}
          onFiltersChange={handleFiltersChange}
          onToggleSelected={handleToggleSelected}
          onSelectVisible={handleSelectVisible}
          onClearSelected={() => setSelectedIds(new Set())}
          onBatchResponsibleChange={setBatchResponsibleId}
          onApplyBatch={() => setIsBatchConfirmOpen(true)}
        />
      )}

      {drawer ? (
        <RotinaFormDrawer
          key={`${drawer.company.id}:${drawer.rotina?.id || 'new'}`}
          company={drawer.company}
          modelos={modelos}
          usuarios={usuarios}
          rotina={drawer.rotina as RotinaAtividade | undefined}
          isSaving={isSaving}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
        />
      ) : null}

      <SystemQuickModal
        isOpen={Boolean(pendingDelete)}
        title="Desativar rotina?"
        message={`A rotina “${pendingDelete?.nome || ''}” deixará de gerar novas tarefas. O histórico já concluído será preservado.`}
        confirmLabel="Desativar"
        onConfirm={() => { void handleDelete(); }}
        onClose={() => setPendingDelete(null)}
        danger
      />

      <SystemQuickModal
        isOpen={isBatchConfirmOpen}
        title="Alterar responsável em lote?"
        message={`O responsável padrão de ${selectedRotinas.length} rotinas será alterado para ${batchUser?.nome || 'o usuário selecionado'}. O histórico concluído não será modificado.`}
        confirmLabel="Aplicar alteração"
        onConfirm={() => { void handleBatchAssign(); }}
        onClose={() => setIsBatchConfirmOpen(false)}
      />
    </div>
  );
};
