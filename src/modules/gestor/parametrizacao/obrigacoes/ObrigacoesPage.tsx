import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, ListChecks, Plus, Search, ShieldCheck, Workflow } from 'lucide-react';
import { SystemToast, type SystemToastData } from '../../components/SystemToast';
import { ObrigacaoCard } from './components/ObrigacaoCard';
import { ObrigacaoEditorDrawer } from './components/ObrigacaoEditorDrawer';
import { ObrigacaoStatusDialog } from './components/ObrigacaoStatusDialog';
import {
  OBRIGACAO_REGIMES,
  createEmptyObrigacao,
  duplicateObrigacao,
  type ObrigacaoModelo,
  type ObrigacaoModeloDraft,
  type ObrigacaoRegime,
} from './obrigacoes.types';
import { obrigacoesKeys, obrigacoesService } from './services/obrigacoesService';
import './ObrigacoesPage.css';

type StatusFilter = 'todos' | 'ativos' | 'inativos';
const EMPTY_OBRIGACOES: ObrigacaoModelo[] = [];

const notify = (
  type: SystemToastData['type'],
  title: string,
  message: string,
): SystemToastData => ({ id: Date.now(), type, title, message });

export const ObrigacoesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const obrigacoesQuery = useQuery({
    queryKey: obrigacoesKeys.all,
    queryFn: obrigacoesService.list,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState('');
  const [regime, setRegime] = useState<'todos' | ObrigacaoRegime>('todos');
  const [categoria, setCategoria] = useState('todas');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [editing, setEditing] = useState<ObrigacaoModeloDraft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [toast, setToast] = useState<SystemToastData | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<ObrigacaoModelo | null>(null);

  const invalidateDependentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: obrigacoesKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['protocolos'] }),
      queryClient.invalidateQueries({ queryKey: ['atividades'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: obrigacoesService.save,
    onSuccess: async (saved) => {
      await invalidateDependentData();
      setEditing(null);
      setEditorError('');
      setUpdatingId(null);
      setStatusConfirmation(null);
      setToast(notify(
        'success',
        saved.ativo ? 'Obrigação salva' : 'Obrigação desativada',
        saved.ativo
          ? `${saved.nome} foi atualizada e já está disponível nas empresas compatíveis.`
          : `${saved.nome} foi desativada nas empresas vinculadas.`,
      ));
    },
    onError: (error: Error) => {
      setUpdatingId(null);
      if (editing) {
        setEditorError(error.message);
      } else {
        setToast(notify('error', 'Não foi possível atualizar', error.message));
      }
    },
  });

  const obrigacoes = obrigacoesQuery.data ?? EMPTY_OBRIGACOES;
  const categorias = useMemo(() => (
    Array.from(new Set(obrigacoes.map((item) => item.categoria))).sort((a, b) => (
      a.localeCompare(b, 'pt-BR')
    ))
  ), [obrigacoes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return obrigacoes.filter((item) => {
      const matchesTerm = !term || [item.nome, item.descricao, item.categoria, ...item.etapas]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
      const matchesRegime = regime === 'todos' || item.regimes.includes(regime);
      const matchesCategory = categoria === 'todas' || item.categoria === categoria;
      const matchesStatus = status === 'todos'
        || (status === 'ativos' ? item.ativo : !item.ativo);
      return matchesTerm && matchesRegime && matchesCategory && matchesStatus;
    }).sort((left, right) => (
      Number(right.ativo) - Number(left.ativo)
      || left.ordem - right.ordem
      || left.nome.localeCompare(right.nome, 'pt-BR')
    ));
  }, [categoria, obrigacoes, regime, search, status]);

  const metrics = useMemo(() => ({
    total: obrigacoes.length,
    ativos: obrigacoes.filter((item) => item.ativo).length,
    comPrazo: obrigacoes.filter((item) => item.ativo && item.temVencimento).length,
    etapas: obrigacoes.filter((item) => item.ativo)
      .reduce((total, item) => total + item.etapas.length, 0),
  }), [obrigacoes]);

  const handleSave = async (draft: ObrigacaoModeloDraft) => {
    setEditorError('');
    await saveMutation.mutateAsync(draft).catch(() => undefined);
  };

  const executeToggleStatus = (item: ObrigacaoModelo) => {
    setUpdatingId(item.id);
    saveMutation.mutate({ ...item, ativo: !item.ativo });
  };

  const handleToggleStatus = (item: ObrigacaoModelo) => {
    if (item.ativo) {
      setStatusConfirmation(item);
      return;
    }
    executeToggleStatus(item);
  };

  const clearFilters = () => {
    setSearch('');
    setRegime('todos');
    setCategoria('todas');
    setStatus('todos');
  };

  return (
    <div className="submodule-content-card obrigacoes-page animate-fade-in">
      <SystemToast toast={toast} onClose={() => setToast(null)} />

      <header className="obrigacoes-page__header">
        <div>
          <span className="obrigacoes-page__eyebrow"><Workflow size={15} /> Central de fluxos</span>
          <h2 className="parametrizacao-page-title">Obrigações</h2>
          <p>Crie cada obrigação como um fluxo completo e defina em quais regimes ela se aplica.</p>
        </div>
        <button
          type="button"
          className="obrigacoes-page__new-button"
          disabled={saveMutation.isPending}
          onClick={() => { setEditorError(''); setEditing(createEmptyObrigacao()); }}
        >
          <Plus size={18} /> Nova obrigação
        </button>
      </header>

      <section className="obrigacoes-page__metrics" aria-label="Resumo das obrigações">
        <article><ListChecks size={19} /><span>Cadastradas</span><strong>{metrics.total}</strong></article>
        <article><ShieldCheck size={19} /><span>Disponíveis</span><strong>{metrics.ativos}</strong></article>
        <article><CalendarCheck2 size={19} /><span>Com vencimento</span><strong>{metrics.comPrazo}</strong></article>
        <article><Workflow size={19} /><span>Etapas ativas</span><strong>{metrics.etapas}</strong></article>
      </section>

      <section className="obrigacoes-page__filters" aria-label="Filtros das obrigações">
        <label className="obrigacoes-page__search">
          <Search size={18} />
          <span className="sr-only">Buscar obrigação</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por obrigação, categoria ou etapa..."
          />
        </label>
        <label>
          <span>Regime</span>
          <select value={regime} onChange={(event) => setRegime(event.target.value as typeof regime)}>
            <option value="todos">Todos os regimes</option>
            {OBRIGACAO_REGIMES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
            <option value="todas">Todas as categorias</option>
            {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="todos">Todos</option>
            <option value="ativos">Disponíveis</option>
            <option value="inativos">Desativados</option>
          </select>
        </label>
      </section>

      <div className="obrigacoes-page__result-line">
        <strong>{filtered.length} {filtered.length === 1 ? 'obrigação encontrada' : 'obrigações encontradas'}</strong>
        {(search || regime !== 'todos' || categoria !== 'todas' || status !== 'todos') && (
          <button type="button" onClick={clearFilters}>Limpar filtros</button>
        )}
      </div>

      {obrigacoesQuery.isLoading && (
        <div className="obrigacoes-page__state">Carregando obrigações...</div>
      )}
      {obrigacoesQuery.isError && (
        <div className="obrigacoes-page__state obrigacoes-page__state--error">
          <strong>Não foi possível carregar as obrigações.</strong>
          <span>{(obrigacoesQuery.error as Error).message}</span>
          <button type="button" onClick={() => obrigacoesQuery.refetch()}>Tentar novamente</button>
        </div>
      )}
      {!obrigacoesQuery.isLoading && !obrigacoesQuery.isError && !filtered.length && (
        <div className="obrigacoes-page__state">
          <Workflow size={28} />
          <strong>Nenhuma obrigação com esses filtros</strong>
          <span>Ajuste a busca ou crie um novo fluxo.</span>
        </div>
      )}

      {!!filtered.length && (
        <section className="obrigacoes-page__grid" aria-label="Catálogo de obrigações">
          {filtered.map((item) => (
            <ObrigacaoCard
              key={item.id}
              obrigacao={item}
              onEdit={() => { setEditorError(''); setEditing(item); }}
              onDuplicate={() => { setEditorError(''); setEditing(duplicateObrigacao(item)); }}
              onToggleStatus={() => handleToggleStatus(item)}
              isUpdating={saveMutation.isPending}
            />
          ))}
        </section>
      )}

      {editing && (
        <ObrigacaoEditorDrawer
          initialValue={editing}
          isSaving={saveMutation.isPending}
          error={editorError}
          onClose={() => { if (!saveMutation.isPending) setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {statusConfirmation && (
        <ObrigacaoStatusDialog
          obrigacao={statusConfirmation}
          isSaving={saveMutation.isPending && updatingId === statusConfirmation.id}
          onCancel={() => {
            if (!saveMutation.isPending) setStatusConfirmation(null);
          }}
          onConfirm={() => executeToggleStatus(statusConfirmation)}
        />
      )}
    </div>
  );
};
